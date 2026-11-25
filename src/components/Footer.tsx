import Link from "next/link";
import { FEATURED_TOOLS, toolLabel } from "@/lib/utils";
import { TAKO_URL } from "@/lib/sponsor";
import { BoardLink } from "./HomeVariant";

type FooterLink = { name: string; href: string; external?: boolean; board?: boolean };

// "This week" follows VIBERANK_HOME ("/" or "/week"), so it renders through
// BoardLink, which reads the flag the root layout passed down.
const BOARDS: FooterLink[] = [
  { name: "This week", href: "/week", board: true },
  { name: "Weeks", href: "/weeks" },
  { name: "Records", href: "/records" },
  { name: "Fleets", href: "/fleets" },
  { name: "Wrapped 2026", href: "/wrapped/2026" },
  { name: "Friend leagues", href: "/leagues" },
];

// Kept as plain links: these pages are reached mostly from search, and the
// footer is how crawlers and readers find them from every page.
const RESOURCES = [
  { name: "Open data & API", href: "/data" },
  { name: "Site stats", href: "/stats" },
  { name: "Model economics", href: "/model" },
  { name: "Cost calculator", href: "/calculator" },
  { name: "Compare AI coding tools", href: "/compare" },
  { name: "How we check submissions", href: "/blog/how-viberank-checks-submissions" },
  { name: "Blog", href: "/blog" },
  { name: "Hire AI-native engineers", href: "/hire" },
  { name: "한국어 안내", href: "/ko" },
];

const GUIDES = [
  { name: "Claude Code usage limits", href: "/blog/claude-code-usage-limits" },
  { name: "Check your Claude Code usage", href: "/blog/how-to-check-claude-code-usage" },
  { name: "Is Claude Max worth it?", href: "/blog/is-claude-max-worth-it" },
  { name: "What is tokenmaxxing?", href: "/blog/what-is-tokenmaxxing" },
  { name: "What Claude Code costs", href: "/blog/how-much-does-claude-code-cost" },
  { name: "Cut your AI coding bill", href: "/blog/reduce-ai-coding-costs" },
];

function Column({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h3>{title}</h3>
      <ul>
        {links.map((l) => (
          <li key={l.href}>
            {l.board ? (
              <BoardLink>{l.name}</BoardLink>
            ) : l.external ? (
              <a href={l.href} target="_blank" rel="noopener noreferrer">{l.name}</a>
            ) : (
              <Link href={l.href}>{l.name}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  const tools = FEATURED_TOOLS.map((t) => ({ name: t.key === "claude" ? "Claude Code" : toolLabel(t.key), href: `/tool/${t.key}` }));
  const community = [
    { name: "GitHub", href: "https://github.com/sculptdotfun/viberank", external: true },
    { name: "viberank-cli on npm", href: "https://www.npmjs.com/package/viberank-cli", external: true },
    { name: "ccusage", href: "https://github.com/ryoppippi/ccusage", external: true },
    { name: "Tako: run many agents at once", href: TAKO_URL, external: true },
    { name: "Report an issue", href: "https://github.com/sculptdotfun/viberank/issues", external: true },
  ];
  return (
    <footer className="vr-footer">
      <div className="vr-in">
        <div className="vr-fcols">
          <Column title="Boards" links={BOARDS} />
          <Column title="By tool" links={tools} />
          <Column title="Resources" links={RESOURCES} />
          <Column title="Guides" links={GUIDES} />
          <Column title="Community" links={community} />
        </div>
        <div className="vr-ft">
          <span>viberank · open source, MIT · © {new Date().getFullYear()}</span>
          <span>
            <Link href="/records">Records</Link> · <Link href="/weeks">Weeks</Link> · <Link href="/fleets">Fleets</Link> · <Link href="/data">Data</Link> ·{" "}
            <Link href="/blog/how-viberank-checks-submissions">Rules</Link> · <Link href="/privacy">Privacy</Link> ·{" "}
            <a href="https://github.com/sculptdotfun/viberank" target="_blank" rel="noopener noreferrer">GitHub</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
