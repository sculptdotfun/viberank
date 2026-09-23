import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerDataLayer } from "@/lib/data";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.username) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const dataLayer = await getServerDataLayer();
    const result = await dataLayer.submissions.claimAndMergeSubmissions(
      session.user.username
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Claim/merge error:", { username: session.user.username, message });

    if (message === "No submissions found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to claim and merge submissions" },
      { status: 500 }
    );
  }
}
