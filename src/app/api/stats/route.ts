import { NextRequest, NextResponse } from "next/server";
import { getGlobalStats } from "@/lib/db/operations";

export async function GET(request: NextRequest) {
  try {
    const stats = await getGlobalStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Stats API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch global statistics" },
      { status: 500 }
    );
  }
}