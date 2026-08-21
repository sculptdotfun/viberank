/**
 * Single source of truth for blog post metadata.
 *
 * The blog index, sitemap, RSS feed, and llms.txt all render from this list.
 * Keep it sorted newest-first; `datePublished`/`dateModified` are ISO dates so
 * the sitemap can emit real lastModified values instead of build timestamps
 * (which train crawlers to ignore the signal entirely).
 */
export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  /** ISO date, e.g. "2026-07-24" */
  datePublished: string;
  /** ISO date; bump when a post gets a real content refresh. */
  dateModified: string;
  readTime: string;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "ai-token-leaderboards-compared",
    title: "AI Token Leaderboards Compared: 9 Boards Ranked (2026)",
    excerpt:
      "Nine public leaderboards now rank AI coding token usage. An honest map of the field — scale, verification, tools covered — from the people who built the original.",
    datePublished: "2026-08-18",
    dateModified: "2026-08-18",
    readTime: "6 min read",
  },
  {
    slug: "how-to-check-opencode-usage",
    title: "How to Check OpenCode Usage: Tokens, Costs & Stats (2026)",
    excerpt:
      "OpenCode has no built-in usage meter — but one ccusage command turns its local session logs into per-day token counts and real API costs. Plus dashboards and the public leaderboard.",
    datePublished: "2026-08-18",
    dateModified: "2026-08-18",
    readTime: "5 min read",
  },
  {
    slug: "claude-code-usage-limits",
    title: "Claude Code Usage Limits: 5-Hour & Weekly Caps (2026)",
    excerpt:
      "How Claude Code's rolling 5-hour session limit and weekly cap actually work in 2026, how to check where you stand with /usage and ccusage, and what to do when you hit the wall.",
    datePublished: "2026-08-18",
    dateModified: "2026-08-18",
    readTime: "8 min read",
  },
  {
    slug: "how-to-check-claude-code-usage",
    title: "How to Check Your Claude Code Usage: /usage & ccusage",
    excerpt:
      "Three ways to see exactly how much Claude Code you've used — the /usage command, ccusage for token-level history, and the leaderboard that tracks it daily.",
    datePublished: "2026-08-18",
    dateModified: "2026-08-18",
    readTime: "7 min read",
  },
  {
    slug: "is-claude-max-worth-it",
    title: "Is Claude Max Worth It? Pro vs Max 5x vs Max 20x (2026)",
    excerpt:
      "Stop guessing which Claude plan you need. Compare Pro, Max 5x, and Max 20x against your real API-equivalent usage — with benchmarks from 1,100+ developers.",
    datePublished: "2026-08-18",
    dateModified: "2026-08-18",
    readTime: "7 min read",
  },
  {
    slug: "what-is-tokenmaxxing",
    title: "What Is Tokenmaxxing? Meaning, Origin & the Leaderboards",
    excerpt:
      "The trend behind Meta's Claudeonomics and Uber's blown AI budget — where the term came from, why corporate token leaderboards failed, and how 1,000+ developers measure theirs.",
    datePublished: "2026-07-24",
    dateModified: "2026-07-24",
    readTime: "7 min read",
  },
  {
    slug: "how-to-check-codex-usage",
    title: "How to Check Codex Usage: /usage, /status & Real Costs",
    excerpt:
      "Two commands answer it: /status inside Codex CLI for your 5-hour and weekly limits, and ccusage for token-level history and costs — plus the public Codex leaderboard.",
    datePublished: "2026-07-24",
    dateModified: "2026-08-18",
    readTime: "6 min read",
  },
  {
    slug: "state-of-ai-coding-2026",
    title: "State of AI Coding Spend 2026: $2.3M, 800 Developers",
    excerpt:
      "Percentiles, daily burn rates, model mix, and power-user benchmarks from 29,000 days of real Claude Code, Codex, and Gemini CLI usage.",
    datePublished: "2026-06-10",
    dateModified: "2026-06-10",
    readTime: "8 min read",
  },
  {
    slug: "codex-vs-claude-code-vs-gemini-cli",
    title: "Codex vs Claude Code vs Gemini CLI: Cost & Usage (2026)",
    excerpt:
      "How OpenAI Codex, Claude Code, and Gemini CLI compare on cost, tokens, and real-world usage — backed by data from 800+ developers.",
    datePublished: "2026-06-09",
    dateModified: "2026-06-09",
    readTime: "8 min read",
  },
  {
    slug: "how-much-does-claude-code-cost",
    title: "How Much Does Claude Code Cost? Real Data, 800+ Devs (2026)",
    excerpt:
      "What does Claude Code actually cost per month? Real spend, tokens, and daily averages from 800+ developers on the leaderboard.",
    datePublished: "2026-06-09",
    dateModified: "2026-06-09",
    readTime: "6 min read",
  },
  {
    slug: "reduce-ai-coding-costs",
    title: "How to Cut Your AI Coding Bill: 9 Ways to Spend Less",
    excerpt:
      "Practical, proven ways to lower your AI coding costs — model routing, prompt caching, context hygiene — without slowing down.",
    datePublished: "2026-06-09",
    dateModified: "2026-06-09",
    readTime: "7 min read",
  },
  {
    slug: "mcp-servers-guide",
    title: "MCP Servers Guide: Connect Claude Code to GitHub & Databases",
    excerpt:
      "Learn how to extend Claude Code with MCP servers. Connect to GitHub, PostgreSQL, Slack, and build custom integrations for AI-powered development.",
    datePublished: "2025-12-15",
    dateModified: "2025-12-15",
    readTime: "9 min read",
  },
  {
    slug: "cursor-vs-claude-code-vs-copilot",
    title: "Cursor vs Claude Code vs Copilot: Compared on Real Usage",
    excerpt:
      "In-depth comparison of the top AI coding assistants. Features, pricing, use cases, and which one fits your development workflow in 2026.",
    datePublished: "2025-11-28",
    dateModified: "2026-08-18",
    readTime: "10 min read",
  },
  {
    slug: "claude-code-complete-guide",
    title: "Claude Code Guide 2026: Install, Commands & Best Practices",
    excerpt:
      "Master Claude Code with this comprehensive guide covering installation, essential commands, MCP servers, hooks, and advanced workflows.",
    datePublished: "2025-10-12",
    dateModified: "2026-08-18",
    readTime: "12 min read",
  },
  {
    slug: "vibe-coding-revolution",
    title: "Vibe Coding Explained: What Karpathy's Viral Term Really Means",
    excerpt:
      "From Andrej Karpathy's viral tweet to Claude Code, Cursor, and Conductor—understand what vibe coding really means for developers and the future of software.",
    datePublished: "2025-09-05",
    dateModified: "2025-09-05",
    readTime: "8 min read",
  },
];

/** "2026-07-24" → "July 24, 2026" — rendered in a fixed locale so SSR is deterministic. */
export function formatPostDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[m - 1]} ${d}, ${y}`;
}
