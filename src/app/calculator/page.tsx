import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getServerDataLayer } from "@/lib/data";
import { buildSpendCurve, percentileLadder } from "@/lib/spend-curve";
import { formatUsd } from "@/lib/utils";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import CalculatorClient from "./CalculatorClient";

// The cohort is a full-table read of ~1k narrow rows; the hourly ISR window
// keeps it rare, matching /stats.
export const revalidate = 3600;

const TITLE = "AI Coding Cost Calculator — Subscription vs API | Viberank";
const DESCRIPTION =
  "ccusage tells you what your Claude Code, Codex or Copilot usage would cost at API prices. This tells you which subscription plan is actually cheaper — and how your spend compares to 1,000+ real developers.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://www.viberank.app/calculator" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://www.viberank.app/calculator",
    siteName: "Viberank",
  },
};

export default async function CalculatorPage() {
  const dataLayer = await getServerDataLayer();
  const rows = await dataLayer.stats.getSpendRows().catch(() => []);
  const curve = buildSpendCurve(rows);

  const median = curve.percentiles.find((entry) => entry.p === 50)?.burn ?? 0;
  const p90 = curve.percentiles.find((entry) => entry.p === 90)?.burn ?? 0;

  // Share of the cohort burning more than each plan's price — the headline
  // finding, computed from the same cohort the calculator ranks against.
  const shareAbove = (threshold: number) =>
    curve.cohortSize === 0
      ? 0
      : Math.round(
          (curve.sorted.filter((burn) => burn > threshold).length / curve.cohortSize) * 100
        );

  const faq = [
    {
      q: "What is API-equivalent cost?",
      a: "ccusage prices your token usage at Anthropic's published API rates. If you are on a Pro or Max subscription you did not pay that — it is the counterfactual cost of the same work through the API. The gap between the two is what this page measures.",
    },
    {
      q: "Does the recommended plan really cover that much usage?",
      a: "Vendors describe capacity relative to their own tiers — Anthropic as 5x and 20x Pro, OpenAI as 5x Plus — never as a dollar ceiling, and heavy sessions can hit rate limits. Treat the saving as the value of the usage, not a guarantee that any volume fits inside one seat. Where a vendor publishes no comparable tiers, no plan is marked too small.",
    },
    {
      q: "Where does the comparison cohort come from?",
      a: `Every submission on viberank, normalised to a 30-day burn and collapsed to one entry per developer (their highest-cost submission). Submissions spanning under 7 days are excluded because they extrapolate badly. Currently ${curve.cohortSize.toLocaleString()} developers.`,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 micro-label text-muted hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Leaderboard
        </Link>

        <p className="micro-label mb-3">Free tool</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          Are you overpaying for AI coding?
        </h1>
        <p className="text-muted leading-relaxed mb-8">
          {curve.cohortSize > 0 ? (
            <>
              <span className="text-foreground font-medium">
                {shareAbove(200)}% of developers on viberank
              </span>{" "}
              burn more than $200/month in API-equivalent cost — the price of the largest Claude
              plan. The median burns{" "}
              <span className="text-foreground font-mono">{formatUsd(median)}</span> and the
              top 10% burn over{" "}
              <span className="text-foreground font-mono">{formatUsd(p90)}</span>. Put your own
              number in below.
            </>
          ) : (
            <>
              Put your ccusage number in below to see which Claude plan is cheapest for your actual
              usage.
            </>
          )}
        </p>

        <CalculatorClient
          ladder={percentileLadder(curve.sorted)}
          cohortSize={curve.cohortSize}
          medianBurn={median}
        />

        <section className="mt-14">
          <p className="micro-label mb-4">FAQ</p>
          <div className="space-y-6">
            {faq.map((item) => (
              <div key={item.q}>
                <h2 className="font-medium mb-1.5">{item.q}</h2>
                <p className="text-sm text-muted leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="text-xs text-muted mt-10 leading-relaxed">
          Plan prices were checked against each vendor&apos;s own pricing page on 2026-08-05 and are
          monthly-billing list prices in USD; the source is shown alongside each tool&apos;s plans.
          Gemini CLI is not covered yet — Google does not publish comparable monthly prices for the
          tiers that include it, and guessing would be worse than omitting it. viberank is not
          affiliated with Anthropic, OpenAI or GitHub.
        </p>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }),
        }}
      />

      <Footer />
    </div>
  );
}
