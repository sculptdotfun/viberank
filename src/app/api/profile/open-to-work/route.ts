import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerDataLayer } from "@/lib/data";

// Toggle the signed-in user's own open-to-work flag. Identity comes from the
// GitHub OAuth session only — there is no way to set this for someone else.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

  let open: boolean;
  try {
    const body = await request.json();
    if (typeof body.open !== "boolean") throw new Error("bad payload");
    open = body.open;
  } catch {
    return NextResponse.json({ error: "Expected JSON body: { open: boolean }" }, { status: 400 });
  }

  const dataLayer = await getServerDataLayer();
  const result = await dataLayer.profiles.setOpenToWork(session.user.username, open);

  if (!result.success) {
    return NextResponse.json({ error: result.error || "Update failed" }, { status: 400 });
  }
  return NextResponse.json({ success: true, open });
}
