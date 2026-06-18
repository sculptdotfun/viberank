import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerDataLayer } from "@/lib/data";
import { normalizeWorkEmail } from "@/lib/open-to-work";

// Toggle the signed-in user's own open-to-work flag. Identity comes from the
// GitHub OAuth session only — there is no way to set this for someone else.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

  let open: boolean;
  let workEmail: string | null;
  try {
    const body = await request.json();
    if (typeof body.open !== "boolean") throw new Error("bad payload");
    open = body.open;
    workEmail = open ? normalizeWorkEmail(body.email) : null;
  } catch (error) {
    const message = error instanceof Error && error.message !== "bad payload"
      ? error.message
      : "Expected JSON body: { open: boolean, email?: string }";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const dataLayer = await getServerDataLayer();
  const result = await dataLayer.profiles.setOpenToWork(session.user.username, open, workEmail);

  if (!result.success) {
    return NextResponse.json({ error: result.error || "Update failed" }, { status: 400 });
  }
  return NextResponse.json({ success: true, open, email: workEmail });
}
