import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerDataLayer } from "@/lib/data";
import { isAdmin } from "@/lib/admin";

/**
 * Admin-only: clear a submission's automatic "under review" marks (#183) once
 * a maintainer has looked. Unlike /api/admin/flag this never hides anything;
 * it only removes the badge. New unusual usage can mark the row again.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.username)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: { id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.id !== "string") {
    return NextResponse.json({ error: "`id` (string) is required" }, { status: 400 });
  }

  try {
    const dataLayer = await getServerDataLayer();
    return NextResponse.json(await dataLayer.submissions.clearReview(body.id));
  } catch (error) {
    console.error("Admin review clear error:", {
      admin: session?.user?.username,
      id: body.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to clear review" }, { status: 500 });
  }
}
