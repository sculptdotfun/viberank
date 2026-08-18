"use client";

import { useState } from "react";
import { Copy, Check, Share2 } from "lucide-react";
import type { UserMonthStats } from "@/lib/data/types";
import { formatNumber, formatUsd } from "@/lib/utils";

interface WrappedShareProps {
  username: string;
  month: string;
  label: string;
  stats: UserMonthStats;
  percentile: number;
}

export default function WrappedShare({ username, month, label, stats, percentile }: WrappedShareProps) {
  const [copied, setCopied] = useState(false);

  const url = `https://www.viberank.app/wrapped/${month}/${encodeURIComponent(username)}`;
  const text = `My ${label} in AI coding 🧾\n\n💸 ${formatUsd(Math.round(stats.cost))} (API-equivalent)\n🔢 ${formatNumber(stats.tokens)} tokens\n📅 ${stats.activeDays} active days · ${stats.longestStreak}-day streak\n🏆 top ${percentile}% of ${stats.totalActives} devs\n\nGet yours: npx viberank-cli`;

  const copyLink = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareToX = () => {
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank"
    );
  };

  return (
    <div className="flex flex-wrap gap-3">
      <button
        onClick={shareToX}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Share2 className="w-4 h-4" />
        Share on X
      </button>
      <button
        onClick={copyLink}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-surface-1 text-sm text-foreground hover:bg-surface-2 transition-colors"
      >
        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
