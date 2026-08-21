import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getServerDataLayer } from "@/lib/data";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import { formatUsd } from "@/lib/utils";

const SITE = "https://www.viberank.app";
const TITLE = "Monthly AI Coding Spend Reports: Tokens, Cost & Models";
const DESC =
  "Month-by-month reports on what developers actually spend on AI coding — totals, medians, per-tool and per-model breakdowns from real ccusage data on the Viberank leaderboard.";
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const revalidate = 3600;

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${SITE}/stats/monthly` },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: `${SITE}/stats/monthly`,
    siteName: "Viberank",
    type: "website",
    images: [
      `/api/og?title=${encodeURIComponent("Monthly spend reports")}&description=${encodeURIComponent("What AI coding actually costs, month by month")}`,
    ],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export default async function MonthlyIndexPage() {
  let monthly: { month: string; cost: number; users: number }[] = [];
  try {
    const dataLayer = await getServerDataLayer();
    const site = await dataLayer.stats.getSiteStats();
    monthly = (site?.monthly ?? []).slice().sort((a, b) => (a.month < b.month ? 1 : -1));
  } catch {
    // render empty state
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link href="/stats" className="inline-flex items-center gap-1.5 micro-label hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" />
          All-time stats
        </Link>

        <p className="micro-label mb-3">Reports</p>
        <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight mb-2">Monthly spend reports</h1>
        <p className="text-muted mb-10 max-w-2xl">
          What AI coding actually costs, month by month — totals, medians, and per-tool breakdowns from real{" "}
          <a
            href="https://github.com/ryoppippi/ccusage"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            ccusage
          </a>{" "}
          data. Free to cite with a link.
        </p>

        {monthly.length > 0 ? (
          <div className="rounded-lg border border-border overflow-hidden max-w-2xl">
            <div className="flex items-center gap-3 px-4 py-2.5 micro-label bg-surface-1 border-b border-border">
              <div className="flex-1">Month</div>
              <div className="w-24 text-right">Devs</div>
              <div className="w-32 text-right">Tracked spend</div>
            </div>
            <div className="divide-y divide-border-subtle">
              {monthly.map((m) => (
                <Link
                  key={m.month}
                  href={`/stats/monthly/${m.month}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-1 transition-colors group"
                >
                  <span className="flex-1 text-sm font-medium group-hover:text-accent transition-colors">
                    {monthLabel(m.month)}
                  </span>
                  <span className="w-24 text-right text-sm font-mono text-muted">{m.users.toLocaleString()}</span>
                  <span className="w-32 text-right text-sm font-mono font-semibold text-accent">
                    {formatUsd(Math.round(m.cost))}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-muted">Reports are generating — check back shortly.</p>
        )}
      </div>
      <Footer />
    </div>
  );
}
