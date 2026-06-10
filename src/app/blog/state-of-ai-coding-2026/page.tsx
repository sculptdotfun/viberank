import Link from "next/link";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import type { Metadata } from "next";

const TITLE = "State of AI Coding Spend 2026: Benchmarks From 800 Developers and $2.3M of Usage";
const DESC = "How much do developers really spend on AI coding agents? Percentiles, daily burn rates, cache economics, and power-user benchmarks from 29,000 days of real Claude Code, Codex, and Gemini CLI usage.";
const OG = "/api/og?title=State%20of%20AI%20Coding%20Spend%202026&description=Benchmarks%20from%20800%20developers%20%26%20%242.3M%20of%20usage";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: ["ai coding spend", "claude code cost benchmark", "ai coding statistics 2026", "developer ai usage data", "claude code tokens", "ai agent cost", "state of ai coding", "ccusage"],
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "https://www.viberank.app/blog/state-of-ai-coding-2026",
    type: "article",
    publishedTime: "2026-06-10T00:00:00.000Z",
    authors: ["Viberank Team"],
    images: [{ url: OG, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: [OG] },
};

// --- Tiny server-rendered chart primitives (no client JS) ---

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-1 px-4 py-3">
      <div className="font-mono text-xl font-bold text-accent">{value}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  );
}

