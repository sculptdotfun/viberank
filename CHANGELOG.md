# Changelog

## CLI v1.6.0 — Windows submissions work again (August 2026)

### Fixed
- **`npx viberank-cli` died on Windows** with `Error: spawnSync C:\Program Files\nodejs\npx.cmd EINVAL`, submitting nothing (#137). v1.5.0 started resolving npx next to the running node binary so scheduled jobs wouldn't need PATH — but on Windows the only thing on disk named npx is `npx.cmd`, and Node has refused to spawn a batch shim without `shell: true` since the CVE-2024-27980 fix (18.20.2 / 20.12.2 / 21.7.3). Every Windows run that regenerated `cc.json` hit it. npx is now invoked as npm's own `npx-cli.js` through the already-running node binary: absolute, shell-free, and identical on every platform (`packages/viberank-cli/lib/npx.js`).
- **Autosubmit on Windows scheduled `npx` as a program**, which Task Scheduler cannot launch either; the daily and logon tasks now carry the same node + `npx-cli.js` argv.
- **Autosubmit under Homebrew node was PATH-dependent on macOS.** Homebrew keeps npm outside the node keg and links the two with a symlinked shim, whose `/usr/bin/env node` shebang a launchd job with a minimal PATH cannot satisfy. The shim is now followed to the real `npx-cli.js`.
- `viberank login` opens the token page with `start "" "<url>"` on Windows — `start` reads its first quoted argument as a window title.

## CLI v1.5.0 — autosubmit actually submits (August 2026)

### Fixed
- **Scheduled autosubmit runs never submitted.** Three compounding bugs: `submit --quiet` still ran interactive prompts, which cancel silently (exit 0) with no TTY; `cc.json` was written to the scheduler's working directory (`/` under launchd); and ccusage was invoked via `npx` from PATH, which launchd/schtasks jobs don't have node on. Every scheduled run since the feature shipped was a no-op that looked successful in the logs. `--quiet` (or any non-TTY stdin) now takes a dedicated prompt-free path: token-authenticated, PATH-safe ccusage invocation resolved next to the running node binary, temp file under `~/.viberank/`, network retries with backoff, and one timestamped log line per run — success or failure, with a real exit code.
- **Missed-run catch-up now works on all three platforms**, not just Linux. launchd's calendar trigger doesn't fire across a power-off, and schtasks DAILY doesn't catch up either; macOS now also runs at login (`RunAtLoad`) and Windows gains an `ONLOGON` companion task. A 20-hour staleness guard in the CLI keeps catch-up triggers from double-submitting.
- The interactive flow now remembers your confirmed GitHub username (`~/.viberank/config.json`) so scheduled runs can label submissions without prompting; the server still resolves identity from the API token either way.

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
