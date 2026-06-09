import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerDataLayer } from "@/lib/data";
import { isAdmin } from "@/lib/admin";

/**
 * Admin-only: flag / unflag a submission. Runs server-side with the
 * service-role data layer so writes don't go browser->Supabase with the anon
 * key (which RLS blocks — the silent-failure bug class of #42/#47).
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.username)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: { id?: unknown; flagged?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, flagged, reason } = body;
  if (typeof id !== "string" || typeof flagged !== "boolean") {
    return NextResponse.json(
      { error: "`id` (string) and `flagged` (boolean) are required" },
      { status: 400 }
    );
  }

  try {
    const dataLayer = await getServerDataLayer();
    const result = await dataLayer.submissions.updateFlagStatus(
      id,
      flagged,
      typeof reason === "string" ? reason : undefined
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Admin flag error:", {
      admin: session?.user?.username,
      id,
      flagged,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to update flag status" },
      { status: 500 }
    );
  }
}
