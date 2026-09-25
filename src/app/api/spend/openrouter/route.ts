import { NextRequest, NextResponse } from "next/server";
import { getServerDataLayer } from "@/lib/data";
import { bearerFrom } from "@/lib/tokens";
import { validateSpendPayload } from "@/lib/real-spend";
import { profileUrl } from "@/lib/site";

/**
 * POST /api/spend/openrouter — publish real OpenRouter spend from the CLI.
 *
 * Bearer API token only. No session cookie and no X-GitHub-User: this puts a
 * money figure on someone's public profile, so it must be signed by that
 * someone. The token's owner is the only identity the body can write to.
 *
 * Stored in its own ledger (migration 023) and never added to submissions:
 * OpenRouter traffic from tools like OpenCode is already in the ccusage logs
 * the board ranks, so adding it there would count it twice.
 */

/** 31 days × 200 models of short JSON is well under this; anything bigger is not a sync. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const bearer = bearerFrom(request.headers.get("authorization"));
  if (!bearer) {
    return NextResponse.json(
      { error: "Publishing spend needs an API token. Run `npx viberank-cli login`, then `npx viberank-cli openrouter`." },
      { status: 401 }
    );
  }

  const dataLayer = await getServerDataLayer();
  const owner = await dataLayer.tokens.resolve(bearer);
  if (!owner) {
    return NextResponse.json(
      { error: "Invalid or revoked API token. Run `npx viberank-cli login` to get a new one." },
      { status: 401 }
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Validated before the rate limiter runs (inside the data layer), so a
  // rejected payload doesn't spend a sync slot.
  const result = validateSpendPayload(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Same identity the submit route writes under for a token.
  const username = owner.githubUsername;
  try {
    const { days } = await dataLayer.spend.upsertRealSpend(username, "openrouter", result.value);
    return NextResponse.json({
      success: true,
      days,
      scope: result.value.scope,
      profileUrl: profileUrl(username),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Rate limit exceeded")) {
      const waitMatch = message.match(/wait (\d+) seconds/);
      const waitSeconds = waitMatch ? parseInt(waitMatch[1], 10) : 60;
      return NextResponse.json(
        { error: message, retryAfter: waitSeconds },
        { status: 429, headers: { "Retry-After": String(waitSeconds) } }
      );
    }
    // Don't echo the database message: it can name tables and columns.
    console.error("Real spend upsert failed:", message);
    return NextResponse.json(
      { error: "Could not store spend right now. Please try again later." },
      { status: 503 }
    );
  }
}
