import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getServerDataLayer, getDatabaseBackend } from "@/lib/data";

export async function POST(request: NextRequest) {
  try {
    const backend = getDatabaseBackend();

    // Log request details for debugging
    const cliVersion = request.headers.get("X-CLI-Version");
    console.log("Submission request received:", {
      cliVersion: cliVersion || "unknown",
      userAgent: request.headers.get("user-agent"),
      contentType: request.headers.get("content-type"),
      contentLength: request.headers.get("content-length"),
      url: request.url,
      method: request.method,
      backend,
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

    // Check if ccData is null or undefined
    if (!ccData || typeof ccData !== 'object') {
      console.error("Invalid cc.json data: ccData is null or not an object", {
        ccData: ccData,
        type: typeof ccData
      });
      return NextResponse.json(
        { error: "Invalid submission data. Please ensure your cc.json file contains valid data." },
        { status: 400 }
      );
    }

    // Validate the cc.json structure
    if (!ccData.daily || !ccData.totals) {
      console.error("Invalid cc.json structure:", {
        hasDaily: !!ccData.daily,
        hasTotals: !!ccData.totals,
        keys: Object.keys(ccData || {})
      });
      return NextResponse.json(
        { error: "Invalid cc.json format. Missing 'daily' or 'totals' field. Please regenerate using: npx ccusage@latest --json > cc.json" },
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

    // Log submission details before sending to database
    console.log("Submitting to database:", {
      username: githubUsername,
      source: source,
      verified: verified,
      dataSize: JSON.stringify(ccData).length,
      dailyCount: ccData.daily?.length || 0,
      totals: ccData.totals,
      backend,
    });

    // Submit using data layer with timeout handling
    let submissionId;
    try {
      const dataLayer = await getServerDataLayer();

      const submissionPromise = dataLayer.submissions.submit({
        username: githubUsername,
        githubUsername: githubUsername,
        source: source,
        verified: verified,
        ccData: ccData,
      });

      // Add a timeout of 25 seconds (Vercel has a 30 second timeout for API routes)
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Database operation timed out")), 25000)
      );

      submissionId = await Promise.race([submissionPromise, timeoutPromise]);
    } catch (dbError: any) {
      console.error("Database mutation error:", {
        message: dbError?.message,
        data: dbError?.data,
        code: dbError?.code,
        stack: dbError?.stack,
        errorType: typeof dbError,
        errorString: String(dbError),
        backend,
      });

      // Extract meaningful error message
      let errorMessage = "Database operation failed";

      if (dbError?.message) {
        errorMessage = dbError.message;
      } else if (typeof dbError === 'string') {
        errorMessage = dbError;
      } else if (dbError?.data?.message) {
        errorMessage = dbError.data.message;
      }

      // Log additional context for Server Error
      if (errorMessage.includes("Server Error")) {
        console.error("Database Server Error - Potential causes:");
        console.error("1. Database service outage or degraded performance");
        console.error("2. Data validation issue that passed client but failed on server");
        console.error("3. Database quota or rate limiting");
        console.error("4. Network connectivity issues");
        console.error("Backend:", backend);
        console.error("Submission data size:", JSON.stringify(ccData).length, "bytes");
      }

      throw new Error(errorMessage);
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

      // Handle rate limit errors
      if (error.message.includes("Rate limit exceeded")) {
        console.error("Rate limit error:", error.message);
        // Extract wait time from error message if present
        const waitMatch = error.message.match(/wait (\d+) seconds/);
        const waitSeconds = waitMatch ? parseInt(waitMatch[1]) : 60;
        return NextResponse.json(
          {
            error: error.message,
            retryAfter: waitSeconds
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(waitSeconds),
              'X-RateLimit-Limit': '1',
              'X-RateLimit-Remaining': '0',
            }
          }
        );
      }

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

      // Check for timeout or database-specific errors
      if (error.message.includes("timeout") || error.message.includes("deadline")) {
        return NextResponse.json(
          { error: "Request timed out. Please try again or submit smaller batches of data." },
          { status: 504 }
        );
      }

      // Handle authentication/configuration errors
      if (error.message.includes("Unauthenticated") || error.message.includes("authentication")) {
        console.error("Database authentication error - check configuration");
        return NextResponse.json(
          { error: "Server configuration error. The service is temporarily unavailable. Please try again later." },
          { status: 503 }
        );
      }

      // Handle server errors more specifically
      if (error.message.includes("Server Error")) {
        return NextResponse.json(
          {
            error: "The database service is temporarily unavailable. Please try again in a few moments.",
            details: "This is usually a temporary issue with the database service. If it persists for more than 5 minutes, please report it.",
            retryAdvice: "Wait 30 seconds and try submitting again."
          },
          { status: 503 }
        );
      }

      if (error.message.includes("mutation") || error.message.includes("query")) {
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
      constructor: (error as any)?.constructor?.name,
      message: (error as any)?.message || (error as any)?.toString(),
    });

    // Provide more detailed error message for unknown errors
    const errorMessage = error instanceof Error
      ? error.message
      : (typeof error === 'string' ? error : 'Unknown error occurred');

    // If the error message contains useful information, include it
    if (errorMessage && !errorMessage.includes('undefined') && errorMessage.length < 200) {
      return NextResponse.json(
        { error: `Submission failed: ${errorMessage}. Please try again or contact support if the issue persists.` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to submit data. Please check your cc.json file format and try again. If this issue persists, please contact support." },
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
