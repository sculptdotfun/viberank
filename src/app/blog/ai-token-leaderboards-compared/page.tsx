import Link from "next/link";
import { ArrowLeft, Clock, Calendar, Trophy, Users, Shield, Scale } from "lucide-react";
import type { Metadata } from "next";

const TITLE = "AI Token Leaderboards Compared (2026): Viberank, tokenmaxxing.sh, TokenRank, Straude & More";
const DESC =
  "Nine public leaderboards now rank AI coding token usage. An honest comparison of viberank, tokenmaxxing.sh, TokenRank, Straude, ccclub, ccrank, CCWarriors, DevBurn and Token Tracker — scale, verification, tools covered, and which to pick.";
const URL = "https://www.viberank.app/blog/ai-token-leaderboards-compared";
const OG =
  "/api/og?title=AI%20Token%20Leaderboards%20Compared&description=Nine%20boards%20rank%20AI%20coding%20usage%20%E2%80%94%20which%20one%20matters%3F";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "ai token leaderboard",
    "token usage leaderboard",
    "tokenmaxxing leaderboard",
    "claude code leaderboard",
    "viberank alternatives",
    "tokenrank",
    "tokenmaxxing.sh",
    "straude",
    "ccusage leaderboard",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: URL,
    type: "article",
    publishedTime: "2026-08-18T00:00:00.000Z",
    authors: ["Viberank Team"],
    images: [{ url: OG, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: [OG] },
};

const BOARDS = [
  {
    name: "Viberank",
    url: "https://www.viberank.app",
    scale: "1,100+ devs · $10M+ tracked",
    tools: "Everything ccusage tracks (15 sources)",
    identity: "GitHub OAuth + verified badges",
    angle: "The original and largest — tiers, profiles, README badges, autosubmit, calculator, monthly data reports",
  },
  {
    name: "tokenmaxxing.sh",
    url: "https://tokenmaxxing.sh",
    scale: "Smaller board, whale-heavy top 10",
    tools: "ccusage sources",
    identity: "Account sign-in",
    angle: "Clean spend/token windows (7d/30d/all), multi-device profiles",
  },
  {
    name: "TokenRank",
    url: "https://tokenrank.org",
    scale: "Growing",
    tools: "Codex, Claude Code, Gemini, Qwen, Cursor, Copilot + more",
    identity: "X (Twitter) identity",
    angle: "Time-window boards, English/Chinese, rank-challenge links",
  },
  {
    name: "Straude",
    url: "https://straude.com",
    scale: "Growing",
    tools: "Claude Code + Codex",
    identity: "Account sign-in",
    angle: "Strava-style streaks and pace framing",
  },
  {
    name: "ccclub",
    url: "https://ccclub.dev",
    scale: "Private friend groups",
    tools: "Claude Code, Codex, OpenCode, Amp, pi-agent",
    identity: "Invite codes",
    angle: "Leaderboard among friends, not the public internet",
  },
  {
    name: "ccrank",
    url: "https://ccrank.dev",
    scale: "Self-hosted instances",
    tools: "Claude Code (via ccusage)",
    identity: "Google OAuth, invite-only",
    angle: "Open-source team leaderboard you deploy yourself (Cloudflare Workers)",
  },
  {
    name: "CCWarriors",
    url: "https://ccwarriors.xyz",
    scale: "Growing",
    tools: "ccusage-readable agents",
    identity: "Account sign-in",
    angle: "Live-updating board with per-tool filters",
  },
  {
    name: "DevBurn",
    url: "https://devburn.com",
    scale: "Early",
    tools: "Claude Code (Codex/Cursor planned)",
    identity: "Account sign-in",
    angle: "Points formula rewarding consistency, not just spend",
  },
  {
    name: "Token Tracker",
    url: "https://www.tokentracker.cc",
    scale: "Dashboard-first",
    tools: "27 tools",
    identity: "Opt-in display names",
    angle: "Local-first dashboard with an optional public board",
  },
];

const FAQS = [
  {
    q: "What is an AI token leaderboard?",
    a: "A public ranking of developers by their AI coding usage — tokens consumed and API-equivalent cost — usually measured by ccusage from local agent logs (Claude Code, Codex, Gemini CLI, etc.) and submitted as aggregate totals. Code and prompts stay local on every board listed here.",
  },
  {
    q: "Which AI token leaderboard is the biggest?",
    a: "Viberank, with 1,100+ developers and over $10M in tracked API-equivalent spend since 2025 — it's also the board that's been cited in press coverage of AI coding costs. Most alternatives launched in 2026 and are still building their cohorts.",
  },
  {
    q: "Can I be on more than one leaderboard?",
    a: "Yes — they all read the same local ccusage data, so submitting to several is just running several CLIs. The main cost is that each board is another place your usage totals live.",
  },
  {
    q: "Do these leaderboards see my code or prompts?",
    a: "No. Every board here submits aggregate rows only — dates, token counts, costs, model and tool names. Verify it yourself: most CLIs (including npx viberank-cli) are open source or offer a dry-run that prints the exact payload.",
  },
];

