import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerDataLayer } from "@/lib/data";

// Delete one of your own submissions (#127). The data layer's filter is the
// ownership guard: the row must carry the session username directly or via
// claimed_by, so there is no path to deleting someone else's data.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid submission id." }, { status: 400 });
  }

  const dataLayer = await getServerDataLayer();
  const deleted = await dataLayer.submissions.deleteOwn(session.user.username, id);
  if (!deleted) {
    return NextResponse.json(
      { error: "No such submission on your profile." },
      { status: 404 }
    );
  }
  return NextResponse.json({ success: true });
}
