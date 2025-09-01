import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const DATABASE_URL = process.env.DATABASE_URL;

export async function GET(request: NextRequest) {
  const checks = {
    api: "ok",
    databaseUrl: DATABASE_URL ? "configured" : "missing",
    databaseConnection: "unknown",
    timestamp: new Date().toISOString(),
  };

  // Check if Database URL is configured
  if (!DATABASE_URL) {
    return NextResponse.json(
      {
        ...checks,
        databaseUrl: "missing",
        databaseConnection: "failed",
        error: "DATABASE_URL environment variable is not set",
      },
      { status: 503 }
    );
  }

  // Try to connect to PostgreSQL
  try {
    // Simple query to test connection
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database health check timed out")), 5000)
    );
    
    const queryPromise = getDb().execute('SELECT 1 as test');
    
    await Promise.race([queryPromise, timeoutPromise]);
    
    checks.databaseConnection = "ok";
    
    return NextResponse.json(checks, { status: 200 });
  } catch (error: any) {
    console.error("Health check failed:", {
      error: error?.message || error,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      {
        ...checks,
        databaseConnection: "failed",
        error: error?.message || "Failed to connect to database",
        hint: "Check PostgreSQL connection and DATABASE_URL",
      },
      { status: 503 }
    );
  }
}