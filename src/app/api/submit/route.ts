import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { track } from "@vercel/analytics/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerDataLayer, getDatabaseBackend } from "@/lib/data";
import { normalizeCcData, isClientMachineId, NO_USAGE_MESSAGE } from "@/lib/ccusage";
import { archiveRawSubmission } from "@/lib/data/supabase/rawArchive";
import { getPaidCliNotice, TAKO_CLI_NOTICE } from "@/lib/sponsor";
import { isGithubHandle } from "@/lib/profile-index";
import { readClient, submitErrorResponse, submitNotice } from "@/lib/submit-api";
import { bearerFrom } from "@/lib/tokens";
import { readCorpusScope } from "@/lib/drift";
import { getTier } from "@/lib/tiers";
import { badgeMarkdown, profileUrl } from "@/lib/site";

/**
 * `{ "2026-07": { files, bytes } }` from the submission body, or undefined.
 *
 * Anything malformed is dropped entirely rather than partially accepted: this
 * decides whether a user's stored total can go down, so a half-parsed block is
 * worse than none.
 */
function readCorpus(payload: unknown): Record<string, { files: number; bytes: number }> | undefined {
  const raw = (payload as { drift?: { corpus?: unknown } })?.drift?.corpus;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;

  const out: Record<string, { files: number; bytes: number }> = {};
  for (const [month, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const size = value as { files?: unknown; bytes?: unknown };
    const files = Number(size?.files);
    const bytes = Number(size?.bytes);
    if (!Number.isFinite(files) || !Number.isFinite(bytes) || files < 0 || bytes < 0) continue;
    out[month] = { files: Math.trunc(files), bytes: Math.trunc(bytes) };
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const backend = getDatabaseBackend();

    // Log request details for debugging
    const cliVersion = request.headers.get("X-CLI-Version");
    console.log("Submission request received:", {
      cliVersion: cliVersion || "unknown",
      userAgent: request.headers.get("user-agent"),
      contentType: request.headers.get("content-type"),
      contentLength: request.headers.get("content-length"),
      url: request.url,
      method: request.method,
      backend,
    });

    // Check request size (Vercel has a 4.5MB limit for API routes)
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 4.5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Request body too large. Please submit data in smaller batches." },
        { status: 413 }
      );
    }

    // Parse the request body
    let ccData;
    try {
      ccData = await request.json();
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON format. Please ensure your cc.json file is valid JSON." },
        { status: 400 }
      );
    }

    // Check for authentication
    const session = await getServerSession(authOptions);

    // An API token authenticates a scheduled run, which cannot open a browser
    // for OAuth. It is checked before the session so an explicit credential
    // always wins over an ambient cookie, and unlike the X-GitHub-User header
    // it actually proves the submitter controls the account — so these count
    // as verified.
    const bearer = bearerFrom(request.headers.get("authorization"));
    let tokenOwner: { username: string; githubUsername: string } | null = null;
    if (bearer) {
      const dataLayer = await getServerDataLayer();
      tokenOwner = await dataLayer.tokens.resolve(bearer);
      if (!tokenOwner) {
        return NextResponse.json(
          { error: "Invalid or revoked API token. Run `npx viberank-cli login` to get a new one." },
          { status: 401 }
        );
      }
    }

    let githubUsername: string;
    let source: "oauth" | "cli";
    let verified: boolean;
    let githubName: string | undefined;
    let githubAvatar: string | undefined;

    if (tokenOwner) {
      githubUsername = tokenOwner.githubUsername;
      source = "cli";
      verified = true;
      console.log("Token submission from:", githubUsername);
    } else if (session?.user?.username) {
      // Authenticated via OAuth
      githubUsername = session.user.username;
      source = "oauth";
      verified = true;
      githubName = session.user.name || undefined;
      githubAvatar = session.user.image || undefined;
      console.log("OAuth submission from:", githubUsername);
    } else {
      // CLI submission
      githubUsername = request.headers.get("X-GitHub-User") || "anonymous";
      source = "cli";
      verified = false;
      console.log("CLI submission from:", githubUsername);

      // Validate CLI submission has proper username
      if (githubUsername === "anonymous" || !githubUsername) {
        return NextResponse.json(
          { error: "GitHub username is required for CLI submissions. Please provide X-GitHub-User header." },
          { status: 400 }
        );
      }

      // The header is unauthenticated and its upstream default is
      // `git config user.name`, which has held shell fragments that became
      // public profile pages and sitemap entries (#119). Only a plausible
      // GitHub handle may create a profile this way; token and OAuth
      // identities above come from GitHub itself and need no check.
      if (!isGithubHandle(githubUsername)) {
        return NextResponse.json(
          {
            error: `"${githubUsername.slice(0, 60)}" is not a valid GitHub username (1-39 letters, digits, single hyphens). Pass your GitHub handle in X-GitHub-User, or run npx viberank-cli login to submit with a token.`,
          },
          { status: 400 }
        );
      }
    }

    // Check if ccData is null or undefined
    if (!ccData || typeof ccData !== 'object') {
      console.error("Invalid cc.json data: ccData is null or not an object", {
        ccData: ccData,
        type: typeof ccData
      });
      return NextResponse.json(
        { error: "Invalid submission data. Please ensure your cc.json file contains valid data." },
        { status: 400 }
      );
    }

    // Validate the cc.json structure
    if (!ccData.daily || !ccData.totals) {
      console.error("Invalid cc.json structure:", {
        hasDaily: !!ccData.daily,
        hasTotals: !!ccData.totals,
        keys: Object.keys(ccData || {})
      });
      return NextResponse.json(
        { error: "Invalid cc.json format. Missing 'daily' or 'totals' field. Please regenerate using: npx ccusage@latest --json > cc.json" },
        { status: 400 }
      );
    }

    // Validate totals structure
    const requiredTotalFields = ['inputTokens', 'outputTokens', 'cacheCreationTokens', 'cacheReadTokens', 'totalCost', 'totalTokens'];
    const missingTotalFields = requiredTotalFields.filter(field =>
      ccData.totals[field] === undefined || ccData.totals[field] === null
    );

    if (missingTotalFields.length > 0) {
      console.error("Missing total fields:", missingTotalFields);
      return NextResponse.json(
        { error: `Invalid cc.json format. Missing fields in totals: ${missingTotalFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate daily entries. An empty list is the most common rejection and
    // isn't a broken file: ccusage found no usage on that machine.
    if (!Array.isArray(ccData.daily)) {
      return NextResponse.json(
        { error: "Invalid cc.json format. 'daily' must be a non-empty array." },
        { status: 400 }
      );
    }
    if (ccData.daily.length === 0) {
      return NextResponse.json({ error: NO_USAGE_MESSAGE }, { status: 400 });
    }

    const sentMachineId = request.headers.get("X-Machine-Id");
    if (sentMachineId && !isClientMachineId(sentMachineId)) {
      return NextResponse.json(
        { error: "Invalid X-Machine-Id. Use letters, digits, '.', '_' or '-' (up to 128)." },
        { status: 400 }
      );
    }

    // Normalize across ccusage report shapes (period→date, dedupe the
    // aggregate "all" rows, resolve per-day tools, recompute totals). This is
    // the single chokepoint every submission path funnels through.
    let normalized;
    try {
      normalized = normalizeCcData(ccData);
    } catch (normalizeError) {
      const message =
        normalizeError instanceof Error
          ? normalizeError.message
          : "Invalid cc.json format. Please regenerate with: npx ccusage@latest --json > cc.json";
      console.error("Normalization error:", message);
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Keep the pre-normalization payload for the raw archive (006): once
    // ccData is reassigned below, the original report shape is gone.
    const rawPayload = ccData;

    // Hand the data layer the canonical shape from here on.
    ccData = {
      totals: normalized.totals,
      daily: normalized.daily,
      tools: normalized.tools,
    };

    // Log submission details before sending to database
    console.log("Submitting to database:", {
      username: githubUsername,
      source: source,
      verified: verified,
      dataSize: JSON.stringify(ccData).length,
      dailyCount: ccData.daily?.length || 0,
      tools: normalized.tools,
      totals: ccData.totals,
      backend,
    });

    // Submit using data layer with timeout handling
    let submissionId;
    try {
      const dataLayer = await getServerDataLayer();

      // Stable per-machine id lets us sum overlapping dates across machines
      // without double-counting same-machine re-submits (#43). Optional: web
      // uploads and older CLIs omit it and fall back to a shared bucket.
      const machineId = request.headers.get("X-Machine-Id") || undefined;

      // Per-month corpus size (#112). Validated here rather than trusted: it
      // comes from a client and decides whether a stored total may be lowered,
      // so a malformed block must be ignored, not half-read.
      const corpus = readCorpus(rawPayload);
      const corpusScope = readCorpusScope(rawPayload);

      // Awaited directly, not raced against a timer. A rejected race did not
      // cancel the underlying writes, so a slow merge reported failure while
      // its data committed anyway — and the CLI then told the user to fix a
      // cc.json that was never the problem (#93). The merge path is bulk-
      // written in the data layer now, so long histories no longer approach
      // the request budget in the first place.
      submissionId = await dataLayer.submissions.submit({
        username: githubUsername,
        githubUsername: githubUsername,
        githubName,
        githubAvatar,
        source: source,
        verified: verified,
        machineId,
        corpus,
        corpusScope,
        ccData: ccData,
      });

      // Archive the original payload for future re-parse/backfill. Best
      // effort — never blocks or fails an accepted submission.
      await archiveRawSubmission(rawPayload, {
        username: githubUsername,
        source,
        machineId,
        cliVersion: cliVersion || undefined,
      });
    } catch (dbError: any) {
      console.error("Database mutation error:", {
        message: dbError?.message,
        data: dbError?.data,
        code: dbError?.code,
        stack: dbError?.stack,
        errorType: typeof dbError,
        errorString: String(dbError),
        backend,
      });

      // Extract meaningful error message
      let errorMessage = "Database operation failed";

      if (dbError?.message) {
        errorMessage = dbError.message;
      } else if (typeof dbError === 'string') {
        errorMessage = dbError;
      } else if (dbError?.data?.message) {
        errorMessage = dbError.data.message;
      }

      // Log additional context for Server Error
      if (errorMessage.includes("Server Error")) {
        console.error("Database Server Error - Potential causes:");
        console.error("1. Database service outage or degraded performance");
        console.error("2. Data validation issue that passed client but failed on server");
        console.error("3. Database quota or rate limiting");
        console.error("4. Network connectivity issues");
        console.error("Backend:", backend);
        console.error("Submission data size:", JSON.stringify(ccData).length, "bytes");
      }

      // Typed errors (a rate limit, a rejected report) are rethrown as they
      // are: their class is what decides the status code below.
      throw dbError instanceof Error ? dbError : new Error(errorMessage);
    }

    // Analytics events never block or fail a submission.
    await track("submit_completed", {
      source,
      verified,
      tools: (normalized.tools ?? []).join(","),
      cliVersion: cliVersion || "unknown",
      // The program that sent it (cli/1.13.0, mcp/1.2.0, web). `source`
      // can't say: an MCP submission with a token is "cli" there.
      client: readClient(request.headers.get("X-Viberank-Client")),
    }).catch((e) => console.error("Analytics track failed:", e));

    // A profile page is cached for two minutes, and the CLI and the upload
    // modal both link straight to it, so without this the first look after a
    // submission could still show the old numbers. Best effort.
    try {
      revalidatePath(`/profile/${encodeURIComponent(githubUsername)}`);
    } catch (e) {
      console.error("Profile revalidation failed:", e);
    }

    // Where they landed, plus something worth pasting somewhere.
    //
    // This is the highest-emotion moment the product has, and until now it said
    // nothing but "submitted, here is a URL". Meanwhile 3 repos out of 1,100+
    // developers have ever embedded the README badge — not because people
    // declined, but because nothing ever offered it. Rank is a single head-only
    // count and the badge is a string, so the whole block costs one round trip.
    let standing: {
      rank: number;
      totalDevelopers: number;
      topPercent: number;
      tier: string;
      badgeMarkdown: string;
    } | null = null;
    try {
      const layer = await getServerDataLayer();
      const cost = Number(ccData.totals?.totalCost) || 0;
      const [rank, site] = await Promise.all([
        layer.submissions.getGlobalRank(cost),
        layer.stats.getSiteStats(),
      ]);
      const totalDevelopers = site?.totalUsers ?? 0;
      standing = {
        rank,
        totalDevelopers,
        // Ceil so nobody is ever told they are "top 0%".
        topPercent: totalDevelopers > 0 ? Math.max(1, Math.ceil((rank / totalDevelopers) * 100)) : 0,
        tier: getTier(cost).name,
        badgeMarkdown: badgeMarkdown(githubUsername),
      };
    } catch {
      // A nicety. Never fail an accepted submission over it.
    }

    return NextResponse.json({
      success: true,
      submissionId,
      message: `Successfully submitted data for ${githubUsername}`,
      profileUrl: profileUrl(githubUsername),
      standing,
      // The grey line the CLI prints after a successful submission: a fix an
      // older CLI's user needs to hear about, a paid sponsor, or the house
      // promo (see submitNotice).
      notice: submitNotice({
        cliVersion,
        tokenVerified: Boolean(tokenOwner),
        paidNotice: getPaidCliNotice(),
        houseNotice: TAKO_CLI_NOTICE,
      }),
      // Only for submissions that did not carry a token — i.e. someone who
      // has no way to submit on a schedule yet. It disappears the moment they
      // set one up, so it nags exactly once per person rather than forever.
      //
      // This is the only channel that reaches people who already submitted:
      // 94% of them never return to the site, and 70% never signed in, so
      // there is no email and no session to reach them through. Running the
      // CLI is the one moment they are addressable.
      hint: tokenOwner
        ? null
        : "Claude Code deletes session history after 30 days by default — what you send here outlives it. Run `npx viberank-cli login` then `npx viberank-cli autosubmit` to keep a daily backup.",
    });

  } catch (error) {
    console.error("Submission error:", error);
    if (error instanceof Error) {
      console.error("Detailed error:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }

    // Only genuine problems with the submitted payload are a 400: a "Failed
    // to query/update/create" is our fault, not the user's, and telling them
    // to fix cc.json for it sends them chasing a file that was always valid
    // (#93). submitErrorResponse makes that call from the error's type.
    const { status, body, headers } = submitErrorResponse(error);
    return NextResponse.json(body, { status, headers });
  }
}

// Support OPTIONS for CORS if needed
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-GitHub-User, X-Machine-Id, X-CLI-Version, X-Viberank-Client",
    },
  });
}
