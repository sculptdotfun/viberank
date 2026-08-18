import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerDataLayer } from "@/lib/data";

// Join a league by invite code. Idempotent for existing members.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

  let code: string;
  try {
    const body = await request.json();
    if (typeof body.code !== "string" || !body.code.trim()) throw new Error("bad payload");
    code = body.code.trim();
  } catch {
    return NextResponse.json({ error: "Expected JSON body: { code: string }" }, { status: 400 });
  }

  try {
    const dataLayer = await getServerDataLayer();
    const league = await dataLayer.leagues.joinByCode(code, session.user.username);
    return NextResponse.json({ success: true, league });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not join league.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
