# viberank

CLI tool to submit your Claude usage stats to the [Viberank](https://viberank.app) leaderboard.

## Usage

Simply run:

```bash
npx viberank
```

This will:
1. Generate your usage data using `ccusage`
2. Submit it to the Viberank leaderboard
3. Give you a link to view your profile

## Prerequisites

- You need to have used Claude Code at least once
- Git should be configured with your GitHub username

## Manual Usage

If you prefer to generate the data separately:

```bash
# Generate usage data
npx ccusage@latest --json > cc.json

# Submit to Viberank
npx viberank
```

The CLI will detect the existing `cc.json` file and ask if you want to use it.

## Direct API Usage

You can also submit directly using curl:

```bash
# Get your GitHub username
GITHUB_USER=$(git config user.name)

# Submit with curl
curl -X POST https://viberank.app/api/submit \
  -H "Content-Type: application/json" \
  -H "X-GitHub-User: $GITHUB_USER" \
  -d @cc.json
```

## Data Validation

Your submissions are automatically validated to ensure data integrity:
- Token calculations must be correct
- No negative values allowed
- Dates must be valid and not in the future
- Extremely high usage may be flagged for review

## About

Viberank is a community leaderboard for Claude Code usage. Join us to see how you stack up against other developers!

Visit [viberank.app](https://viberank.app) to view the leaderboard.