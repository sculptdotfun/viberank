# viberank-cli

Submit your AI coding usage stats — **Claude Code, Codex, Gemini CLI, Copilot, OpenCode and more** — to the [viberank](https://www.viberank.app) leaderboard.

## Usage

No install needed:

```bash
npx viberank-cli
```

This will:
1. Generate your usage data with `ccusage daily --json` (aggregated across **all** AI coding tools detected on your machine)
2. Submit it to the viberank leaderboard
3. Give you a link to your profile

## Stay on the board

Claude Code deletes session transcripts older than `cleanupPeriodDays` — **30 days by default** — on startup, with no warning and no recovery. Every tool that reads those files loses that history at the same moment. What you have already submitted here survives it.

A one-off submission also freezes your rank on the day you ran it. Two commands fix both:

```bash
npx viberank-cli login       # paste a token from viberank.app/settings/tokens
npx viberank-cli autosubmit  # submit once a day, in the background
```

Most people run these once and never think about it again.

To stop the deletion at the source as well, add `"cleanupPeriodDays": 3650` to `~/.claude/settings.json`.

History that is already gone can still be estimated. Claude Code's `/stats` counter (`~/.claude/stats-cache.json`) keeps lifetime per-model totals, and per-day totals for recent days, after the transcripts are deleted. `npx viberank-cli backfill` rebuilds the missing days from it:

- Days the counter still itemises but whose transcripts are gone are taken as itemised. The earlier window (lifetime total minus every itemised day) is spread over its days by Claude Code's own per-day message count, so its per-day split is an allocation, not a measurement.
- The counter adds `usage` from every transcript line of a message, and Claude Code writes one line per content block, so it runs about 2× ccusage (more for output and cache writes than for cache reads). `backfill` measures that ratio on your own machine, per model and token type, on days where it can reproduce the counter from your surviving transcripts to the token, and divides by it. With fewer than 5 such days it refuses to estimate.
- The days are submitted flagged `estimated`: they count on your profile and the board, stay out of the monthly reports, and give way to real numbers on any day Claude Code usage is measured. Running it again replaces the previous estimate.

Run `npx viberank-cli backfill --dry-run` first to see the window, the measured ratio and the estimate without submitting anything.

`autosubmit` registers with your operating system's own scheduler — **launchd** on macOS, a **systemd user timer** on Linux, **Task Scheduler** on Windows — instead of running a daemon of its own. Those already survive reboots, catch up after a missed run, and write logs; a node process sitting in your tray to fire once a day would be a worse version of software you already have.

## Commands

| Command | What it does |
|---|---|
| `npx viberank-cli` | Submit now, interactively |
| `npx viberank-cli login` | Save an API token |
| `npx viberank-cli logout` | Forget the saved token |
| `npx viberank-cli autosubmit` | Submit once a day in the background |
| `npx viberank-cli autosubmit off` | Stop submitting automatically |
| `npx viberank-cli status` | Show token and schedule state |
| `npx viberank-cli backfill` | Add Claude Code history whose transcripts are gone, as estimated days (`--dry-run` to preview) |

### Global install (optional)

```bash
npm install -g viberank-cli
viberank
```

## Prerequisites

- Node.js 14 or higher
- You've used at least one supported AI coding tool (Claude Code, Codex, Gemini CLI, …)
- Either an API token (`viberank login`), or git configured with your GitHub username

## Tokens

Mint one at **[viberank.app/settings/tokens](https://www.viberank.app/settings/tokens)**. A token both authenticates a background run and marks the submission **verified**, so it earns a blue check without a browser sign-in.

`login` writes it to `~/.viberank/config.json` at mode `0600`. `VIBERANK_TOKEN` takes precedence, so CI and containers never need a file on disk:

```bash
VIBERANK_TOKEN=vbr_… npx viberank-cli
```

Only the SHA-256 of a token is ever stored server-side; the plaintext is shown once and is unrecoverable. Revoke a leaked one from the same page.

## Multiple machines

Supported — a laptop and a desktop sum into one profile rather than overwriting each other. Each machine writes an anonymous random UUID to `~/.viberank/machine-id` on first run and the server keeps usage as a per-machine slice. No hardware or identifying information is involved.

Your totals also never silently drop: if a re-submission reports less than that machine previously contributed — a pruned `~/.claude/projects`, a fresh install — the higher prior figure is retained. The CLI does report per-month file and byte **counts** of your transcript corpus so genuine deletion can be told apart from a partial export. Counts only; no transcript content leaves your machine.

## Manual usage

Generate the data yourself first if you prefer:

```bash
# Generate usage data across all detected tools
npx ccusage@latest daily --json > cc.json

# Submit it
npx viberank-cli
```

The CLI detects the existing `cc.json` and asks whether to use it.

## Direct API usage

```bash
GITHUB_USER=your-github-username   # your GitHub login, not your display name

curl -X POST https://www.viberank.app/api/submit \
  -H "Content-Type: application/json" \
  -H "X-GitHub-User: $GITHUB_USER" \
  -d @cc.json
```

## Verification

Submissions made with a token (`viberank login`) are **verified** and get a blue check immediately.

Without one, the CLI falls back to an `X-GitHub-User` header — anyone can set that, so those rows appear with a `cli` badge (unverified). Once a username is verified, unverified submissions to it are refused: run `npx viberank-cli login` and submit again.

The username prompt pre-fills the handle this machine last submitted as, and asks before switching to a different one, so a stray answer can't start a second profile.

## Troubleshooting

- **"npx viberank-cli" not found** — try `npx viberank-cli@latest` or clear the npx cache with `npx clear-npx-cache`
- **"Failed to submit data"** — regenerate with `npx ccusage@latest daily --json > cc.json` and retry
- **"GitHub username not found"** — just type it at the prompt. The CLI no longer pre-fills `git config user.name`, because that is usually a display name and accepting it created profiles belonging to nobody (#141)
- **"No usage data"** — make sure you've used a supported AI coding tool at least once on this machine
- **Autosubmit isn't firing** — `npx viberank-cli status` prints the schedule state and the last few log lines from `~/.viberank/autosubmit.log`
- **"@you is verified, so submissions to it need to be signed"** — your profile is verified and this run had no token. Run `npx viberank-cli login`, then submit again
- **"Cost per token ratio is unrealistic"** — the report claims more tokens than its cost could buy at those models' prices. Regenerate with the latest `ccusage`; if it still fails with honest data from a cheap model, open an issue with the model names
- **"Invalid token"** — it may have been revoked; mint a fresh one at [viberank.app/settings/tokens](https://www.viberank.app/settings/tokens) and run `login` again

## Data validation

Submissions are validated server-side:
- **Token math** — `totalTokens >= input + output + cache_creation + cache_read`. The total may exceed the components because reasoning/thinking tokens (Gemini, Codex, Claude extended thinking) are counted in the total but not broken out by `ccusage`
- **Cost floor, per model** — each model's tokens must be covered at that model's price floor (the anti-inflation guard; cheap-cache models like DeepSeek and MiMo have a lower floor)
- No negative values; dates must be valid `YYYY-MM-DD` and not past end-of-tomorrow UTC
- Implausibly high totals are rejected; unusually high daily usage may be flagged for review

Full ruleset: [VALIDATION.md](https://github.com/sculptdotfun/viberank/blob/main/VALIDATION.md).

## About

viberank is a community leaderboard for AI coding usage — real costs and tokens measured by [ccusage](https://github.com/ryoppippi/ccusage), not self-reported numbers. See how you stack up at [viberank.app](https://www.viberank.app), or browse the per-tool boards: [Claude](https://www.viberank.app/tool/claude) · [Codex](https://www.viberank.app/tool/codex) · [Gemini](https://www.viberank.app/tool/gemini).
