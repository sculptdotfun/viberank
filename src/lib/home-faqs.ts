// Homepage FAQ content — shared by the visible FAQ section (client) and the
// FAQPage JSON-LD emitted by the server page, so they can never drift.
export const HOME_FAQS = [
  {
    q: "What is viberank?",
    a: "viberank is a community leaderboard for AI coding usage. Developers submit their real usage data — exported by ccusage from Claude Code, Codex, Gemini CLI and other tools — and get ranked by cost and tokens.",
  },
  {
    q: "How do I get on the leaderboard?",
    a: "Run npx viberank-cli in your terminal. It reads your local ccusage data across all supported tools and submits it. Sign in with GitHub to get a verified badge.",
  },
  {
    q: "Which AI coding tools are supported?",
    a: "Everything ccusage tracks: Claude Code, OpenAI Codex, Gemini CLI, GitHub Copilot CLI, OpenCode, and more. Each submission records which tools contributed, and you can filter the board per tool.",
  },
  {
    q: "Is the data verified?",
    a: "Submissions are validated server-side (token math, cost/token ratio, date sanity). Signing in with GitHub marks your submission verified with a blue check; unverified CLI rows show a 'cli' badge.",
  },
  {
    q: "What is tokenmaxxing?",
    a: "Tokenmaxxing is racking up AI token usage to climb a leaderboard — the trend that gave the world Meta's 'Claudeonomics' board and a Wikipedia entry. viberank is the public, opt-in version: real ccusage data, validated server-side, ranked openly instead of mandated by your employer.",
  },
  {
    q: "How do I check my OpenAI Codex token usage?",
    a: "Codex CLI logs sessions locally under ~/.codex. Run npx ccusage@latest daily to see per-day tokens and API-equivalent cost, or npx viberank-cli to submit it and see how you rank on the Codex leaderboard.",
  },
  {
    q: "What are viberank tiers?",
    a: "Every developer holds a spend tier based on their best submission: Spark ($0+), Ember ($100+), Flame ($1K+), Blaze ($5K+), Inferno ($15K+) and Supernova ($50K+). Tier badges appear on the leaderboard, your profile and your share card — and your profile shows exactly how far you are from the next tier.",
  },
];
