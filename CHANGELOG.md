# Changelog

## Site — usage from a machine that no longer submits stays counted (September 2026)

### Fixed
- **Unattributed usage is compared model by model, not as a whole day.** A day holding both a no-machine-id slice (web uploads, pre-1.2 CLIs) and id'd machine slices showed only the larger of the two (#81), so a replaced or wiped machine's history hid every other machine's usage that day. Where both sides carry a complete per-model split, each model now takes the larger side and models only one side used are added. A copy of an id'd machine's day still matches it model for model and adds nothing, including across ccusage model renames (date suffixes, provider paths, dotted versions); the tool prefix counts as usage, so `[openclaw] claude-opus-4-6` is not folded into `claude-opus-4-6`. Days without a complete split keep the whole-day rule.
- Same-model days from a retired machine can't be told apart from a copy automatically and remain counted once.

### Operations
- `POST /api/admin/recompute-unattributed` re-derives stored days that hold an unattributed slice beside id'd ones, since aggregates are written at submit time. Admin only. `{}` reports what would change; `{ "apply": true, "limit": 50 }` writes the largest changes first and re-sums each affected submission. Idempotent: repeat until `pending` is 0.

## MCP v1.1.0 — signed submissions (September 2026)

### Fixed
- **The MCP server signs submissions with the CLI's API token** (`VIBERANK_TOKEN` or `~/.viberank/config.json`) and sends the CLI's machine ID. It only ever sent `X-GitHub-User`, which the server now refuses for verified usernames, and without a machine ID its uploads couldn't be told apart from the same machine's CLI runs.

### Docs
- README, CLI README, VALIDATION.md and the MCP README describe the lossless merge, one row per user, the verified-profile 403, the per-model cost floor, and the 017 deploy-order exception.

## Site — sign-in emails are actually kept (September 2026)

### Fixed
- **The #148 email capture never wrote a row.** `events.signIn` receives the normalized user from `profile()`, not GitHub's raw profile, so reading `profile.login` returned undefined and the handler exited early on every sign-in. It now reads `user.username`, and a failed write is logged instead of ignored. (Hidden until now by the sign-in outage fixed in #156.)

## Site — reconstructed days stay out of the reports (September 2026)

