import { NextRequest, NextResponse } from "next/server";
import { getServerDataLayer, getDatabaseBackend } from "@/lib/data";

export async function GET(request: NextRequest) {
  const backend = getDatabaseBackend();

  const checks = {
    api: "ok",
    backend,
    backendConnection: "unknown",
    timestamp: new Date().toISOString(),
  };

  // Try to connect to the database
  try {
    const dataLayer = await getServerDataLayer();

    // Simple query to test connection - get leaderboard with limit 1
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Health check timed out")), 5000)
    );

    const queryPromise = dataLayer.submissions.getLeaderboard({ pageSize: 1 });

    await Promise.race([queryPromise, timeoutPromise]);

    checks.backendConnection = "ok";

    return NextResponse.json(checks, { status: 200 });
  } catch (error: any) {
    console.error("Health check failed:", {
      error: error?.message || error,
      backend,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        ...checks,
        backendConnection: "failed",
        error: error?.message || "Failed to connect to database",
        hint: `Check ${backend === "convex" ? "Convex" : "Supabase"} dashboard for service status`,
      },
      { status: 503 }
    );
  }
}
