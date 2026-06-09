# viberank-cli

Submit your AI coding usage stats — **Claude Code, Codex, Gemini CLI, Copilot, OpenCode and more** — to the [viberank](https://viberank.app) leaderboard.

## Usage

No install needed:

```bash
npx viberank-cli
```

This will:
1. Generate your usage data with `ccusage daily --json` (aggregated across **all** AI coding tools detected on your machine)
2. Submit it to the viberank leaderboard
3. Give you a link to your profile

### Global install (optional)

```bash
npm install -g viberank-cli
viberank
```

## Prerequisites

- Node.js 14 or higher
- You've used at least one supported AI coding tool (Claude Code, Codex, Gemini CLI, …)
- Git configured with your GitHub username (used to attribute your submission)

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

CLI submissions appear on the leaderboard with a `cli` badge (unverified). Sign in to [viberank.app](https://viberank.app) with the same GitHub account and the site will offer to verify or merge — verified submissions get a blue check.

## Troubleshooting

- **"npx viberank-cli" not found** — try `npx viberank-cli@latest` or clear the npx cache with `npx clear-npx-cache`
- **"Failed to submit data"** — regenerate with `npx ccusage@latest daily --json > cc.json` and retry
- **"GitHub username not found"** — run `git config --global user.name "YourGitHubUsername"`
- **"No usage data"** — make sure you've used a supported AI coding tool at least once on this machine

## Data validation

Submissions are validated server-side:
- **Token math** — `totalTokens >= input + output + cache_creation + cache_read`. The total may exceed the components because reasoning/thinking tokens (Gemini, Codex, Claude extended thinking) are counted in the total but not broken out by `ccusage`
- **Cost/token ratio** must fall in a realistic band (the anti-inflation guard)
- No negative values; dates must be valid `YYYY-MM-DD` and not past end-of-tomorrow UTC
- Implausibly high totals are rejected; unusually high daily usage may be flagged for review

Full ruleset: [VALIDATION.md](https://github.com/sculptdotfun/viberank/blob/main/VALIDATION.md).

## About

viberank is a community leaderboard for AI coding usage — real costs and tokens measured by [ccusage](https://github.com/ryoppippi/ccusage), not self-reported numbers. See how you stack up at [viberank.app](https://viberank.app), or browse the per-tool boards: [Claude](https://www.viberank.app/tool/claude) · [Codex](https://www.viberank.app/tool/codex) · [Gemini](https://www.viberank.app/tool/gemini).
