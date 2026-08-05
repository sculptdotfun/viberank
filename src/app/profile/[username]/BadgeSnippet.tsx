"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * The badge is only useful if people find it, and nobody goes looking for an
 * undocumented API route — so it lives on the profile it belongs to, as
 * something you can paste straight into a README.
 */
export default function BadgeSnippet({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);

  const handle = encodeURIComponent(username);
  const markdown = `[![viberank](https://www.viberank.app/api/badge/${handle})](https://www.viberank.app/profile/${handle})`;

  const copy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-surface-1 border border-border rounded-lg p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="micro-label">README badge</p>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-border hover:border-accent hover:text-accent transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy markdown"}
        </button>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element -- an SVG badge
          from our own route; next/image would rasterise and proxy it. */}
      <img
        src={`/api/badge/${handle}`}
        alt={`viberank rank for ${username}`}
        width={140}
        height={20}
        className="mb-3"
      />

      <code className="block text-[11px] font-mono text-muted bg-background border border-border rounded px-3 py-2 overflow-x-auto whitespace-nowrap">
        {markdown}
      </code>

      <p className="text-xs text-muted mt-2">
        Also <code className="text-accent">?metric=cost</code> and{" "}
        <code className="text-accent">?metric=tokens</code>.
      </p>
    </div>
  );
}
