import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerDataLayer } from "@/lib/data";
import { bearerFrom } from "@/lib/tokens";

async function owner(request: NextRequest) {
  const dataLayer = await getServerDataLayer();
  const bearer = bearerFrom(request.headers.get("authorization"));
  if (bearer) {
    const tokenOwner = await dataLayer.tokens.resolve(bearer);
    return { dataLayer, username: tokenOwner?.githubUsername ?? null };
  }
  const session = await getServerSession(authOptions);
  return { dataLayer, username: session?.user?.username ?? null };
}

function validRange(from: unknown, to: unknown): from is string {
  const day = /^\d{4}-\d{2}-\d{2}$/;
  return typeof from === "string" && typeof to === "string" && day.test(from) &&
    day.test(to) && from <= to && to <= new Date().toISOString().slice(0, 10);
}

/** A failed read or write is a 500 with a message, not a thrown route. */
async function respond(work: () => Promise<unknown>) {
  try {
    return NextResponse.json(await work());
  } catch (error) {
    console.error("Retired machine request failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not update your history. Nothing was changed if this was a preview." }, { status: 500 });
  }
}

const unauthorized = () => NextResponse.json({ error: "Sign in with GitHub or use an API token first." }, { status: 401 });
const invalid = () => NextResponse.json({ error: "Use a valid YYYY-MM-DD range ending no later than today." }, { status: 400 });

export async function GET(request: NextRequest) {
  const { dataLayer, username } = await owner(request);
  if (!username) return unauthorized();
  const url = new URL(request.url);
  // Empty parameters request the full available span, for the initial UI/CLI view.
  const from = url.searchParams.get("from") ?? "0000-01-01";
  const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
  if (!validRange(from, to)) return invalid();
  return respond(() => dataLayer.submissions.previewRetiredMachine(username, from, to));
}

export async function POST(request: NextRequest) {
  const { dataLayer, username } = await owner(request);
  if (!username) return unauthorized();
  let body: unknown;
  try { body = await request.json(); } catch { return invalid(); }
  const { from, to } = (body && typeof body === "object" ? body : {}) as { from?: unknown; to?: unknown };
  if (!validRange(from, to)) return invalid();
  return respond(() => dataLayer.submissions.retireUnattributed(username, from, to as string));
}

export async function DELETE(request: NextRequest) {
  const { dataLayer, username } = await owner(request);
  if (!username) return unauthorized();
  return respond(() => dataLayer.submissions.restoreUnattributed(username));
}
