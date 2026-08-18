import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerDataLayer } from "@/lib/data";

// The invite code, revealed only to current members — it's the sole gate on
// joining, so it never renders into the public page HTML.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

  const { slug } = await params;
  const dataLayer = await getServerDataLayer();
  const code = await dataLayer.leagues.getInviteCode(slug, session.user.username);
  if (!code) {
    return NextResponse.json({ error: "Members only." }, { status: 403 });
  }
  return NextResponse.json({ code });
}
