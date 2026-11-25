"use client";

import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
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
    <div className="border border-line-2 rounded-[14px] bg-panel p-5">
      <p className="font-mono text-[12px] text-ink-3 m-0">invite · only members see this</p>
      <p className="text-ink font-medium mt-1 mb-3">Bring your team in</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => copy("link")}
          className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-btn text-btn-ink text-[13px] font-medium hover:opacity-90"
        >
          {copied === "link" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied === "link" ? "Copied" : "Copy join link"}
        </button>
        <button
          onClick={() => copy("code")}
          className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md border border-line-2 font-mono text-[13px] text-ink hover:bg-raised"
        >
          {copied === "code" ? <Check className="w-3.5 h-3.5 text-up" /> : <Copy className="w-3.5 h-3.5" />}
          {code}
        </button>
      </div>
    </div>
  );
}
