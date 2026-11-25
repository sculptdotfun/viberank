"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Check, Copy, Download } from "lucide-react";

interface ShareActionsProps {
  /** Absolute page URL that goes into the post and the clipboard. */
  url: string;
  /** Whose card this is; the owner posts in the first person. */
  owner: string;
  /** Prefilled post text, without the URL: as the owner, and as anyone else. */
  text: string;
  visitorText: string;
  /** Same-origin OG image path offered as a download. */
  imagePath: string;
  fileName: string;
}

function XGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden fill="currentColor">
      <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.3l7.3-8.3L1 2h6.4l4.4 5.9L18.9 2Zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20Z" />
    </svg>
  );
}

const BTN = "inline-flex items-center gap-2 h-9 px-3.5 rounded-md text-[13px] font-medium transition-colors";

export default function ShareActions({ url, owner, text, visitorText, imagePath, fileName }: ShareActionsProps) {
  const { data: session } = useSession();
  const isOwner = session?.user?.username?.toLowerCase() === owner.toLowerCase();
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const post = () => {
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(isOwner ? text : visitorText)}&url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Fetch then save as a blob: a plain <a download> to a route that sets
  // caching headers opens the PNG in a tab on some browsers instead.
  const download = async () => {
    setSaving(true);
    try {
      const res = await fetch(imagePath);
      if (!res.ok) throw new Error(`image ${res.status}`);
      const href = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = href;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(href);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={post} className={`${BTN} bg-btn text-btn-ink hover:opacity-90`}>
        <XGlyph />
        Post to X
      </button>
      <button type="button" onClick={copy} className={`${BTN} border border-line-2 text-ink hover:bg-raised`}>
        {copied ? <Check className="w-3.5 h-3.5 text-up" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </button>
      <button
        type="button"
        onClick={download}
        disabled={saving}
        className={`${BTN} border border-line-2 text-ink hover:bg-raised disabled:opacity-60`}
      >
        <Download className="w-3.5 h-3.5" />
        {saving ? "Saving…" : "Download image"}
      </button>
    </div>
  );
}
