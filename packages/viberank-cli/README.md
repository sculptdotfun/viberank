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

A one-off submission freezes your rank on the day you ran it. Two commands fix that permanently:

```bash
npx viberank-cli login       # paste a token from viberank.app/settings/tokens
npx viberank-cli autosubmit  # submit once a day, in the background
```

Most people run these once and never think about it again.

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
GITHUB_USER=$(git config user.name)

curl -X POST https://www.viberank.app/api/submit \
  -H "Content-Type: application/json" \
  -H "X-GitHub-User: $GITHUB_USER" \
  -d @cc.json
```

## Verification

Submissions made with a token (`viberank login`) are **verified** and get a blue check immediately.

Without one, the CLI falls back to an `X-GitHub-User` header — anyone can set that, so those rows appear with a `cli` badge (unverified). Sign in to [viberank.app](https://www.viberank.app) with the same GitHub account and the site will offer to verify or merge them into your profile.

## Troubleshooting

- **"npx viberank-cli" not found** — try `npx viberank-cli@latest` or clear the npx cache with `npx clear-npx-cache`
- **"Failed to submit data"** — regenerate with `npx ccusage@latest daily --json > cc.json` and retry
- **"GitHub username not found"** — run `git config --global user.name "YourGitHubUsername"`
- **"No usage data"** — make sure you've used a supported AI coding tool at least once on this machine
- **Autosubmit isn't firing** — `npx viberank-cli status` prints the schedule state and the last few log lines from `~/.viberank/autosubmit.log`
- **"Invalid token"** — it may have been revoked; mint a fresh one at [viberank.app/settings/tokens](https://www.viberank.app/settings/tokens) and run `login` again

## Data validation

Submissions are validated server-side:
- **Token math** — `totalTokens >= input + output + cache_creation + cache_read`. The total may exceed the components because reasoning/thinking tokens (Gemini, Codex, Claude extended thinking) are counted in the total but not broken out by `ccusage`
- **Cost/token ratio** must fall in a realistic band (the anti-inflation guard)
- No negative values; dates must be valid `YYYY-MM-DD` and not past end-of-tomorrow UTC
- Implausibly high totals are rejected; unusually high daily usage may be flagged for review

Full ruleset: [VALIDATION.md](https://github.com/sculptdotfun/viberank/blob/main/VALIDATION.md).

## About

viberank is a community leaderboard for AI coding usage — real costs and tokens measured by [ccusage](https://github.com/ryoppippi/ccusage), not self-reported numbers. See how you stack up at [viberank.app](https://www.viberank.app), or browse the per-tool boards: [Claude](https://www.viberank.app/tool/claude) · [Codex](https://www.viberank.app/tool/codex) · [Gemini](https://www.viberank.app/tool/gemini).
