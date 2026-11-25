// Response helpers for the public /api/v2 routes: open CORS for GET like
// /api/leaderboard, and CDN caching with stale-while-revalidate.

import { NextResponse } from "next/server";
import { CACHE } from "./query";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export function v2Json(body: unknown, status = 200, cache: string = CACHE.live): NextResponse {
  return NextResponse.json(body, { status, headers: { ...CORS, "Cache-Control": cache } });
}

// No body: a 204 that carries one makes the Response constructor throw.
export function v2Options(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export function v2Unavailable(what: string, error: unknown): NextResponse {
  console.error(`${what} failed:`, error);
  // Not cached: a blip shouldn't be served from the CDN.
  return v2Json({ error: `${what} is temporarily unavailable. Please try again shortly.` }, 503, CACHE.none);
}
