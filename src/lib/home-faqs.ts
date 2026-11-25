// Homepage FAQ content — shared by the visible FAQ section (client) and the
// FAQPage JSON-LD emitted by the server page, so they can never drift.
export const HOME_FAQS = [
  {
    q: "What is viberank?",
    a: "viberank is the weekly league for AI coding. Your real usage, read by ccusage from Claude Code, Codex, Gemini CLI and other tools, is ranked every week from Monday 00:00 UTC. The lifetime board still lives at /records.",
  },
  {
    q: "How do I get on the leaderboard?",
    a: "Run npx viberank-cli in your terminal. It reads your local ccusage data, submits it, and prints your rank for this week. Say yes to autosubmit, or install the Claude Code plugin, and your week keeps itself up to date.",
  },
  {
    q: "What do Ranked, Open and Fleets mean?",
    a: "Ranked is the main board: GitHub-verified developers at human scale, up to 10 plan-equivalents a week, with nothing under review. Fleets holds entries above that line, such as teams or agent farms under one name. Open holds everyone else, with the reason shown on the row.",
  },
  {
    q: "Which AI coding tools are supported?",
    a: "Everything ccusage tracks: Claude Code, OpenAI Codex, Gemini CLI, GitHub Copilot CLI, OpenCode, and more. Each submission records which tools contributed, and you can filter the board per tool.",
  },
  {
    q: "Is the data verified?",
    a: "Submissions are validated server-side (token math, cost/token ratio, date sanity). Signing in with GitHub verifies your handle, which the Ranked board requires. Unusual entries are marked under review and move to Open until cleared, and a closed week is frozen 12 hours after Monday 00:00 UTC.",
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
    a: "Tiers mark lifetime spend: Spark ($0+), Ember ($100+), Flame ($1K+), Blaze ($5K+), Inferno ($25K+), Supernova ($100K+) and Hypernova ($250K+). They show on /records and your profile. The weekly board ranks this week only, so a new developer can place in seven days.",
  },
];
