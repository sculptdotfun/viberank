import Link from "next/link";
import { BLOG_POSTS, formatPostDate } from "@/lib/blogPosts";

const blogPosts = BLOG_POSTS.map((p) => ({
  slug: p.slug,
  title: p.title,
  excerpt: p.excerpt,
  date: formatPostDate(p.datePublished),
  readTime: p.readTime,
}));

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
