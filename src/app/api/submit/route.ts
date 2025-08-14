import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { getServerSession } from "next-auth";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const ccData = await request.json();
    
    // Check for authentication
    const session = await getServerSession();
    
    let githubUsername: string;
    let source: "oauth" | "cli";
    let verified: boolean;
    
    if (session?.user?.username) {
      // Authenticated via OAuth
      githubUsername = session.user.username;
      source = "oauth";
      verified = true;
    } else {
      // CLI submission
      githubUsername = request.headers.get("X-GitHub-User") || "anonymous";
      source = "cli";
      verified = false;
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
      source: source,
      verified: verified,
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
    
    // Provide specific error messages for validation errors
    if (error instanceof Error) {
      // Handle validation errors with 400 status
      const validationErrors = [
        "Token totals don't match",
        "Invalid date format",
        "Future date detected",
        "Negative values are not allowed",
        "exceed realistic limits",
        "Cost per token ratio is unrealistic",
        "Token components don't sum correctly"
      ];
      
      if (validationErrors.some(msg => error.message.includes(msg))) {
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
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-GitHub-User",
    },
  });
}