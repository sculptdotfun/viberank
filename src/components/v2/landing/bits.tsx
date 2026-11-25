"use client";

import { useEffect, useRef, useState } from "react";
import { cliCommandCopied, type CopySource } from "@/lib/analytics";
import { countdown } from "../format";

const COMMAND = "npx viberank-cli";

/** The copyable install line: `$ npx viberank-cli  [Copy]`. */
export function CopyCommand({ source = "hero" }: { source?: CopySource }) {
  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLSpanElement>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(COMMAND);
      cliCommandCopied(source);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // No clipboard permission: select the text so a manual copy is one keystroke.
      const node = textRef.current;
      const sel = window.getSelection();
      if (!node || !sel) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  return (
    <div className="vr-cmd">
      <s aria-hidden>$</s>
      <span ref={textRef}>{COMMAND}</span>
      <button type="button" onClick={copy} aria-live="polite">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** "4d 9h", ticking once a minute. The server renders the first value. */
export function Countdown({ closesAt, initial }: { closesAt: string; initial: string }) {
  const [text, setText] = useState(initial);
  useEffect(() => {
    const tick = () => setText(countdown(closesAt));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [closesAt]);
  return <span suppressHydrationWarning>{text}</span>;
}
