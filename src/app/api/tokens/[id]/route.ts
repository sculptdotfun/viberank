import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerDataLayer } from "@/lib/data";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

  const { id } = await params;
  const dataLayer = await getServerDataLayer();

  // Scoped to the session's username inside the data layer, so a guessed uuid
  // from another account revokes nothing and is reported as not found.
  const revoked = await dataLayer.tokens.revoke(session.user.username, id);
  if (!revoked) {
    return NextResponse.json({ error: "Token not found." }, { status: 404 });
  }

  return NextResponse.json({ revoked: true });
}
