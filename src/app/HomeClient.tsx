"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Merge, X, Terminal, Copy, Check, Users, DollarSign, Zap, Trophy } from "lucide-react";
import Link from "next/link";
import FileUpload from "@/components/FileUpload";
import Leaderboard from "@/components/Leaderboard";
import UpdatesModal from "@/components/UpdatesModal";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import { useSession } from "next-auth/react";
import { useCheckClaimableSubmissions, useClaimAndMergeSubmissions } from "@/lib/data/hooks/useSubmissions";
import { formatNumber, toolLabel, FEATURED_TOOLS } from "@/lib/utils";
import { HOME_FAQS } from "@/lib/home-faqs";
import type { Submission, GlobalStats } from "@/lib/data/types";

interface HomeClientProps {
  initialItems: Submission[];
  initialStats?: GlobalStats;
  initialHasMore?: boolean;
}

export default function HomeClient({ initialItems, initialStats, initialHasMore }: HomeClientProps) {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [showMergeBanner, setShowMergeBanner] = useState(true);
  const [merging, setMerging] = useState(false);

  const { data: session } = useSession();
  const { data: claimStatus } = useCheckClaimableSubmissions(
    session?.user?.username || undefined
  );
  const { mutate: claimAndMerge } = useClaimAndMergeSubmissions();

  const copyCommand = () => {
    navigator.clipboard.writeText("npx viberank-cli");
    setCopiedToClipboard(true);
    setTimeout(() => setCopiedToClipboard(false), 2000);
  };

  const handleClaimAndMerge = async () => {
    if (!session?.user?.username) return;

    setMerging(true);
    try {
      await claimAndMerge();
      setShowMergeBanner(false);
      window.location.reload();
    } catch (error) {
      console.error("Failed to process:", error);
      alert("Failed to process submissions. Please try again.");
    } finally {
      setMerging(false);
    }
  };

  const stats = initialStats;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavBar
        onUploadClick={() => setShowUploadModal(true)}
        onUpdatesClick={() => setShowUpdatesModal(true)}
      />

      {/* Claim/Merge Banner */}
      <AnimatePresence>
        {showMergeBanner && claimStatus?.actionNeeded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-accent/10 border-b border-accent/20 px-4 py-2"
          >
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Merge className="w-4 h-4 text-accent" />
                <span>{claimStatus.actionText}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClaimAndMerge}
                  disabled={merging}
                  className="px-3 py-1 bg-accent text-white text-xs rounded font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {merging ? "..." : claimStatus.actionNeeded === "claim" ? "Verify" : "Merge"}
                </button>
                <button onClick={() => setShowMergeBanner(false)} className="text-muted hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border">
          <div className="max-w-6xl mx-auto px-6 pt-14 pb-10">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight max-w-3xl leading-[1.1]">
              Claude Code, Codex &amp; AI Coding <span className="text-accent">Leaderboard</span>
            </h1>
            <p className="text-muted text-base sm:text-lg mt-4 max-w-2xl">
              Real usage, real costs. Developers ranked by what they actually spend across AI coding
              tools — measured from ccusage data, not vibes.
            </p>

            {/* Terminal CTA */}
            <div className="flex flex-wrap items-center gap-3 mt-7">
              <button
                onClick={copyCommand}
                className="group flex items-center gap-3 rounded-xl bg-surface-1 border border-border hover:border-accent/50 px-4 py-3 transition-colors"
              >
                <Terminal className="w-4 h-4 text-muted" />
                <code className="font-mono text-accent font-medium">npx viberank-cli</code>
                {copiedToClipboard ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4 text-muted group-hover:text-foreground transition-colors" />
                )}
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-3 text-sm text-muted hover:text-foreground transition-colors"
              >
                <Upload className="w-4 h-4" />
                or upload cc.json
              </button>
            </div>

            {/* Stat strip */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-9">
                <div className="rounded-2xl bg-surface-1 border border-border px-4 py-3.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted mb-1.5"><Users className="w-3.5 h-3.5" />Developers</div>
                  <div className="text-xl font-bold font-mono">{formatNumber(stats.totalUsers)}</div>
                </div>
                <div className="rounded-2xl bg-surface-1 border border-border px-4 py-3.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted mb-1.5"><DollarSign className="w-3.5 h-3.5" />Total spent</div>
                  <div className="text-xl font-bold font-mono text-accent">${formatNumber(stats.totalCost)}</div>
                </div>
                <div className="rounded-2xl bg-surface-1 border border-border px-4 py-3.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted mb-1.5"><Zap className="w-3.5 h-3.5" />Tokens</div>
                  <div className="text-xl font-bold font-mono">{formatNumber(stats.totalTokens)}</div>
                </div>
                <div className="rounded-2xl bg-surface-1 border border-border px-4 py-3.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted mb-1.5"><Trophy className="w-3.5 h-3.5" />Top spender</div>
                  <div className="text-xl font-bold font-mono">${formatNumber(stats.topCost)}</div>
                </div>
              </div>
            )}

            {/* Per-tool boards */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-6 text-sm text-muted">
              <span>Per-tool boards:</span>
              {FEATURED_TOOLS.map((t) => (
                <Link
                  key={t.key}
                  href={`/tool/${t.key}`}
                  className="px-2.5 py-1 rounded-md bg-surface-1 border border-border hover:text-accent hover:border-accent/40 transition-colors"
                >
                  {toolLabel(t.key)}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Leaderboard */}
        <section className="max-w-6xl mx-auto px-6 pb-16">
          <Leaderboard
            initialItems={initialItems}
            initialStats={initialStats}
            initialHasMore={initialHasMore}
          />
        </section>

        {/* FAQ */}
        <section className="border-t border-border bg-surface-1/50">
          <div className="max-w-6xl mx-auto px-6 py-14">
            <h2 className="text-2xl font-bold tracking-tight mb-6">Frequently asked questions</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {HOME_FAQS.map((f) => (
                <div key={f.q} className="rounded-2xl border border-border bg-surface-1 p-5">
                  <h3 className="font-semibold mb-2">{f.q}</h3>
                  <p className="text-sm text-muted leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowUploadModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-surface-1 border border-border rounded-2xl shadow-xl max-w-sm w-full"
            >
              <div className="px-4 py-3 flex items-center justify-between border-b border-border">
                <h3 className="font-medium">Submit Stats</h3>
                <button onClick={() => setShowUploadModal(false)} className="p-1 text-muted hover:text-foreground rounded hover:bg-surface-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                {/* CLI option */}
                <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Terminal className="w-4 h-4 text-accent" />
                      <span className="font-medium">CLI</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 bg-accent/20 text-accent rounded">Recommended</span>
                  </div>
                  <button
                    onClick={copyCommand}
                    className="w-full flex items-center justify-between gap-2 bg-background rounded-md px-3 py-2 border border-border hover:border-accent/50 transition-colors"
                  >
                    <code className="text-sm font-mono text-accent">npx viberank-cli</code>
                    {copiedToClipboard ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted" />
                    )}
                  </button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Upload option */}
                <div>
                  <div className="flex items-center gap-2 mb-2 text-sm">
                    <Upload className="w-4 h-4 text-muted" />
                    <span className="font-medium">Upload cc.json</span>
                  </div>
                  <FileUpload onSuccess={() => setShowUploadModal(false)} />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <UpdatesModal isOpen={showUpdatesModal} onClose={() => setShowUpdatesModal(false)} />
    </div>
  );
}
