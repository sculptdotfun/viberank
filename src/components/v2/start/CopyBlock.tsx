"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * One copyable snippet: a command line (with a `$`/`>` prompt) or a block of
 * text such as the agent prompt. Falls back to selecting the text when the
 * clipboard is refused, so a manual copy is one keystroke.
 */
export default function CopyBlock({
  text,
  prompt,
  multiline = false,
  label = "Copy",
}: {
  text: string;
  prompt?: string;
  multiline?: boolean;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLElement>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      const node = ref.current;
      const sel = window.getSelection();
      if (!node || !sel) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  const button = (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className="flex-none inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-btn text-btn-ink text-[13px] font-medium hover:opacity-90"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );

  if (multiline) {
    return (
      <div className="border border-line-2 rounded-[10px] bg-panel">
        <pre
          ref={ref as React.RefObject<HTMLPreElement>}
          className="m-0 px-4 pt-3.5 pb-2 font-mono text-[12.5px] leading-relaxed text-ink-2 whitespace-pre-wrap break-words"
        >
          {text}
        </pre>
        <div className="flex justify-end px-2 pb-2">{button}</div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border border-line-2 rounded-[10px] bg-panel py-1.5 pl-4 pr-1.5 min-w-0">
      {prompt && <span className="flex-none font-mono text-[14px] text-heat" aria-hidden>{prompt}</span>}
      <code ref={ref as React.RefObject<HTMLElement>} className="flex-1 min-w-0 font-mono text-[13.5px] text-ink overflow-x-auto whitespace-nowrap">
        {text}
      </code>
      {button}
    </div>
  );
}
