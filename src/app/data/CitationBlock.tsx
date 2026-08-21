"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { citationCopied } from "@/lib/analytics";

/**
 * The citation line, one click from the clipboard.
 *
 * Whoever is writing the next "Claude Code pricing 2026" post reaches for the
 * number that is easiest to attribute. Making that a single click is the whole
 * mechanism — and the copy event is the leading indicator that it worked, long
 * before any link shows up in a backlink tool.
 */
export default function CitationBlock({ citation }: { citation: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(citation);
    citationCopied();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      className="w-full text-left rounded-lg border border-border bg-surface-1 p-4 mb-3 hover:border-accent/50 transition-colors group"
      aria-label="Copy citation"
    >
      <span className="flex items-start justify-between gap-4">
        <code className="font-mono text-sm text-foreground whitespace-pre-wrap">{citation}</code>
        {copied ? (
          <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
        ) : (
          <Copy className="w-4 h-4 text-muted group-hover:text-accent flex-shrink-0 mt-0.5 transition-colors" />
        )}
      </span>
    </button>
  );
}
