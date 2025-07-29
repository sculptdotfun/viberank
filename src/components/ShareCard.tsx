"use client";

import { motion } from "framer-motion";
import { Share2, Download, Twitter, Copy, X } from "lucide-react";
import { useState } from "react";
import { formatNumber, formatCurrency } from "@/lib/utils";

interface ShareCardProps {
  rank: number;
  username: string;
  totalCost: number;
  totalTokens: number;
  dateRange: { start: string; end: string };
  onClose?: () => void;
}

export default function ShareCard({ rank, username, totalCost, totalTokens, dateRange, onClose }: ShareCardProps) {
  const [copied, setCopied] = useState(false);
  
  const shareUrl = `viberank.app`;
  const shareText = `I'm ranked #${rank} on viberank 🏆\n\n💰 $${formatCurrency(totalCost)} spent\n📊 ${formatNumber(totalTokens)} tokens used\n\nJoin the Claude Code leaderboard:`;
  
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
      className="bg-card border border-border rounded-lg p-6 max-w-md mx-auto"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Share Your Rank</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-card-hover transition-colors"
          >
            <X className="w-5 h-5 text-muted" />
          </button>
        )}
      </div>
      
      {/* Preview Card */}
      <div className="bg-background rounded-md p-4 mb-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 text-6xl font-bold text-accent/10">
          #{rank}
        </div>
        <div className="relative z-10">
          <p className="text-sm text-muted mb-2">viberank.app</p>
          <h4 className="text-xl font-semibold mb-3">{username}</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted">Total Spent</p>
              <p className="text-lg font-mono font-medium text-accent">${formatCurrency(totalCost)}</p>
            </div>
            <div>
              <p className="text-muted">Tokens Used</p>
              <p className="text-lg font-mono">{formatNumber(totalTokens)}</p>
            </div>
          </div>
          <p className="text-xs text-muted mt-3">
            {dateRange.start} → {dateRange.end}
          </p>
        </div>
      </div>
      
      {/* Share Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleXShare}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-black text-white rounded-md hover:bg-gray-900 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Post to X
        </button>
        <button
          onClick={handleCopyLink}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-card border border-border rounded-md hover:bg-card-hover transition-colors"
        >
          <Copy className="w-4 h-4" />
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
    </motion.div>
  );
}