export default function Post() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: TITLE,
      description: DESC,
      image: "https://www.viberank.app" + OG,
      datePublished: "2026-08-18T00:00:00.000Z",
      dateModified: "2026-08-18T00:00:00.000Z",
      author: { "@type": "Organization", name: "Viberank", url: "https://www.viberank.app" },
      publisher: {
        "@type": "Organization",
        name: "Viberank",
        url: "https://www.viberank.app",
        logo: { "@type": "ImageObject", url: "https://www.viberank.app/icon.svg" },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="prose prose-invert prose-neutral max-w-3xl mx-auto">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-muted hover:text-accent transition-colors mb-8 no-underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>

        <header className="mb-12">
          <h1 className="text-5xl font-bold text-foreground mb-4 leading-tight">
            The AI Token Leaderboards, Compared
          </h1>

          <div className="flex items-center gap-6 text-sm text-muted mb-8">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              August 18, 2026
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />6 min read
            </span>
          </div>

          <div className="p-6 bg-card border border-border rounded-lg">
            <p className="text-lg text-foreground m-0">
              A year ago there was one public AI token leaderboard. After{" "}
              <Link href="/blog/what-is-tokenmaxxing">tokenmaxxing</Link> went mainstream in 2026, there are at
              least <strong>nine</strong>. We build one of them, so read this with that in mind — but we&apos;d
              rather map the landscape honestly than pretend the others don&apos;t exist. Here&apos;s what each
              board does, who it&apos;s for, and how to pick.
            </p>
          </div>
        </header>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Scale className="w-8 h-8 text-accent" />
            The field at a glance
          </h2>
          <div className="overflow-x-auto my-8 not-prose">
            <table className="w-full border-collapse text-sm min-w-[640px]">
              <thead>
                <tr className="bg-card">
                  <th className="border border-stone-700 p-3 text-left text-foreground">Board</th>
                  <th className="border border-stone-700 p-3 text-left text-foreground">Scale</th>
                  <th className="border border-stone-700 p-3 text-left text-foreground">Tools covered</th>
                  <th className="border border-stone-700 p-3 text-left text-foreground">Identity</th>
                </tr>
              </thead>
              <tbody className="text-foreground">
                {BOARDS.map((b, i) => (
                  <tr key={b.name} className={i % 2 ? "bg-card/50" : ""}>
                    <td className="border border-border p-3 font-medium">
                      <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-accent no-underline hover:underline">
                        {b.name}
                      </a>
                    </td>
                    <td className="border border-border p-3">{b.scale}</td>
                    <td className="border border-border p-3">{b.tools}</td>
                    <td className="border border-border p-3">{b.identity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            The one-line difference for each: {BOARDS.map((b) => `${b.name} — ${b.angle.toLowerCase()}`).join("; ")}.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Users className="w-8 h-8 text-accent" />
            How to pick
          </h2>
          <ul className="text-foreground text-lg leading-relaxed mb-6 space-y-3">
            <li>
              <strong>You want the biggest cohort to rank against</strong> — the whole point of a leaderboard is
              the other people on it. <Link href="/">Viberank</Link> has 1,100+ developers and $10M+ tracked; see{" "}
              <Link href="/stats">the live stats</Link>.
            </li>
            <li>
              <strong>You want a private league with friends or your team</strong> —{" "}
              <a href="https://ccclub.dev" target="_blank" rel="noopener noreferrer">ccclub</a> (invite groups) or
              self-hosted <a href="https://ccrank.dev" target="_blank" rel="noopener noreferrer">ccrank</a>.
            </li>
            <li>
              <strong>You want streak/fitness framing over raw spend</strong> —{" "}
              <a href="https://straude.com" target="_blank" rel="noopener noreferrer">Straude</a> or{" "}
              <a href="https://devburn.com" target="_blank" rel="noopener noreferrer">DevBurn</a>&apos;s
              points formula. (Viberank tracks streaks and active days on profiles too.)
            </li>
            <li>
              <strong>You want X-native identity</strong> —{" "}
              <a href="https://tokenrank.org" target="_blank" rel="noopener noreferrer">TokenRank</a> ties ranks to
              X handles; Viberank ties them to GitHub, which is also what powers its verified badges.
            </li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Shield className="w-8 h-8 text-accent" />
            What actually separates boards
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            Every board reads the same local data (usually via{" "}
            <a href="https://github.com/ryoppippi/ccusage" target="_blank" rel="noopener noreferrer">ccusage</a>),
            so the real differences are <strong>cohort size</strong> (who you&apos;re ranked against),{" "}
            <strong>validation</strong> (whether absurd submissions get caught — Viberank sanity-checks token math,
            cost ratios, and dates server-side), <strong>identity</strong> (anonymous numbers vs verified GitHub
            accounts), and <strong>what exists around the rank</strong> — profiles with daily charts,{" "}
            <Link href="/api/badge/nikshepsvn">README badges</Link>, <Link href="/compare">tool comparisons</Link>,{" "}
            <Link href="/calculator">a plan calculator</Link>, and <Link href="/stats/monthly">monthly data
            reports</Link> that press can cite.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-accent" />
            Try the original
          </h2>
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <code className="text-accent font-mono">npx viberank-cli</code>
          </div>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            One command, all your agents, only totals leave your machine. Then check{" "}
            <Link href="/blog/how-much-does-claude-code-cost">whether your number is normal</Link>.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6">Leaderboard FAQ</h2>
          <div className="space-y-6">
            {FAQS.map((f) => (
              <div key={f.q} className="bg-card border border-border rounded-lg p-5">
                <h3 className="text-lg font-semibold text-foreground mt-0 mb-2">{f.q}</h3>
                <p className="text-muted m-0">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </article>
    </>
  );
}
