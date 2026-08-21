"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Plus, LogIn, ArrowRight } from "lucide-react";
import Link from "next/link";
import { leagueCreated } from "@/lib/analytics";

interface LeaguesClientProps {
  signedIn: boolean;
  myLeagues: { slug: string; name: string }[];
}

export default function LeaguesClient({ signedIn, myLeagues }: LeaguesClientProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ slug: string; inviteCode: string } | null>(null);

  const create = async () => {
    setBusy("create");
    setError(null);
    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create league.");
      leagueCreated();
      setCreated({ slug: data.league.slug, inviteCode: data.inviteCode });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create league.");
    } finally {
      setBusy(null);
    }
  };

  const join = async () => {
    setBusy("join");
    setError(null);
    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not join league.");
      router.push(`/league/${data.league.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join league.");
      setBusy(null);
    }
  };

  if (!signedIn) {
    return (
      <div className="rounded-lg border border-accent/40 bg-surface-1 p-6">
        <p className="font-medium mb-1">Sign in to start or join a league</p>
        <p className="text-sm text-muted mb-4">
          Leagues hang off your GitHub identity, same as the verified badge.
        </p>
        <button
          onClick={() => signIn("github")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <LogIn className="w-4 h-4" />
          Sign in with GitHub
        </button>
      </div>
    );
  }

  if (created) {
    return (
      <div className="rounded-lg border border-accent/40 bg-surface-1 p-6">
        <p className="font-medium mb-2">League created 🎉</p>
        <p className="text-sm text-muted mb-1">Share this invite code — it&apos;s the only way in:</p>
        <p className="font-mono text-xl text-accent mb-1">{created.inviteCode}</p>
        <p className="text-sm text-muted mb-4">
          Or share the join link:{" "}
          <span className="font-mono text-foreground text-xs">
            viberank.app/league/join/{created.inviteCode}
          </span>
        </p>
        <Link
          href={`/league/${created.slug}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Open your league
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {myLeagues.length > 0 && (
        <div className="rounded-lg border border-border bg-surface-1 p-5">
          <p className="micro-label mb-3">Your leagues</p>
          <div className="flex flex-wrap gap-2">
            {myLeagues.map((l) => (
              <Link
                key={l.slug}
                href={`/league/${l.slug}`}
                className="px-3 py-1.5 rounded-md border bg-surface-2 border-border text-sm text-foreground hover:text-accent transition-colors"
              >
                {l.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface-1 p-5">
          <p className="font-medium mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-accent" />
            Start a league
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="League name (2-60 chars)"
            maxLength={60}
            className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground placeholder:text-muted mb-3 focus:outline-none focus:border-accent"
          />
          <button
            onClick={create}
            disabled={busy !== null || name.trim().length < 2}
            className="w-full px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {busy === "create" ? "Creating…" : "Create league"}
          </button>
        </div>

        <div className="rounded-lg border border-border bg-surface-1 p-5">
          <p className="font-medium mb-3 flex items-center gap-2">
            <LogIn className="w-4 h-4 text-accent" />
            Join with a code
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Invite code"
            className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm font-mono text-foreground placeholder:text-muted mb-3 focus:outline-none focus:border-accent"
          />
          <button
            onClick={join}
            disabled={busy !== null || !code.trim()}
            className="w-full px-4 py-2 rounded-md border border-border bg-surface-2 text-sm text-foreground font-medium hover:bg-surface-1 transition-colors disabled:opacity-50"
          >
            {busy === "join" ? "Joining…" : "Join league"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
