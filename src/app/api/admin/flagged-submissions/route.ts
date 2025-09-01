import { NextRequest, NextResponse } from "next/server";
import { getFlaggedSubmissions } from "@/lib/db/operations";

export async function GET(request: NextRequest) {
  try {
    const submissions = await getFlaggedSubmissions();
    return NextResponse.json(submissions);
  } catch (error) {
    console.error("Admin flagged submissions API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch flagged submissions" },
      { status: 500 }
    );
  }
}