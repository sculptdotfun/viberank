import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import { toolLabel } from "@/lib/utils";
import { COMPARE_FACTS, COMPARE_MATCHUPS, matchupTitle } from "@/lib/compare";

const SITE = "https://www.viberank.app";
const TITLE = "Compare AI Coding Tools on Real Usage: Claude, Codex & More";
const DESC =
  "Head-to-head comparisons of AI coding agents — Claude Code, OpenAI Codex, Gemini CLI, Copilot, OpenCode — on pricing, models, and real adoption from live ccusage data.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${SITE}/compare` },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: `${SITE}/compare`,
    siteName: "Viberank",
    type: "website",
    images: [
      `/api/og?title=${encodeURIComponent("Compare AI coding tools")}&description=${encodeURIComponent("Head-to-head on pricing, models, and real usage data")}`,
    ],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

export default function CompareIndexPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link href="/" className="inline-flex items-center gap-1.5 micro-label hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" />
          Leaderboard
        </Link>

        <p className="micro-label mb-3">Comparisons</p>
        <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight mb-2">Compare AI coding tools</h1>
        <p className="text-muted mb-10 max-w-2xl">
          Every comparison backed by real usage — developer counts, top spenders, and API-equivalent cost from live{" "}
          <a
            href="https://github.com/ryoppippi/ccusage"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            ccusage
          </a>{" "}
          submissions, not vendor marketing.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-12">
          {COMPARE_MATCHUPS.map((m) => (
            <Link
              key={m.slug}
              href={`/compare/${m.slug}`}
              className="group flex flex-col rounded-lg border border-border bg-surface-1 p-5 hover:bg-surface-2 transition-colors"
            >
              <h2 className="font-mono text-base font-semibold text-foreground group-hover:text-accent transition-colors mb-2">
                {matchupTitle(m)}
              </h2>
              <p className="text-muted text-sm leading-relaxed line-clamp-3">
                {COMPARE_FACTS[m.a].provider} vs {COMPARE_FACTS[m.b].provider} — pricing, models, and who developers
                actually use more.
              </p>
            </Link>
          ))}
        </div>

        <p className="text-sm text-muted">
          Or browse the per-tool boards:{" "}
          {["claude", "codex", "gemini", "copilot", "opencode"].map((t, i, arr) => (
              <span key={t}>
                <Link href={`/tool/${t}`} className="text-accent hover:underline">
                  {toolLabel(t)}
                </Link>
                {i < arr.length - 1 ? ", " : "."}
              </span>
          ))}
        </p>
      </div>
      <Footer />
    </div>
  );
}
