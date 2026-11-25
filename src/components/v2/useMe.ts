"use client";

// Who is looking at the board. Only ever used to highlight a row and pin a
// standing: knowing a handle grants nothing, so an unverified hint is fine.
//
// Order: the signed-in GitHub user, then `?me=<handle>` (the link the CLI
// prints after a sync, remembered for next time), then the remembered handle.
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { Standing } from "@/lib/v2/contract";

const KEY = "vr_me";
const HANDLE = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,38})$/;

export type MeSource = "session" | "link" | "remembered";

function readRemembered(): string | null {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored && HANDLE.test(stored)) return stored;
  } catch {
    // storage blocked: fall through to the cookie
  }
  const match = document.cookie.match(/(?:^|;\s*)vr_me=([^;]+)/);
  const fromCookie = match ? decodeURIComponent(match[1]) : null;
  return fromCookie && HANDLE.test(fromCookie) ? fromCookie : null;
}

function remember(handle: string) {
  try {
    window.localStorage.setItem(KEY, handle);
  } catch {
    // storage blocked: the cookie still carries it
  }
  document.cookie = `${KEY}=${encodeURIComponent(handle)}; path=/; max-age=31536000; samesite=lax`;
}

/** Reads `?me=` once, remembers it, and drops it from the address bar. */
function takeLinkHandle(): string | null {
  const url = new URL(window.location.href);
  const raw = url.searchParams.get("me");
  if (raw === null) return null;
  url.searchParams.delete("me");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  if (!HANDLE.test(raw)) return null;
  remember(raw);
  return raw;
}

export function useMe(): { me: string | null; source: MeSource | null } {
  const { data: session } = useSession();
  const sessionUser = session?.user?.username ?? null;
  const [hint, setHint] = useState<{ me: string; source: MeSource } | null>(null);

  useEffect(() => {
    const fromLink = takeLinkHandle();
    if (fromLink) return setHint({ me: fromLink, source: "link" });
    const stored = readRemembered();
    if (stored) setHint({ me: stored, source: "remembered" });
  }, []);

  if (sessionUser) return { me: sessionUser, source: "session" };
  return hint ? { me: hint.me, source: hint.source } : { me: null, source: null };
}

/** This week's standing for a handle; null while loading, unknown, or not on the board. */
export function useStanding(me: string | null, initial?: Standing | null): Standing | null {
  const [standing, setStanding] = useState<Standing | null>(initial ?? null);

  useEffect(() => {
    if (initial !== undefined) return;
    if (!me) return setStanding(null);
    const ctrl = new AbortController();
    fetch(`/api/v2/standing/${encodeURIComponent(me)}`, { signal: ctrl.signal })
      .then((res) => (res.ok ? (res.json() as Promise<Standing>) : null))
      .then((data) => setStanding(data))
      .catch(() => {
        // aborted or offline: the board still renders without a pinned row
      });
    return () => ctrl.abort();
  }, [me, initial]);

  return standing;
}
