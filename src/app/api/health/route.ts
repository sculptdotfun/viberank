import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

export async function GET(request: NextRequest) {
  const checks = {
    api: "ok",
    convexUrl: CONVEX_URL ? "configured" : "missing",
    convexConnection: "unknown",
    timestamp: new Date().toISOString(),
  };

  // Check if Convex URL is configured
  if (!CONVEX_URL) {
    return NextResponse.json(
      {
        ...checks,
        convexUrl: "missing",
        convexConnection: "failed",
        error: "NEXT_PUBLIC_CONVEX_URL environment variable is not set",
      },
      { status: 503 }
    );
  }

  // Try to connect to Convex
  try {
    const convex = new ConvexHttpClient(CONVEX_URL);
    
    // Simple query to test connection - get leaderboard with limit 1
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Convex health check timed out")), 5000)
    );
    
    const queryPromise = convex.query(api.submissions.getLeaderboard, { limit: 1 });
    
    await Promise.race([queryPromise, timeoutPromise]);
    
    checks.convexConnection = "ok";
    
    return NextResponse.json(checks, { status: 200 });
  } catch (error: any) {
    console.error("Health check failed:", {
      error: error?.message || error,
      convexUrl: CONVEX_URL,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      {
        ...checks,
        convexConnection: "failed",
        error: error?.message || "Failed to connect to Convex",
        hint: "Check Convex dashboard for service status",
      },
      { status: 503 }
    );
  }
}