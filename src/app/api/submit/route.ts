import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const ccData = await request.json();
    
    // Get GitHub username from header or try to extract from data
    let githubUsername = request.headers.get("X-GitHub-User");
    
    // If no username in header, try to extract from git remote URL pattern
    if (!githubUsername) {
      // Try to parse username from common patterns in the data
      // This is a fallback - header is preferred
      githubUsername = "anonymous";
    }
    
    // Validate the cc.json structure
    if (!ccData.daily || !ccData.totals) {
      return NextResponse.json(
        { error: "Invalid cc.json format. Missing 'daily' or 'totals' field." },
        { status: 400 }
      );
    }
    
    // Submit to Convex
    const submissionId = await convex.mutation(api.submissions.submit, {
      username: githubUsername,
      githubUsername: githubUsername,
      ccData: ccData,
    });
    
    return NextResponse.json({
      success: true,
      submissionId,
      message: `Successfully submitted data for ${githubUsername}`,
      profileUrl: `https://viberank.app/profile/${githubUsername}`
    });
    
  } catch (error) {
    console.error("Submission error:", error);
    
    // Provide specific error messages
    if (error instanceof Error) {
      if (error.message.includes("Token totals don't match")) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      if (error.message.includes("Invalid date format")) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Failed to submit data. Please check your cc.json file format." },
      { status: 500 }
    );
  }
}

// Support OPTIONS for CORS if needed
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-GitHub-User",
    },
  });
}