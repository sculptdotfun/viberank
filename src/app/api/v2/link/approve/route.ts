import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { approveLink } from "@/lib/link-flow";
import { getLinkBackend } from "@/lib/link-server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Approve a terminal's code for the signed-in GitHub account. Session only.
 * JSON only too: a cross-site form cannot send application/json without a
 * preflight, and the session cookie is SameSite=Lax, so this cannot be
 * triggered from another site.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const username = session?.user?.username;
  if (!username) {
    return NextResponse.json({ error: "Sign in with GitHub first.", code: "signin" }, { status: 401, headers: NO_STORE });
  }
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return NextResponse.json({ error: "Send JSON: { userCode }" }, { status: 415, headers: NO_STORE });
  }

  let userCode: unknown;
  try {
    userCode = (await request.json())?.userCode;
  } catch {
    return NextResponse.json({ error: "Send JSON: { userCode }" }, { status: 400, headers: NO_STORE });
  }

  try {
    const backend = await getLinkBackend();
    const wait = await backend.limit("linkApprove", username.toLowerCase());
    if (wait !== null) {
      return NextResponse.json(
        { error: "Too many tries. Wait a few minutes and run npx viberank-cli login again.", code: "rate" },
        { status: 429, headers: { ...NO_STORE, "Retry-After": String(wait) } }
      );
    }
    const result = await approveLink(backend.store, userCode, username, { now: Date.now(), claim: backend.claim });
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status, headers: NO_STORE });
    }
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    console.error("[link/approve]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not approve right now. Try again in a minute." }, { status: 503, headers: NO_STORE });
  }
}
