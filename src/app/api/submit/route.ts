import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { getServerSession } from "next-auth";

// Initialize Convex client with error handling
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("NEXT_PUBLIC_CONVEX_URL is not set!");
}
const convex = new ConvexHttpClient(CONVEX_URL || "");

export async function POST(request: NextRequest) {
  try {
    // Check if Convex URL is configured
    if (!CONVEX_URL) {
      console.error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
      return NextResponse.json(
        { error: "Server configuration error. Please contact support." },
        { status: 500 }
      );
    }
    
    // Log request details for debugging
    console.log("Submission request received:", {
      headers: Object.fromEntries(request.headers.entries()),
      url: request.url,
      method: request.method,
      convexUrl: CONVEX_URL,
    });
    
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
      console.log("OAuth submission from:", githubUsername);
    } else {
      // CLI submission
      githubUsername = request.headers.get("X-GitHub-User") || "anonymous";
      source = "cli";
      verified = false;
      console.log("CLI submission from:", githubUsername);
      
      // Validate CLI submission has proper username
      if (githubUsername === "anonymous" || !githubUsername) {
        return NextResponse.json(
          { error: "GitHub username is required for CLI submissions. Please provide X-GitHub-User header." },
          { status: 400 }
        );
      }
    }
    
    // Validate the cc.json structure
    if (!ccData.daily || !ccData.totals) {
      console.error("Invalid cc.json structure:", {
        hasDaily: !!ccData.daily,
        hasTotals: !!ccData.totals,
        keys: Object.keys(ccData || {})
      });
      return NextResponse.json(
        { error: "Invalid cc.json format. Missing 'daily' or 'totals' field." },
        { status: 400 }
      );
    }
    
    // Validate totals structure
    const requiredTotalFields = ['inputTokens', 'outputTokens', 'cacheCreationTokens', 'cacheReadTokens', 'totalCost', 'totalTokens'];
    const missingTotalFields = requiredTotalFields.filter(field => 
      ccData.totals[field] === undefined || ccData.totals[field] === null
    );
    
    if (missingTotalFields.length > 0) {
      console.error("Missing total fields:", missingTotalFields);
      return NextResponse.json(
        { error: `Invalid cc.json format. Missing fields in totals: ${missingTotalFields.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Validate daily entries
    if (!Array.isArray(ccData.daily) || ccData.daily.length === 0) {
      return NextResponse.json(
        { error: "Invalid cc.json format. 'daily' must be a non-empty array." },
        { status: 400 }
      );
    }
    
    // Log submission details before sending to Convex
    console.log("Submitting to Convex:", {
      username: githubUsername,
      source: source,
      verified: verified,
      dataSize: JSON.stringify(ccData).length,
      dailyCount: ccData.daily?.length || 0,
      totals: ccData.totals,
    });
    
    // Submit to Convex with timeout handling
    let submissionId;
    try {
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
      
      submissionId = await Promise.race([submissionPromise, timeoutPromise]);
    } catch (convexError: any) {
      console.error("Convex mutation error:", {
        message: convexError.message,
        data: convexError.data,
        code: convexError.code,
      });
      
      // Re-throw with more context
      throw new Error(convexError.message || "Database operation failed");
    }
    
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
      // Log full error details for debugging
      console.error("Detailed error:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
        errorType: error.constructor.name,
        errorString: error.toString(),
      });
      
      // Handle validation errors with 400 status
      const validationErrors = [
        "Token totals don't match",
        "Invalid date format",
        "Future date detected",
        "Negative values are not allowed",
        "exceed realistic limits",
        "Cost per token ratio is unrealistic",
        "Token components don't sum correctly",
        "Failed to query existing submissions",
        "Failed to update existing submission",
        "Failed to create new submission"
      ];
      
      if (validationErrors.some(msg => error.message.includes(msg))) {
        console.error("Validation error detected:", error.message);
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      
      // Check for timeout or Convex-specific errors
      if (error.message.includes("timeout") || error.message.includes("deadline")) {
        return NextResponse.json(
          { error: "Request timed out. Please try again or submit smaller batches of data." },
          { status: 504 }
        );
      }
      
      // Handle Convex server errors more specifically
      if (error.message.includes("Server Error") && error.message.includes("Request ID")) {
        console.error("Convex Server Error detected. This could be due to:");
        console.error("1. Convex service issues");
        console.error("2. Invalid data that passed client validation");
        console.error("3. Rate limiting or quota issues");
        console.error("4. Network connectivity problems");
        
        // Extract request ID for debugging
        const requestIdMatch = error.message.match(/Request ID: ([a-f0-9]+)/);
        const requestId = requestIdMatch ? requestIdMatch[1] : "unknown";
        
        return NextResponse.json(
          { 
            error: "Database service error. Please try again in a few moments.",
            requestId: requestId,
            hint: "If this persists, please check Convex dashboard for service status."
          },
          { status: 503 }
        );
      }
      
      if (error.message.includes("Convex") || error.message.includes("mutation")) {
        return NextResponse.json(
          { error: `Database error: ${error.message}` },
          { status: 500 }
        );
      }
      
      // Handle database-specific errors
      if (error.message.includes("Failed to query") || 
          error.message.includes("Failed to update") ||
          error.message.includes("Failed to create")) {
        return NextResponse.json(
          { error: "Database operation failed. Please try again later." },
          { status: 503 }
        );
      }
    }
    
    // Log the error type for unknown errors
    console.error("Unknown error type:", {
      error: error,
      isError: error instanceof Error,
      constructor: error?.constructor?.name,
      message: error?.message || error?.toString()
    });
    
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