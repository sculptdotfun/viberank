"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Check, Copy, Share2 } from "lucide-react";
import { formatNumber, formatUsd } from "@/lib/utils";
import { profileUrl } from "@/lib/site";

interface ProfileShareProps {
  /** Stored username: the canonical profile URL is built from it. */
  username: string;
  /** Shown name in the post. */
  handle: string;
  rank: number | null;
  totalCost: number;
  totalTokens: number;
}

/**
 * Share on X and Copy link, for anyone looking at the profile. Sharing used to
 * live only on your own leaderboard row, so a visitor who wanted to pass a
 * profile on had to copy the address bar, and the owner had to find the row.
 */
export default function ProfileShare({ username, handle, rank, totalCost, totalTokens }: ProfileShareProps) {
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);
  const url = profileUrl(username);

  const isOwner = session?.user?.username?.toLowerCase() === handle.toLowerCase();
  const standing = rank ? `ranked #${rank} on viberank` : "on viberank";
  const stats = `💰 ${formatUsd(totalCost)} API-equivalent · 📊 ${formatNumber(totalTokens)} tokens`;
  const text = isOwner
    ? `I'm ${standing} 🏆\n\n${stats}\n\nWhere do you rank?`
    : `${handle} is ${standing} 🏆\n\n${stats}\n\nWhere do you rank?`;

  const shareToX = () => {
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const copyLink = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={shareToX}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
      >
        <Share2 className="w-3.5 h-3.5" />
        Share on X
      </button>
      <button
        onClick={copyLink}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-surface-1 text-xs text-foreground hover:bg-surface-2 transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
