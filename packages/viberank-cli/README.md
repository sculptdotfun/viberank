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
| `npx viberank-cli openrouter` | Publish what you actually pay on OpenRouter |
| `npx viberank-cli openrouter off` | Stop publishing it and forget the key |

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

## Real OpenRouter spend

The leaderboard ranks **API-equivalent** usage that ccusage computes from local logs. If you pay OpenRouter, you can also publish what you **actually paid**:

```bash
npx viberank-cli openrouter
```

Your profile then shows a separate "Real spend · OpenRouter" block: your all-time spend, the last 30 days, and a per-model split. It is **never added to your leaderboard total or rank**. Tools that route through OpenRouter (OpenClaw, OpenCode, Hermes, …) are already counted there from their local logs, so adding OpenRouter's figures would count that usage twice.

**Use a management key** (create one at [openrouter.ai/settings/management-keys](https://openrouter.ai/settings/management-keys)). It can read your account's all-time spend and 30 days of per-day, per-model detail. A normal API key works too, but it only exposes that one key's spend, so the profile labels it "this API key only" and has no per-model split.

**The key never leaves your machine.** The CLI calls OpenRouter directly and sends viberank only daily totals (spend, BYOK spend, requests, tokens, per-model split) and the all-time total. The key is saved to `~/.viberank/config.json` at mode `0600`, next to your viberank token.

- It needs a viberank token (`npx viberank-cli login`), because spend is published under a signed identity.
- `OPENROUTER_MANAGEMENT_KEY` or `OPENROUTER_API_KEY` is offered if set. Scheduled runs only use the key you saved with this command, never the environment, so an unrelated `OPENROUTER_API_KEY` can't start publishing your spend.
- With `autosubmit` on, each daily run refreshes it after the usage submission. That step is best effort: a failure logs one line and never fails the submission.
- BYOK spend (billed by your own provider keys through OpenRouter) is shown separately.
- `npx viberank-cli openrouter off` forgets the key. Spend already published stays on the profile.

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
