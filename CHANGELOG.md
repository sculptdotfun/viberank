# Changelog

## v2.0 — Multi-tool leaderboard (June 2026)

viberank evolved from a Claude Code leaderboard into the leaderboard for **all AI coding usage** — Claude Code, Codex, Gemini CLI, Copilot, OpenCode and every other tool [ccusage](https://github.com/ryoppippi/ccusage) tracks.

### Fixed
- **Submissions were failing** with `Invalid date format: undefined` — ccusage v20's default report keys daily rows by `period` (not `date`). All ccusage report shapes are now normalized server-side at a single chokepoint (`src/lib/ccusage.ts`), so old and new output both work. (#49)
- **"Token totals don't match" rejections** for Gemini/Codex users — reasoning/thinking tokens are counted in `totalTokens` but not broken out by ccusage. The token check is now one-sided (`total >= components`) with a cost/token ratio guard as the anti-inflation defense. (#48)
- Merge button / web upload RLS failures: all writes (claim/merge, upload, admin flag) now run through authenticated server routes with the service-role client. (#42, #47)
- Token stats now roll over to trillions (`2.3T`, previously `2305.1B`).

### Added
- **Multi-tool support** (#45): submissions record which tools contributed (`submissions.tools[]`, `daily_breakdowns.agents[]`, migration `002`); tool chips on every row; an "All tools / Claude / Codex / …" filter.
- **Per-tool leaderboards** at `/tool/claude`, `/tool/codex`, `/tool/gemini`, `/tool/copilot`, `/tool/opencode` — server-rendered with FAQ + structured data.
- **Server rendering everywhere**: homepage (first page + stats, ISR 5 min), profiles (single cached DB read shared with metadata), tool boards (ISR hourly). Structured data: FAQPage, ProfilePage, BreadcrumbList, BlogPosting.
- **Global rank** on profile pages.
- **Full redesign**: editorial scrolling layout with hero, top-3 podium, sticky filter bar, homepage FAQ, site footer; flat dark theme (no gradients).
- **Blog**: three data-backed posts (tool cost comparison, what Claude Code costs, cutting your AI coding bill) + Tailwind Typography (post formatting was previously broken).
- `pnpm test`: zero-dependency test harness for ccusage normalization/validation (`test/ccusage.test.mts`).

### Changed
- npm packages renamed (the old names belong to the original author): CLI is now [`viberank-cli`](https://www.npmjs.com/package/viberank-cli) (v1.1.0, pinned to `ccusage daily --json`), MCP server is [`viberank-mcp`](https://www.npmjs.com/package/viberank-mcp).
- Branding broadened additively: "Claude Code, Codex & AI Coding Leaderboard" (the Claude Code keyword is preserved everywhere for SEO; no URL changes).
- Historical submissions backfilled with tools derived from their `models_used`.

### Removed
- The dormant Convex backend — viberank is Supabase-only. The Vercel build no longer wraps `convex deploy`.

### Known limitations
- Multi-machine submissions with overlapping dates overwrite rather than sum daily data (#43) — ccusage exposes no machine identifier; a CLI-supplied machine ID is the planned fix.
