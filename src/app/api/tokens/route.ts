import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerDataLayer } from "@/lib/data";

/**
 * Token management. Session-authenticated only — a token can never be used to
 * mint another token, so a leaked token cannot escalate into a permanent
 * foothold; revoking it ends the access.
 */

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

  const dataLayer = await getServerDataLayer();
  const tokens = await dataLayer.tokens.list(session.user.username);
  return NextResponse.json({ tokens });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

  let label = "CLI";
  try {
    const body = await request.json();
    if (typeof body?.label === "string" && body.label.trim()) label = body.label.trim();
  } catch {
    // No body is fine — the label is cosmetic.
  }

  const dataLayer = await getServerDataLayer();

  try {
    const { plaintext, token } = await dataLayer.tokens.issue(
      session.user.username,
      session.user.username,
      label
    );

    // The one and only time the plaintext leaves the server.
    return NextResponse.json({
      token: plaintext,
      ...token,
      notice: "Copy this now — it is hashed on save and cannot be shown again.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to issue token";
    console.error("Token issue failed:", message);
    return NextResponse.json(
      { error: "Could not issue a token. If this persists, the api_tokens migration may not be applied." },
      { status: 503 }
    );
  }
}
