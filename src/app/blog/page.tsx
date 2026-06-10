import Link from "next/link";

const blogPosts = [
  {
    slug: "state-of-ai-coding-2026",
    title: "State of AI Coding Spend 2026: Benchmarks From 800 Developers and $2.3M of Usage",
    excerpt: "Percentiles, daily burn rates, model mix, and power-user benchmarks from 29,000 days of real Claude Code, Codex, and Gemini CLI usage.",
    date: "June 10, 2026",
    readTime: "8 min read",
  },
  {
    slug: "codex-vs-claude-code-vs-gemini-cli",
    title: "Codex vs Claude Code vs Gemini CLI: AI Coding Cost & Usage Compared (2026)",
    excerpt: "How OpenAI Codex, Claude Code, and Gemini CLI compare on cost, tokens, and real-world usage — backed by data from 800+ developers.",
    date: "June 9, 2026",
    readTime: "8 min read",
  },
  {
    slug: "how-much-does-claude-code-cost",
    title: "How Much Does Claude Code Cost? Real Data From 800+ Developers (2026)",
    excerpt: "What does Claude Code actually cost per month? Real spend, tokens, and daily averages from 800+ developers on the leaderboard.",
    date: "June 9, 2026",
    readTime: "6 min read",
  },
  {
    slug: "reduce-ai-coding-costs",
    title: "How to Cut Your AI Coding Bill: 9 Ways to Reduce Claude Code & Codex Costs",
    excerpt: "Practical, proven ways to lower your AI coding costs — model routing, prompt caching, context hygiene — without slowing down.",
    date: "June 9, 2026",
    readTime: "7 min read",
  },
  {
    slug: "mcp-servers-guide",
    title: "MCP Servers Guide: Connect Claude Code to GitHub, Databases & More",
    excerpt: "Learn how to extend Claude Code with MCP servers. Connect to GitHub, PostgreSQL, Slack, and build custom integrations for AI-powered development.",
    date: "December 15, 2025",
    readTime: "9 min read",
  },
  {
    slug: "cursor-vs-claude-code-vs-copilot",
    title: "Cursor vs Claude Code vs GitHub Copilot: AI Coding Tools Compared (2025)",
    excerpt: "In-depth comparison of the top AI coding assistants. Features, pricing, use cases, and which one fits your development workflow.",
    date: "November 28, 2025",
    readTime: "10 min read",
  },
  {
    slug: "claude-code-complete-guide",
    title: "Claude Code Complete Guide 2025: Installation, Commands & Best Practices",
    excerpt: "Master Claude Code with this comprehensive guide covering installation, essential commands, MCP servers, hooks, and advanced workflows.",
    date: "October 12, 2025",
    readTime: "12 min read",
  },
  {
    slug: "vibe-coding-revolution",
    title: "Vibe Coding Explained: What Karpathy's Viral Term Really Means",
    excerpt: "From Andrej Karpathy's viral tweet to Claude Code, Cursor, and Conductor—understand what vibe coding really means for developers and the future of software.",
    date: "September 5, 2025",
    readTime: "8 min read",
  },
];

export default function BlogPage() {
  const [featured, ...rest] = blogPosts;
  return (
    <>
      <p className="micro-label mb-3">Blog</p>
      <h1 className="font-mono text-3xl font-bold tracking-tight text-foreground mb-3">Notes from the leaderboard</h1>
      <p className="text-muted mb-10">
        Insights on AI-powered development, Claude Code, and the future of programming.
      </p>

      {/* Featured (latest) post */}
      <Link
        href={`/blog/${featured.slug}`}
        className="group block rounded-lg border border-accent/40 bg-surface-1 p-6 mb-6 hover:bg-surface-2 transition-colors"
      >
        <span className="inline-block font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-accent mb-3">
          Latest
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-foreground group-hover:text-accent transition-colors mb-2">
          {featured.title}
        </h2>
        <p className="text-muted text-sm mb-4 leading-relaxed">{featured.excerpt}</p>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span>{featured.date}</span>
          <span>·</span>
          <span>{featured.readTime}</span>
        </div>
      </Link>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group flex flex-col rounded-lg border border-border bg-surface-1 p-5 hover:bg-surface-2 transition-colors"
          >
            <h2 className="text-base font-semibold text-foreground group-hover:text-accent transition-colors mb-2">
              {post.title}
            </h2>
            <p className="text-muted text-sm mb-4 leading-relaxed line-clamp-3">{post.excerpt}</p>
            <div className="mt-auto flex items-center gap-3 text-xs text-muted">
              <span>{post.date}</span>
              <span>·</span>
              <span>{post.readTime}</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
