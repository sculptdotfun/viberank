import Link from "next/link";
import { FEATURED_TOOLS, toolLabel } from "@/lib/utils";

const RESOURCES = [
  { name: "Blog", href: "/blog" },
  { name: "Codex vs Claude Code vs Gemini", href: "/blog/codex-vs-claude-code-vs-gemini-cli" },
  { name: "What Claude Code costs", href: "/blog/how-much-does-claude-code-cost" },
  { name: "Cut your AI coding bill", href: "/blog/reduce-ai-coding-costs" },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface-1">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-accent">
                <rect x="3" y="14" width="5" height="7" rx="1" fill="currentColor" opacity="0.5" />
                <rect x="9.5" y="8" width="5" height="13" rx="1" fill="currentColor" opacity="0.75" />
                <rect x="16" y="3" width="5" height="18" rx="1" fill="currentColor" />
              </svg>
              <span className="font-semibold">viberank</span>
            </Link>
            <p className="text-sm text-muted leading-relaxed">
              The leaderboard for AI coding usage. Real costs, real tokens, from real ccusage data.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Leaderboards</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/" className="text-foreground/80 hover:text-accent transition-colors">All tools</Link></li>
              {FEATURED_TOOLS.map((t) => (
                <li key={t.key}>
                  <Link href={`/tool/${t.key}`} className="text-foreground/80 hover:text-accent transition-colors">
                    {toolLabel(t.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Resources</h3>
            <ul className="space-y-2 text-sm">
              {RESOURCES.map((r) => (
                <li key={r.href}>
                  <Link href={r.href} className="text-foreground/80 hover:text-accent transition-colors">
                    {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Community</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="https://github.com/sculptdotfun/viberank" target="_blank" rel="noopener noreferrer" className="text-foreground/80 hover:text-accent transition-colors">
                  GitHub
                </a>
              </li>
              <li>
                <a href="https://www.npmjs.com/package/viberank-cli" target="_blank" rel="noopener noreferrer" className="text-foreground/80 hover:text-accent transition-colors">
                  viberank-cli on npm
                </a>
              </li>
              <li>
                <a href="https://github.com/ryoppippi/ccusage" target="_blank" rel="noopener noreferrer" className="text-foreground/80 hover:text-accent transition-colors">
                  ccusage
                </a>
              </li>
              <li>
                <a href="https://github.com/sculptdotfun/viberank/issues" target="_blank" rel="noopener noreferrer" className="text-foreground/80 hover:text-accent transition-colors">
                  Report an issue
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-10 pt-6 border-t border-border-subtle text-xs text-muted">
          <span>© {new Date().getFullYear()} viberank · MIT licensed</span>
          <code className="font-mono text-accent">npx viberank-cli</code>
        </div>
      </div>
    </footer>
  );
}
