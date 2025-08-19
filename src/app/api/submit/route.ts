import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { getServerSession } from "next-auth";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    // Check request size (Vercel has a 4.5MB limit for API routes)
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 4.5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Request body too large. Please submit data in smaller batches." },
        { status: 413 }
      );
    }
    
    // Parse the request body
    let ccData;
    try {
      ccData = await request.json();
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON format. Please ensure your cc.json file is valid JSON." },
        { status: 400 }
      );
    }
    
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
    
    // Submit to Convex with timeout handling
    const submissionPromise = convex.mutation(api.submissions.submit, {
      username: githubUsername,
      githubUsername: githubUsername,
      source: source,
      verified: verified,
      ccData: ccData,
    });
    
    // Add a timeout of 25 seconds (Vercel has a 30 second timeout for API routes)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Database operation timed out")), 25000)
    );
    
    const submissionId = await Promise.race([submissionPromise, timeoutPromise]);
    
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
      
      // Log more detailed error for debugging
      console.error("Detailed error:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Check for timeout or Convex-specific errors
      if (error.message.includes("timeout") || error.message.includes("deadline")) {
        return NextResponse.json(
          { error: "Request timed out. Please try again or submit smaller batches of data." },
          { status: 504 }
        );
      }
      
      if (error.message.includes("Convex") || error.message.includes("mutation")) {
        return NextResponse.json(
          { error: `Database error: ${error.message}` },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Failed to submit data. Please check your cc.json file format and try again." },
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