### Changed
- **Days rebuilt from `stats-cache.json` are marked `estimated`** (migration 018) and skipped by the monthly reports, whose medians, p90s and per-model splits are published as measured figures. They still count on the board, profiles and wrapped: the tokens were really spent, only the per-day split is allocated (#138). 91 days are flagged today.

## CLI v1.11.0 — no more accidental second profiles (September 2026)

### Fixed
- **The username prompt pre-fills the handle this machine last submitted as**, and switching to a different one asks first (default: no). A stray reply to the prompt created the `NO` profile next to its owner's real one (#151), and a guessed default created `Matt` (#141).
- The final prompt names the profile it will write to: `Submit to Viberank as @you (https://www.viberank.app/profile/you)?`

## Site — missing profiles return 404

### Fixed
- `/profile/<unknown>` rendered "Profile not found" with a 200 status; it now returns a real 404 with the same page.

## Site — one row per developer (September 2026)

### Fixed
- **Every submission from a user lands in the same row.** Rows were keyed by source (CLI vs web) and overlapping date range, so switching methods or submitting a non-overlapping range created a second row; 79 users had 171 rows and the board ranked each separately. Per-machine slices already make a single row safe to share.
- **Unverified submissions can no longer write into a verified profile.** A username claim without a token could merge into a verified CLI row and flip it back to unverified. Once a username is verified, unverified submissions to it get a 403 that says to run `npx viberank-cli login`, and the refusal doesn't spend the rate limit.

## Site — machine IDs are private again (September 2026)

### Fixed
- **CLI machine IDs were readable through the public API.** `daily_breakdowns.machine_contributions` is keyed by machine ID and the table is public-read, while `/privacy` lists the machine ID as server-only. Browser-reachable reads now name their columns, and migration 017 withholds that column from the anon and authenticated roles.

## Site — cheap models can submit (September 2026)

### Fixed
- **The cost-per-token floor is priced per model.** A flat 1e-7 floor assumed frontier-lab cache pricing, so honest reports from DeepSeek (cache hits at 2% of a miss) and OpenCode's MiMo/MiniMax/big-pickle models could never submit (#150, #154). Each model's tokens are now held to that model's floor; reports using only standard models are checked exactly as before, and a cheap model can't launder inflated tokens from another model in the same report. Replayed all 3,666 archived submissions: none newly rejected.
- DeepSeek Harness is a recognised tool (`/tool/deepseek`), from @dprvda's #154.

## Site — merges and uploads never delete history (September 2026)

### Fixed
- **Merging submissions is lossless and back on.** The merge now combines every row's per-machine slices per day: the same machine seen twice keeps its larger observation, distinct machines sum, and nothing a row held is dropped. It used to pick one whole row per day with web uploads winning, then delete the rest (#152). Dry-run against every user with duplicate rows: the merged total always lands between their largest row and the sum of rows. Rule from @cjrogerlo's #153.
- **A web upload (no machine ID) no longer wipes other machines' or tools' data for its days** (#138), and a CLI submission no longer drops an earlier web upload's days. Unattributed data now sits beside per-machine data; the day shows whichever is larger, never the sum (#81 still holds).
- **Legacy days (pre-#43) are kept** when a newer CLI first submits them, instead of being replaced.
- **A rejected submission no longer spends the hourly rate limit.** Validation ran after the limiter, so a user whose data failed a check had to wait an hour to retry a fix (#150).

## Site — GitHub sign-in works again (September 2026)

### Fixed
- **GitHub sign-in ended at `error=OAuthCallback` for everyone since ~2026-08-21.** GitHub began sending `iss` on OAuth callbacks; next-auth 4.24.11's GitHub provider declared no issuer, so `openid-client` rejected every callback and no session was created. Bumped next-auth to 4.24.15, which carries the upstream fix (nextauthjs/next-auth#13412). CLI submissions and existing API tokens were unaffected; new sign-ins, `/settings/tokens`, verified uploads and sign-in email capture were blocked. Diagnosis credit to @mattw90 (#139) and @dpmango (#147).

## Site — a privacy page (August 2026)

### Added
- **`/privacy`.** Until this week the site stored handles and public usage figures, and the absence of a privacy page was defensible. Storing sign-in emails changed that. The page splits what is public (handle, avatar, usage totals, daily breakdowns, league membership, the opt-in `/hire` address) from what is server-only (the sign-in email, the CLI's machine ID, hashed API tokens, raw ccusage payloads and session-log file counts), says plainly that the email is not used for marketing and that nothing is sent to it today, and documents how to have a profile deleted. Linked from the footer and listed in the sitemap.
- Two things it is careful to state accurately: the CLI's machine ID is a random UUID generated on the user's own machine, not anything derived from their hardware; and the corpus scan records file and byte *counts* of the session-log folder, never contents.

## Site — sign-in emails are kept (August 2026)

### Added
- **The email GitHub already returns at sign-in is now stored.** The `user:email` scope has been requested since launch and the provider callback already mapped `profile.email`, but nothing downstream kept it: the jwt callback carried only `username`, sessions are stateless, and profiles are created by `/api/submit` rather than by signing in. Every sign-in since launch discarded a working address. Measured cost of that: 1,125 developers and 8 addresses on file, all volunteered through `/hire` — so there is no way to tell the 736 profiles whose data stopped more than 90 days ago that autosubmit finally works. Backfill is not available: only 18% of profiles expose a public email on GitHub (7 of a random 40, with 5 accounts no longer resolving), and GitHub's terms prohibit using site information to send unsolicited mail. Capture is therefore forward-only, starting now.
- Addresses live in a new `profile_emails` table (migration 016) rather than a column on `profiles`, following the same reasoning as invite codes in 015: `profiles` carries a `Public read profiles` policy with `USING (true)` and is read with `select("*")` under the anon key in five places, and RLS is row-level rather than column-level — an email column there would be a published email column. The new table has RLS enabled and **no policies at all**, so only the service role can touch it. Verified against production: with a row present, the anon key reads `[]` and its insert is rejected `42501`.
- Persisted from a NextAuth `signIn` **event** rather than a callback, so a write failure can never cost someone their sign-in, and the address never enters the session or reaches the browser.

## CLI v1.10.0 — autosubmit is a backup, not a rank chore (August 2026)

### Changed
- **The autosubmit prompt now leads with what is actually at stake.** Claude Code deletes session transcripts older than `cleanupPeriodDays` — 30 by default — on startup, with no warning and no recovery; every tool reading `~/.claude/projects` loses that history at the same moment, and a report already submitted here survives it. The old pitch ("keep my rank up to date") was the vanity reason and converted badly: 62 of ~1,100 people had ever sent a second report. On our own data 38.7% of submissions span 31 days or less, with the 25th percentile sitting exactly at 30 — the default's fingerprint. When a report reaches back roughly that far the prompt says so, hedged, because a five-week-old install is indistinguishable from a pruned one.
- **Saying yes without a token no longer dead-ends.** It printed two commands to run later and stopped — at the exact moment someone had just agreed. `login` is now a reusable non-fatal token flow the prompt runs inline.
- After enabling, the CLI also says how to stop the loss at its source: `"cleanupPeriodDays": 3650`.

### Fixed
- `historyWindow` read only `date`, but ccusage's aggregate report keys days as `period` — the personalised line would have silently never appeared on a real report while passing every fixture written with `date`. Caught by rendering against a real `cc.json`.
- The history reach was computed from the raw clock, so the same report read 29 days at midnight and 30 at noon.

## CLI v1.9.0 — a Claude cleanup no longer lowers Codex (August 2026)

### Fixed
- **A drift verdict about Claude files lowered the whole day, including other tools** (#125). The corpus scan reads `~/.claude/projects` and is evidence about Claude alone, but a mixed day was stored as one lump per machine, so honouring a Claude deletion took the same day's untouched Codex tokens with it. Mixed days are 9.18% of daily rows but **34.33% of all cost on the board**. The CLI now passes `ccusage --by-agent`, whose per-agent slices reconcile with their row to $0.000000 across a real 103-day report; the server keeps a split only when it reconciles and lowers the corpus agent alone. Reports without a split behave exactly as before, and the flag is dropped silently if an older ccusage rejects it.
- **`git config user.name` was pre-filled as the username prompt's default** (#141), so a reflexive Enter submitted under it. That created a public profile called `Matt` holding 86B tokens belonging to `mattw90` — both submissions shared a machine id. Validation cannot catch this: `Matt` is a well-formed GitHub handle. Only a GitHub remote pre-fills now; a git-config guess is shown in the question instead.

## CLI v1.8.0 — you find out where you landed (August 2026)

### Added
- A successful submission now prints your rank, percentile and tier, plus a paste-ready README badge. Only 3 repositories on GitHub embedded a viberank badge, because the success path never gave anyone anything to share.

## CLI v1.7.0 — autosubmit is offered where it makes sense (August 2026)

### Added
- The CLI offers autosubmit after a successful submission, defaulted to yes, instead of leaving it buried in `/settings/tokens` where almost nobody found it. Deliberately a prompt and not a silent default: it installs a scheduled job that uploads daily.

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
