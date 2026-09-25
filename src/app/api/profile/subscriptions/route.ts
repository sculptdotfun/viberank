import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerDataLayer } from "@/lib/data";
import { todayUtc, validateSubscriptionInput } from "@/lib/money";

// The signed-in user's declared subscriptions: what they actually pay, shown
// on their profile next to the API-equivalent value. Identity comes from the
// GitHub session only, and every data-layer call is scoped by that username,
// so there is no path to changing someone else's list. (Reading anyone's is
// fine: declarations are public on the profile itself.)

// Enough for years of plan changes across every tool; stops a script from
// filling the table.
const MAX_DECLARATIONS = 24;

async function sessionUsername(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.username ?? null;
}

function signInFirst() {
  return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
}

export async function GET() {
  const username = await sessionUsername();
  if (!username) return signInFirst();

  const dataLayer = await getServerDataLayer();
  const subscriptions = await dataLayer.profiles.getSubscriptions(username);
  return NextResponse.json({ subscriptions });
}

export async function POST(request: NextRequest) {
  const username = await sessionUsername();
  if (!username) return signInFirst();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const result = validateSubscriptionInput(body, todayUtc());
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const dataLayer = await getServerDataLayer();
  try {
    const existing = await dataLayer.profiles.getSubscriptions(username);
    if (existing.length >= MAX_DECLARATIONS) {
      return NextResponse.json(
        { error: `You can declare up to ${MAX_DECLARATIONS} plans. Remove an old one first.` },
        { status: 400 }
      );
    }
    const subscription = await dataLayer.profiles.addSubscription(username, result.value);
    return NextResponse.json({ subscription });
  } catch (error) {
    console.error("add subscription failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save the plan." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const username = await sessionUsername();
  if (!username) return signInFirst();

  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid subscription id." }, { status: 400 });
  }

  const dataLayer = await getServerDataLayer();
  const removed = await dataLayer.profiles.removeSubscription(username, id);
  if (!removed) {
    return NextResponse.json({ error: "No such plan on your profile." }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
