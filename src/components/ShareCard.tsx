"use client";

import { motion } from "framer-motion";
import { Copy, X, Trophy, Check } from "lucide-react";
import { useState } from "react";
import { formatNumber, formatCurrency, toolLabel } from "@/lib/utils";
import { getTier } from "@/lib/tiers";
import TierBadge from "./TierBadge";

interface ShareCardProps {
  rank: number;
  username: string;
  totalCost: number;
  totalTokens: number;
  dateRange: { start: string; end: string };
  tools?: string[];
  onClose?: () => void;
}

export default function ShareCard({ rank, username, totalCost, totalTokens, dateRange, tools, onClose }: ShareCardProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `https://viberank.app/profile/${encodeURIComponent(username)}`;
  const tier = getTier(totalCost);
  const toolsLine = tools && tools.length > 0 ? `\n🧰 ${tools.map(toolLabel).join(" · ")}` : "";
  const shareText = `I'm ranked #${rank} on viberank 🏆\n\n${tier.glyph} ${tier.name.toUpperCase()} tier\n💰 $${formatCurrency(totalCost)} spent\n📊 ${formatNumber(totalTokens)} tokens${toolsLine}\n\nJoin the AI coding leaderboard:`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleXShare = () => {
    const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(xUrl, "_blank");
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-surface-1 border border-border rounded-2xl p-5 max-w-md w-full mx-auto"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium">Share your rank</h3>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-surface-2 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Preview card */}
      <div className="bg-background border border-border rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="micro-label mb-1">viberank.app</p>
            <div className="flex items-center gap-2">
              <h4 className="text-lg font-bold">{username}</h4>
              <TierBadge totalCost={totalCost} size="xs" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent text-white">
            <Trophy className="w-4 h-4" />
            <span className="font-bold font-mono">#{rank}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="rounded-lg bg-surface-2 p-3">
            <p className="text-[11px] text-muted mb-0.5">Total spent</p>
            <p className="text-lg font-mono font-bold text-accent">${formatNumber(totalCost)}</p>
          </div>
          <div className="rounded-lg bg-surface-2 p-3">
            <p className="text-[11px] text-muted mb-0.5">Tokens</p>
            <p className="text-lg font-mono font-bold">{formatNumber(totalTokens)}</p>
          </div>
        </div>

        {tools && tools.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {tools.map((t) => (
              <span key={t} className="text-[10px] font-medium px-1.5 py-1 rounded-md bg-surface-3 text-muted border border-border-subtle">
                {toolLabel(t)}
              </span>
            ))}
          </div>
        )}

        <p className="text-xs text-muted font-mono">
          {dateRange.start} → {dateRange.end}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleXShare}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-foreground text-background rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Post to X
        </button>
        <button
          onClick={handleCopyLink}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-surface-2 border border-border rounded-lg text-sm hover:bg-surface-3 transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </motion.div>
  );
}
