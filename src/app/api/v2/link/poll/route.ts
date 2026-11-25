import { NextRequest, NextResponse } from "next/server";
import { pollLink } from "@/lib/link-flow";
import { getLinkBackend } from "@/lib/link-server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * The CLI's poll. Always 200 with a status, so the client is one switch:
 * pending | slow_down | expired (with a reason) | approved (token, once).
 * Not rate-limited by IP: the device code is 256 bits, slow_down throttles
 * each one, and a limiter check costs more queries than the poll itself.
 */
export async function POST(request: NextRequest) {
  let deviceCode: unknown;
  try {
    deviceCode = (await request.json())?.deviceCode;
  } catch {
    return NextResponse.json({ error: "Send JSON: { deviceCode }" }, { status: 400, headers: NO_STORE });
  }
  try {
    const backend = await getLinkBackend();
    const result = await pollLink(backend.store, deviceCode, { now: Date.now(), issueToken: backend.issueToken });
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    console.error("[link/poll]", error instanceof Error ? error.message : error);
    // Retryable: a failed mint puts the link back to approved.
    return NextResponse.json({ error: "Temporary problem; keep polling." }, { status: 503, headers: NO_STORE });
  }
}