function BarRow({ label, value, max, display, dim }: { label: string; value: number; max: number; display: string; dim?: boolean }) {
  const pct = Math.max((value / max) * 100, 1.5);
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="w-24 sm:w-32 shrink-0 font-mono text-xs text-muted text-right">{label}</div>
      <div className="flex-1 h-5 rounded bg-surface-2 overflow-hidden">
        <div className={`h-full rounded ${dim ? "bg-accent/40" : "bg-accent"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-20 shrink-0 font-mono text-xs text-foreground">{display}</div>
    </div>
  );
}

function Columns({ data, note }: { data: Array<{ label: string; value: number; faded?: boolean }>; note?: string }) {
  const max = Math.max(...data.map((d) => d.value));
  const CHART_HEIGHT = 130;
  return (
    <div className="not-prose my-6">
      <div className="flex items-end gap-1">
        {data.map((d) => (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="font-mono text-[9px] text-muted">${Math.round(d.value / 1000)}k</div>
            <div
              className={`w-full rounded-t ${d.faded ? "bg-accent/30" : "bg-accent/80"}`}
              style={{ height: `${Math.max((d.value / max) * CHART_HEIGHT, 3)}px` }}
              title={`${d.label}: $${Math.round(d.value / 1000)}k`}
            />
            <div className="font-mono text-[9px] text-muted truncate w-full text-center">{d.label}</div>
          </div>
        ))}
      </div>
      {note && <p className="text-xs text-muted mt-3">{note}</p>}
    </div>
  );
}

export default function Post() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: TITLE,
    description: DESC,
    image: "https://www.viberank.app" + OG,
    datePublished: "2026-06-10T00:00:00.000Z",
    dateModified: "2026-06-10T00:00:00.000Z",
    author: { "@type": "Organization", name: "Viberank", url: "https://www.viberank.app" },
    publisher: {
      "@type": "Organization",
      name: "Viberank",
      url: "https://www.viberank.app",
      logo: { "@type": "ImageObject", url: "https://www.viberank.app/icon.svg" },
    },
  };

  // Usage value logged per calendar month across all submissions (USD).
  const monthly = [
    { label: "Jun 25", value: 108817 },
    { label: "Jul", value: 346730 },
    { label: "Aug", value: 323410 },
    { label: "Sep", value: 112390 },
    { label: "Oct", value: 44450 },
    { label: "Nov", value: 53915 },
    { label: "Dec", value: 120746 },
    { label: "Jan 26", value: 164748 },
    { label: "Feb", value: 151677 },
    { label: "Mar", value: 226492 },
    { label: "Apr", value: 301792 },
    { label: "May", value: 221484 },
    { label: "Jun*", value: 77420, faded: true },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="prose prose-invert prose-neutral max-w-3xl mx-auto">
        <Link href="/blog" className="inline-flex items-center gap-2 text-muted hover:text-accent transition-colors mb-8 no-underline">
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>

        <h1>State of AI Coding Spend 2026</h1>

        <div className="flex items-center gap-3 text-sm text-muted not-prose mb-8">
          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />June 10, 2026</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Clock className="w-4 h-4" />9 min read</span>
        </div>

        <p>
          Everyone has an opinion about what AI coding agents cost. We have receipts. Developers on the{" "}
          <Link href="/">Viberank leaderboard</Link> measure their own usage locally with{" "}
          <a href="https://github.com/ryoppippi/ccusage" target="_blank" rel="noopener noreferrer">ccusage</a> — real
          Claude Code, Codex, and Gemini CLI logs, not survey answers — and submit it publicly. This report covers
          everything on the board as of June 2026.
        </p>

        <div className="not-prose grid grid-cols-2 sm:grid-cols-4 gap-3 my-8">
          <StatCard value="792" label="developers" />
          <StatCard value="2.5T" label="tokens" />
          <StatCard value="$2.3M" label="usage value" />
          <StatCard value="29,230" label="coding days tracked" />
        </div>

        <h2>The median serious user has burned $1,285</h2>
        <p>Lifetime usage value per developer, at API-equivalent prices:</p>
        <div className="not-prose space-y-2 my-6">
          <BarRow label="p25" value={379} max={30720} display="$379" dim />
          <BarRow label="median" value={1285} max={30720} display="$1,285" />
          <BarRow label="p75" value={3128} max={30720} display="$3,128" dim />
          <BarRow label="p90" value={6494} max={30720} display="$6,494" dim />
          <BarRow label="p99" value={30720} max={30720} display="$30,720" dim />
        </div>
        <p>
          The top user has consumed <strong>$56,694</strong> of compute value across 81 billion tokens. The mean
          ($2,904) sits at more than twice the median, because AI coding spend is a textbook power law:
        </p>
        <ul>
          <li>The top <strong>1%</strong> of users account for <strong>14%</strong> of all spend</li>
          <li>The top <strong>10%</strong> account for <strong>51%</strong></li>
          <li>The top <strong>25%</strong> account for <strong>74%</strong></li>
        </ul>

        <h2>Daily burn: $29 is the new normal, $200+ days are routine</h2>
        <p>Across all 29,000 tracked coding days:</p>
        <div className="not-prose space-y-2 my-6">
          <BarRow label="median day" value={29} max={708} display="$29" />
          <BarRow label="p90 day" value={215} max={708} display="$215" dim />
          <BarRow label="p99 day" value={708} max={708} display="$708" dim />
        </div>
        <p>
          <strong>11% of all tracked days exceeded $200</strong> — an entire Claude Max monthly subscription's worth
          of compute, consumed in one day. The single biggest day we've recorded: <strong>$3,820</strong>. And the
          median submitter is active 26 days per submission window — this is daily-driver usage, not weekend
          tinkering.
        </p>

        <h2>Power users have outgrown their subscription price 5–10×</h2>
        <p>
          Normalizing each developer's usage to a monthly rate: roughly <strong>half run at $1,000+/month</strong> in
          API-equivalent value, and ~73% run above $400/month. Most of them pay $100–200/month flat for Claude Max.
          The arbitrage is stark — the median heavy user extracts <strong>5–10× the sticker price</strong> of their
          plan in raw compute. Flat-rate pricing made always-on agentic coding economically rational, and the usage
          curves show developers responded exactly as you'd expect.
        </p>

        <h2>AI coding is 95% rereading, 0.2% writing</h2>
        <p>The token mix across the entire dataset is the most lopsided stat in this report:</p>
        <div className="not-prose space-y-2 my-6">
          <BarRow label="cache reads" value={94.8} max={94.8} display="94.8%" />
          <BarRow label="cache writes" value={4.2} max={94.8} display="4.2%" dim />
          <BarRow label="input" value={0.8} max={94.8} display="0.8%" dim />
          <BarRow label="output" value={0.2} max={94.8} display="0.2%" dim />
        </div>
        <p>
          For every token an agent actually <em>writes</em>, it re-reads <strong>~406 tokens</strong> of cached
          context. The 2.5 trillion token headline is really ~5.9B tokens of generated work product riding on a
          mountain of context re-reads. This is why prompt caching, not model price, is the real economic engine of
          agentic coding — and why long sessions in big repos get expensive even when output is small.
        </p>

        <h2>The always-on cohort exists</h2>
        <p>
          Seven developers have logged <strong>200+ active days</strong>, and the longest consecutive-day streak on
          the board is <strong>238 days straight</strong> — eight months without missing a single day. The top of the
          leaderboard isn't people who type fast; it's people who've turned agents into infrastructure that runs
          whether they're at the keyboard or not.
        </p>
        <p>
          Weekends barely slow anyone down: Saturdays and Sundays are 24% of active days (a uniform week would be
          28.6%), and a weekend day burns the same <strong>~$82–84</strong> as a Tuesday. When your agent does the
          typing, "logging off" is a softer concept.
        </p>

        <h2>Model mix: Opus is the workhorse, not the treat</h2>
        <div className="not-prose space-y-2 my-6">
          <BarRow label="Sonnet" value={96} max={96} display="96%" />
          <BarRow label="Opus" value={90} max={96} display="90%" />
          <BarRow label="Haiku" value={64} max={96} display="64%" dim />
        </div>
        <p>
          Nine in ten developers run Opus — the most expensive tier is now the default for serious work, not a
          special occasion. Haiku's 64% tells the quieter story: cheap models doing subagent and utility passes
          inside bigger workflows.
        </p>

        <h2>Multi-agent developers are 9% of the board — and most of the top 10</h2>
        <p>
          A note on coverage: viberank started as a Claude Code leaderboard and only recently opened to every agent{" "}
          ccusage tracks — Codex, Gemini CLI, Copilot, OpenCode and friends. So this dataset is still
          overwhelmingly Claude Code, and the cross-tool numbers should be read as early signal, not market share.
        </p>
        <p>
          That said: about 9% of the board already reports usage from more than one coding agent, and they're heavily
          over-represented at the very top — several top-10 spenders run three or more agents in parallel. If you
          want a preview of the median 2027 workflow, look at the current multi-tool tail — see our{" "}
          <Link href="/blog/codex-vs-claude-code-vs-gemini-cli">Codex vs Claude Code vs Gemini CLI comparison</Link>.
        </p>
        <p>
          If you use Codex, Gemini CLI, or anything else alongside (or instead of) Claude Code, your submission makes
          the next edition of this report meaningfully better — one command covers every tool ccusage detects:
        </p>
        <pre><code>npx viberank-cli</code></pre>

        <h2>Usage is at an all-time high</h2>
        <p>Usage value logged per calendar month across all submissions:</p>
        <Columns
          data={monthly}
          note="*June 2026 is 10 days in — tracking toward ~$230k, on pace with the launch-spike months. Earlier months only include usage from developers whose submissions cover them."
        />
        <p>
          After the launch spike (Jul–Aug 2025) and an autumn lull, tracked usage has climbed for six straight
          months. Spring 2026 is running at launch-hype levels — except now it's steady-state behavior, not novelty.
        </p>

        <h2>Who these developers are</h2>
        <p>
          Cross-referencing public GitHub data for the board: the median account is <strong>~9 years old</strong>, a
          third have 50+ public repositories, and spend <em>rises</em> with experience — developers with 13+ year-old
          GitHub accounts have the highest median usage. Geographically (by site traffic): US ~31%, <strong>South
          Korea ~13%</strong> — the strongest per-capita AI-coding adoption signal we see anywhere — then the UK,
          India, and Canada. AI-assisted coding at this intensity is a senior-engineer phenomenon, not a shortcut for
          beginners.
        </p>

        <h2>Methodology & honest caveats</h2>
        <ul>
          <li><strong>Source:</strong> developers run ccusage locally against their own agent logs and submit the result. GitHub-OAuth submissions are verified (blue check); CLI submissions are self-reported.</li>
          <li><strong>"Spend" means API-equivalent value</strong> — what the tokens would cost at list API prices. Most users actually pay a flat subscription, so real out-of-pocket cost is usually far lower.</li>
          <li><strong>Selection bias is real:</strong> people who submit to a usage leaderboard skew heavy. Read these numbers as benchmarks for serious users, not population averages.</li>
          <li>Stats use each developer's largest submission to avoid double-counting overlapping date ranges.</li>
          <li><strong>Coverage skews Claude Code:</strong> multi-tool submissions only opened recently, so other agents are underrepresented relative to their real-world usage.</li>
        </ul>

        <h2>Where do you rank?</h2>
        <p>
          Every number in this report comes from developers who took thirty seconds to submit. One command measures
          your real usage — across Claude Code, Codex, Gemini CLI, and every other agent ccusage tracks — and puts
          you on the <Link href="/">board</Link>:
        </p>
        <pre><code>npx viberank-cli</code></pre>
        <p>
          Prefer not to install anything? Sign in with GitHub on <Link href="/">viberank.app</Link> and upload your{" "}
          <code>cc.json</code> for a verified blue check.
        </p>
        <p>
          Curious what drives the bill — or how to shrink it? Read{" "}
          <Link href="/blog/how-much-does-claude-code-cost">how much Claude Code costs</Link> and{" "}
          <Link href="/blog/reduce-ai-coding-costs">9 ways to cut your AI coding bill</Link>.
        </p>
      </article>
    </>
  );
}
