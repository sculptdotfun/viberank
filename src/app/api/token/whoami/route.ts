import { NextRequest, NextResponse } from "next/server";
import { getServerDataLayer } from "@/lib/data";
import { whoamiFor } from "@/lib/tokens";

/**
 * GET with `Authorization: Bearer vbr_…` → `{ username }` of the token's
 * owner, or 401. Lets the CLI show who a token-signed submission will be filed
 * under before it uploads (#181). Uses the same resolver as /api/submit, so the
 * only write is the token's last-used time.
 */
export async function GET(request: NextRequest) {
  const result = await whoamiFor(request.headers.get("authorization"), async (token) => {
    const dataLayer = await getServerDataLayer();
    return dataLayer.tokens.resolve(token);
  });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
