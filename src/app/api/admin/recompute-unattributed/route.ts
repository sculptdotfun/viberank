import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getDatabaseBackend } from "@/lib/data";
import { recomputeUnattributedDays } from "@/lib/data/supabase/client";

/**
 * Admin-only: bring stored days with an unattributed slice beside id'd ones
 * in line with the per-model aggregation rule. `{ "apply": false }` (the
 * default) reports what would change; `{ "apply": true, "limit": 50 }`
 * writes the largest changes first. It is idempotent, so repeat until the
 * report is empty rather than risk the function time limit in one call.
 *
 * Service role: it reads machine_contributions, which anon can't (017).
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.username)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  if (getDatabaseBackend() !== "supabase") {
    return NextResponse.json({ error: "Only the Supabase backend stores per-machine slices" }, { status: 400 });
  }

  let body: { apply?: unknown; limit?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // an empty body is a dry run
  }
  const apply = body.apply === true;
  const limit =
    typeof body.limit === "number" && Number.isInteger(body.limit) && body.limit > 0 ? body.limit : 50;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
  }

  try {
    const report = await recomputeUnattributedDays(createClient(url, serviceKey), { apply, limit });
    const pending = report.filter((r) => !r.applied);
    return NextResponse.json({
      apply,
      applied: report.length - pending.length,
      pending: pending.length,
      addedCost: pending.reduce((acc, r) => acc + r.costAfter - r.costBefore, 0),
      report,
    });
  } catch (error) {
    console.error("Recompute unattributed failed:", {
      admin: session?.user?.username,
      apply,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Recompute failed" }, { status: 500 });
  }
}
