"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Merge, X, Terminal, Copy, Check, Github } from "lucide-react";
import Leaderboard from "@/components/Leaderboard";
import dynamic from "next/dynamic";

const SubmitModal = dynamic(() => import("@/components/SubmitModal"), { ssr: false });
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import { useSession, signIn } from "next-auth/react";
import { useCheckClaimableSubmissions, useClaimAndMergeSubmissions } from "@/lib/data/hooks/useSubmissions";
import { formatNumber } from "@/lib/utils";
import { TIERS } from "@/lib/tiers";
import { HOME_FAQS } from "@/lib/home-faqs";
import type { Submission, GlobalStats } from "@/lib/data/types";

interface HomeClientProps {
  initialItems: Submission[];
  initialStats?: GlobalStats;
  initialHasMore?: boolean;
}

// "$5K+" style tier thresholds (formatNumber gives "5.0K").
function tierMin(min: number): string {
  if (min === 0) return "$0+";
  return `$${formatNumber(min).replace(".0", "")}+`;
}

function Ticker({ stats }: { stats: GlobalStats }) {
  const entries = [
    `${formatNumber(stats.totalUsers)} developers on the board`,
    `$${formatNumber(stats.totalCost)} tracked`,
    `${formatNumber(stats.totalTokens)} tokens burned`,
    stats.topUser ? `${stats.topUser} leads at $${formatNumber(stats.topCost)}` : null,
    `run npx viberank-cli to join`,
  ].filter(Boolean) as string[];

  // Track is duplicated so the -50% translate loops seamlessly.
  const half = (
    <span className="inline-flex items-center">
      {entries.map((e, i) => (
        <span key={i} className="inline-flex items-center">
          <span className="px-5">{e}</span>
          <span className="text-accent">·</span>
        </span>
      ))}
    </span>
  );

  return (
    <div className="border-b border-border bg-surface-1 overflow-hidden" aria-hidden>
      <div className="ticker-track font-mono text-[10px] uppercase tracking-[0.14em] text-muted py-1.5">
        {half}
        {half}
      </div>
    </div>
  );
}

export default function HomeClient({ initialItems, initialStats, initialHasMore }: HomeClientProps) {
  const [showUploadModal, setShowUploadModal] = useState(false);
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
      {stats && <Ticker stats={stats} />}

      <NavBar />

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
        {/* Headline + board + sidebar */}
        <section className="max-w-6xl mx-auto px-6 pt-12 pb-16 w-full lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10 lg:items-start">
          <div>
            <div className="pb-8">
              <p className="micro-label mb-3">The AI coding usage leaderboard</p>
              <h1 className="font-mono text-2xl sm:text-4xl font-bold tracking-tight max-w-3xl leading-[1.15]">
                Claude Code &amp; AI coding spend,{" "}
                <span className="text-accent whitespace-nowrap">
                  ranked
                  <span className="cursor-block" aria-hidden />
                </span>
              </h1>
              <p className="text-muted text-base sm:text-lg mt-4 max-w-2xl">
                Developers ranked by API spend, token usage, and token-per-dollar efficiency across
                Claude Code, OpenAI Codex, Gemini CLI, Copilot and every coding agent ccusage tracks.
              </p>

              {/* CTA — mobile/tablet only; the sidebar card covers desktop */}
              <div className="flex flex-wrap items-center gap-3 mt-6 lg:hidden">
                <button
                  onClick={copyCommand}
                  className="group flex items-center gap-3 rounded-lg bg-surface-1 border border-border hover:border-accent/50 px-4 py-3 transition-colors"
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
            </div>

            <Leaderboard
              initialItems={initialItems}
              initialStats={initialStats}
              initialHasMore={initialHasMore}
            />
          </div>

          <aside className="hidden lg:block sticky top-20 space-y-4">
            {/* Enlist card */}
            <div className="rounded-lg border border-border bg-surface-1 p-4">
              <div className="micro-label mb-3">Get on the board</div>
              <button
                onClick={copyCommand}
                className="group w-full flex items-center justify-between gap-2 rounded-md bg-background border border-border hover:border-accent/50 px-3 py-2.5 transition-colors"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-accent font-mono text-sm">$</span>
                  <code className="font-mono text-sm truncate">npx viberank-cli</code>
                </span>
                {copiedToClipboard ? (
                  <Check className="w-4 h-4 text-success flex-shrink-0" />
                ) : (
                  <Copy className="w-4 h-4 text-muted group-hover:text-foreground transition-colors flex-shrink-0" />
                )}
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="w-full flex items-center gap-2 mt-2 px-3 py-2 text-sm text-muted hover:text-foreground transition-colors"
              >
                <Upload className="w-4 h-4" />
                or upload cc.json
              </button>
              {!session && (
                <button
                  onClick={() => signIn("github")}
                  className="w-full flex items-center justify-center gap-2 mt-2 px-3 py-2 text-sm border border-border rounded-md hover:bg-surface-2 transition-colors"
                >
                  <Github className="w-4 h-4" />
                  Sign in to get verified
                </button>
              )}
            </div>

            {/* Tier ladder */}
            <div className="rounded-lg border border-border bg-surface-1 p-4">
              <div className="micro-label mb-2">Tier ladder</div>
              <div className="divide-y divide-border-subtle">
                {[...TIERS].reverse().map((t) => (
                  <div key={t.key} className="flex items-center justify-between py-2 font-mono text-xs uppercase tracking-[0.1em]">
                    <span style={{ color: t.color }}>
                      {t.glyph} {t.name}
                    </span>
                    <span className="text-muted">{tierMin(t.min)}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted leading-relaxed mt-3">
                Based on your best submission&apos;s total cost.
              </p>
            </div>
          </aside>
        </section>

        {/* How it works */}
        <section className="border-t border-border">
          <div className="max-w-6xl mx-auto px-6 py-12">
            <div className="micro-label mb-6">How it works</div>
            <div className="grid sm:grid-cols-3 gap-x-10 gap-y-6">
              {[
                {
                  title: "Run the CLI",
                  body: (
                    <>
                      <code className="font-mono text-accent">npx viberank-cli</code> reads your local usage
                      logs with ccusage. Your code and prompts never leave your machine.
                    </>
                  ),
                },
                {
                  title: "Every agent counts",
                  body: "Claude Code, OpenAI Codex, Gemini CLI, Copilot, OpenCode and every other coding agent ccusage tracks — summed into one number.",
                },
                {
                  title: "Climb the tiers",
                  body: "Your total spend earns a tier, from Spark to Supernova. Sign in with GitHub for a verified badge and a shareable rank card.",
                },
              ].map((step, i) => (
                <div key={step.title} className="flex gap-4">
                  <span className="font-mono text-sm text-accent pt-0.5">0{i + 1}</span>
                  <div>
                    <h3 className="text-sm font-semibold mb-1.5">{step.title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-border">
          <div className="max-w-6xl mx-auto px-6 py-12">
            <div className="micro-label mb-6">FAQ</div>
            <div className="grid md:grid-cols-2 gap-x-12 gap-y-7">
              {HOME_FAQS.map((f) => (
                <div key={f.q} className="border-t border-border-subtle pt-4">
                  <h3 className="text-sm font-semibold mb-1.5">{f.q}</h3>
                  <p className="text-sm text-muted leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {showUploadModal && <SubmitModal open onClose={() => setShowUploadModal(false)} />}
    </div>
  );
}
