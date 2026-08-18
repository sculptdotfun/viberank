import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerDataLayer } from "@/lib/data";

// Create a league. Identity comes from the GitHub OAuth session; the creator
// becomes the first member and the only holder of the invite code until they
// share it.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

  let name: string;
  try {
    const body = await request.json();
    if (typeof body.name !== "string") throw new Error("bad payload");
    name = body.name;
  } catch {
    return NextResponse.json({ error: "Expected JSON body: { name: string }" }, { status: 400 });
  }

  try {
    const dataLayer = await getServerDataLayer();
    const { league, inviteCode } = await dataLayer.leagues.create(name, session.user.username);
    return NextResponse.json({ success: true, league, inviteCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create league.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// The signed-in user's leagues, for the /leagues landing page.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return NextResponse.json({ leagues: [] });
  }
  const dataLayer = await getServerDataLayer();
  const leagues = await dataLayer.leagues.listForUser(session.user.username);
  return NextResponse.json({ leagues });
}
