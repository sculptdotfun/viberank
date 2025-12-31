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
        className="inline-flex items-center gap-2 text-stone-400 hover:text-orange-400 transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Leaderboard
      </Link>
      
      <h1 className="text-4xl font-bold text-stone-100 mb-4">Blog</h1>
      <p className="text-stone-400 mb-12">
        Insights on AI-powered development, Claude Code, and the future of programming.
      </p>
      
      <div className="space-y-8">
        {blogPosts.map((post) => (
          <article key={post.slug} className="border-b border-stone-800 pb-8">
            <Link href={`/blog/${post.slug}`} className="group">
              <h2 className="text-2xl font-semibold text-stone-100 group-hover:text-orange-400 transition-colors mb-2">
                {post.title}
              </h2>
              <p className="text-stone-400 mb-3">{post.excerpt}</p>
              <div className="flex items-center gap-4 text-sm text-stone-500">
                <span>{post.date}</span>
                <span>•</span>
                <span>{post.readTime}</span>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}