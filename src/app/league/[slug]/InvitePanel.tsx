"use client";

import { useEffect, useState } from "react";
import { Copy, Check, KeyRound } from "lucide-react";
import { leagueInviteCopied } from "@/lib/analytics";

// Fetches the invite code client-side so it never lands in the (cached,
// public) page HTML — the API only reveals it to members.
export default function InvitePanel({ slug }: { slug: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  useEffect(() => {
    fetch(`/api/leagues/${encodeURIComponent(slug)}/invite`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCode(d?.code ?? null))
      .catch(() => setCode(null));
  }, [slug]);

  if (!code) return null;

  const link = `https://www.viberank.app/league/join/${code}`;
  const copy = (what: "code" | "link") => {
    navigator.clipboard.writeText(what === "code" ? code : link);
    leagueInviteCopied();
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="rounded-lg border border-accent/40 bg-surface-1 p-5">
      <p className="font-medium mb-1 flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-accent" />
        Invite people
      </p>
      <p className="text-sm text-muted mb-3">Only members can see this. Share either one:</p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => copy("code")}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface-2 font-mono text-sm text-accent hover:bg-surface-1 transition-colors"
        >
          {copied === "code" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          {code}
        </button>
        <button
          onClick={() => copy("link")}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface-2 text-sm text-foreground hover:bg-surface-1 transition-colors"
        >
          {copied === "link" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          Copy join link
        </button>
      </div>
    </div>
  );
}
