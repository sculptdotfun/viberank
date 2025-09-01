import { NextRequest, NextResponse } from "next/server";
import { createSubmission } from "@/lib/db/operations";

export async function POST(request: NextRequest) {
  try {
    
    // Log request details for debugging
    const cliVersion = request.headers.get("X-CLI-Version");
    console.log("Submission request received:", {
      cliVersion: cliVersion || "unknown",
      userAgent: request.headers.get("user-agent"),
      contentType: request.headers.get("content-type"),
      contentLength: request.headers.get("content-length"),
      url: request.url,
      method: request.method,
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
    
    // Get email from header (CLI) or web form
    const email = request.headers.get("X-User-Email") || "anonymous";
    const source: "cli" | "web" = request.headers.get("X-User-Email") ? "cli" : "web";
    const verified = false; // Remove automatic verification since no auth
    
    console.log("Submission from:", email, "via", source);
    
    // Validate submission has proper email
    if (email === "anonymous" || !email) {
      return NextResponse.json(
        { error: "Email address is required. Please provide X-User-Email header." },
        { status: 400 }
      );
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format. Please provide a valid email address." },
        { status: 400 }
      );
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
      email: email,
      source: source,
      verified: verified,
      dataSize: JSON.stringify(ccData).length,
      dailyCount: ccData.daily?.length || 0,
      totals: ccData.totals,
    });
    
    // Submit to database with timeout handling
    let submissionId;
    try {
      submissionId = await createSubmission({
        username: email,
        email: email,
        source: source,
        verified: verified,
        ccData: ccData,
      });
    } catch (dbError: any) {
      console.error("Database error:", {
        message: dbError?.message,
        data: dbError?.data,
        code: dbError?.code,
        stack: dbError?.stack,
        errorType: typeof dbError,
        errorString: String(dbError),
        fullError: JSON.stringify(dbError, Object.getOwnPropertyNames(dbError))
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
      
      // Re-throw with more context
      const enhancedError = new Error(errorMessage);
      throw enhancedError;
    }
    
    return NextResponse.json({
      success: true,
      submissionId,
      message: `Successfully submitted data for ${email}`,
      profileUrl: `https://viberank.app/profile/${encodeURIComponent(email)}`
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
      
      // Handle database connection errors
      if (error.message.includes("connection") || error.message.includes("connect")) {
        return NextResponse.json(
          { error: "Database connection error. The service is temporarily unavailable. Please try again later." },
          { status: 503 }
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
      message: error?.message || error?.toString(),
      stringified: JSON.stringify(error, Object.getOwnPropertyNames(error))
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

// Allowed development origins for CORS
const allowedDevOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001", 
  "http://127.0.0.1:3001",
  "http://35.175.206.198",
  "http://35.175.206.198:3000",
  "http://35.175.206.198:3001"
];

// Support OPTIONS for CORS if needed
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowedOrigin = process.env.NODE_ENV === "development" && origin && allowedDevOrigins.includes(origin) 
    ? origin 
    : "*";

  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-User-Email",
    },
  });
}