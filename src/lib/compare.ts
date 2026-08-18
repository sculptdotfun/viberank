import { FEATURED_TOOLS, toolLabel } from "@/lib/utils";

/**
 * Static editorial facts for the programmatic /compare/[matchup] pages.
 * Live usage numbers (developer counts, top spenders) come from the data
 * layer at render time; these are the slow-moving facts a comparison needs.
 */
export interface CompareToolFacts {
  key: string;
  /** Full search-intent name ("Claude Code", "Gemini CLI") vs the short chip label. */
  label: string;
  provider: string;
  pricing: string;
  models: string;
  oneLiner: string;
}

export const COMPARE_FACTS: Record<string, CompareToolFacts> = {
  claude: {
    key: "claude",
    label: "Claude Code",
    provider: "Anthropic",
    pricing: "Included with Claude Pro ($20/mo) and Max ($100–$200/mo), or pay-as-you-go via the Claude API",
    models: "Claude models (Opus, Sonnet, Haiku)",
    oneLiner:
      "Anthropic's terminal-first coding agent — the tool that defined the agentic CLI category and still drives the most spend on the board.",
  },
  codex: {
    key: "codex",
    label: "OpenAI Codex",
    provider: "OpenAI",
    pricing: "Included with ChatGPT paid plans, or pay-as-you-go via the OpenAI API",
    models: "OpenAI GPT-5 era Codex models",
    oneLiner:
      "OpenAI's coding agent with CLI, IDE, and cloud modes — the fastest-growing challenger on the leaderboard.",
  },
  gemini: {
    key: "gemini",
    label: "Gemini CLI",
    provider: "Google",
    pricing: "Generous free tier with a personal Google account; paid via Gemini API / Google AI plans",
    models: "Gemini models",
    oneLiner:
      "Google's open-source terminal agent — the easiest free entry point into agentic coding.",
  },
  copilot: {
    key: "copilot",
    label: "GitHub Copilot",
    provider: "GitHub (Microsoft)",
    pricing: "GitHub Copilot subscription tiers, from free with limits to Pro+",
    models: "Multi-model (OpenAI, Anthropic, Google)",
    oneLiner:
      "GitHub's assistant grown into a CLI agent — the default choice for teams already living inside GitHub.",
  },
  opencode: {
    key: "opencode",
    label: "OpenCode",
    provider: "Open source (SST)",
    pricing: "Free and open source — bring your own model subscription or API key",
    models: "Any provider (Anthropic, OpenAI, Google, local models)",
    oneLiner:
      "The open-source terminal agent for people who want Claude Code ergonomics without the lock-in.",
  },
};

export interface CompareMatchup {
  slug: string;
  a: string;
  b: string;
}

// Ordered pairs in FEATURED_TOOLS order: claude-vs-codex, claude-vs-gemini, …
// Only this ordering is generated; the reversed slug 301s to the canonical one.
// Restricted to tools with COMPARE_FACTS entries — newer boards (hermes, pi, …)
// get a /tool page without exploding the matchup grid into thin pages.
const COMPARE_TOOLS = FEATURED_TOOLS.filter((t) => t.key in COMPARE_FACTS);

export const COMPARE_MATCHUPS: CompareMatchup[] = COMPARE_TOOLS.flatMap((a, i) =>
  COMPARE_TOOLS.slice(i + 1).map((b) => ({
    slug: `${a.key}-vs-${b.key}`,
    a: a.key,
    b: b.key,
  }))
);

/** Resolve a slug (either order) to its canonical matchup, or null. */
export function resolveMatchup(slug: string): { matchup: CompareMatchup; canonical: boolean } | null {
  const direct = COMPARE_MATCHUPS.find((m) => m.slug === slug);
  if (direct) return { matchup: direct, canonical: true };
  const parts = slug.split("-vs-");
  if (parts.length !== 2) return null;
  const reversed = COMPARE_MATCHUPS.find((m) => m.a === parts[1] && m.b === parts[0]);
  return reversed ? { matchup: reversed, canonical: false } : null;
}

/** Full search-intent label for a tool key ("Claude Code"), falling back to the chip label. */
export function compareLabel(key: string): string {
  return COMPARE_FACTS[key]?.label ?? toolLabel(key);
}

export function matchupTitle(m: CompareMatchup): string {
  return `${compareLabel(m.a)} vs ${compareLabel(m.b)}`;
}
