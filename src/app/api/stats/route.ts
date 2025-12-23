import { NextRequest, NextResponse } from "next/server";
import { getGlobalStats } from "@/lib/db/operations";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;

    const stats = await getGlobalStats({ dateFrom, dateTo });
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Stats API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch global statistics" },
      { status: 500 }
    );
  }
}