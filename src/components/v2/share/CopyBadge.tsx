"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { SITE_URL, profileUrl } from "@/lib/site";

type Range = "week" | "all";

const OPTIONS: { range: Range; label: string; hint: string }[] = [
  { range: "week", label: "This week", hint: "rank and spend for the live week" },
  { range: "all", label: "All-time", hint: "lifetime rank" },
];

function markdown(username: string, range: Range): string {
  const src = `${SITE_URL}/api/badge/${encodeURIComponent(username)}?style=v2${range === "week" ? "&range=week" : ""}`;
  return `[![viberank](${src})](${profileUrl(username)})`;
}

/** README badge markdown in the v2 style, for the week or all-time. */
export default function CopyBadge({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<Range | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const copy = async (range: Range) => {
    await navigator.clipboard.writeText(markdown(username, range));
    setCopied(range);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md border border-line-2 text-[13px] font-medium text-ink hover:bg-raised"
      >
        Copy badge
        <ChevronDown className={`w-3.5 h-3.5 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-30 mt-2 right-0 sm:left-0 sm:right-auto w-[min(22rem,calc(100vw-2rem))] rounded-[10px] border border-line-2 bg-raised p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
          {OPTIONS.map((o) => (
            <button
              key={o.range}
              type="button"
              onClick={() => copy(o.range)}
              className="w-full text-left rounded-md px-3 py-2.5 hover:bg-panel flex items-start gap-3"
            >
              {copied === o.range ? <Check className="w-4 h-4 text-up mt-0.5 flex-none" /> : <Copy className="w-4 h-4 text-ink-3 mt-0.5 flex-none" />}
              <span className="min-w-0">
                <span className="block text-[13px] text-ink">
                  {copied === o.range ? "Copied markdown" : o.label}
                  <span className="text-ink-3"> · {o.hint}</span>
                </span>
                <code className="block font-mono text-[11px] text-ink-3 truncate mt-1">{markdown(username, o.range)}</code>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
