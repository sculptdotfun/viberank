import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/db/operations";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sortBy') as 'cost' | 'tokens' || 'cost';
    const limit = parseInt(searchParams.get('limit') || '100');
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const includeFlagged = searchParams.get('includeFlagged') === 'true';

    const submissions = await getLeaderboard({
      sortBy,
      limit,
      dateFrom,
      dateTo,
      includeFlagged,
    });

    return NextResponse.json(submissions);
  } catch (error) {
    console.error("Leaderboard API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard data" },
      { status: 500 }
    );
  }
}