import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const blogPosts = [
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
  return (
    <>
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-muted hover:text-accent transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Leaderboard
      </Link>

      <h1 className="text-3xl font-semibold text-foreground mb-3">Blog</h1>
      <p className="text-muted mb-10">
        Insights on AI-powered development, Claude Code, and the future of programming.
      </p>

      <div className="space-y-6">
        {blogPosts.map((post) => (
          <article key={post.slug} className="border-b border-border pb-6">
            <Link href={`/blog/${post.slug}`} className="group block">
              <h2 className="text-xl font-medium text-foreground group-hover:text-accent transition-colors mb-2">
                {post.title}
              </h2>
              <p className="text-muted text-sm mb-3 leading-relaxed">{post.excerpt}</p>
              <div className="flex items-center gap-3 text-xs text-muted">
                <span>{post.date}</span>
                <span>·</span>
                <span>{post.readTime}</span>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}
