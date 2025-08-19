import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const blogPosts = [
  {
    slug: "vibe-coding-revolution",
    title: "Vibe Coding Explained: What Karpathy's Viral Term Really Means",
    excerpt: "From Andrej Karpathy's viral tweet to Claude Code, Cursor, and Conductor—understand what vibe coding really means for developers and the future of software.",
    date: "January 19, 2025",
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