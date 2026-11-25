import { NextRequest, NextResponse } from "next/server";
import { clientIp } from "@/lib/link";
import { startLink } from "@/lib/link-flow";
import { getLinkBackend } from "@/lib/link-server";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** Begin a terminal sign-in: a code to show, and a secret to poll with. */
export async function POST(request: NextRequest) {
  try {
    const backend = await getLinkBackend();
    const wait = await backend.limit("linkStart", clientIp(request.headers));
    if (wait !== null) {
      return NextResponse.json(
        { error: `Too many sign-in attempts from this network. Try again in ${Math.ceil(wait / 60)} minutes.`, retryAfter: wait },
        { status: 429, headers: { ...NO_STORE, "Retry-After": String(wait) } }
      );
    }
    const start = await startLink(backend.store, { now: Date.now(), site: SITE_URL });
    return NextResponse.json(start, { headers: NO_STORE });
  } catch (error) {
    console.error("[link/start]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not start a sign-in. Try again in a minute." }, { status: 503, headers: NO_STORE });
  }
}
