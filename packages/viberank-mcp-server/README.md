# viberank MCP server

Submit your AI coding usage (Claude Code, Codex, Gemini CLI, OpenCode and every other tool [ccusage](https://github.com/ryoppippi/ccusage) reads) to [viberank](https://www.viberank.app), and read the leaderboard, from any MCP client.

## Install

### Claude Code

```bash
claude mcp add --scope user viberank -- npx -y viberank-mcp
```

To have submissions verified and filed under your account automatically, add an API token. Mint one at [viberank.app/settings/tokens](https://www.viberank.app/settings/tokens) (sign in with GitHub, then **Create token**); it starts with `vbr_`:

```bash
claude mcp add --scope user viberank --env VIBERANK_TOKEN=vbr_… -- npx -y viberank-mcp
```

On native Windows (not WSL), `npx` has to go through `cmd /c`:

```bash
claude mcp add --scope user viberank -- cmd /c npx -y viberank-mcp
```

`--scope user` makes the server available in every project. Check it with `claude mcp list`.

### Claude Desktop

Add this to `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`, Windows: `%APPDATA%\Claude\`), then restart Claude Desktop. Leave out the `env` block if you don't have a token.

```json
{
  "mcpServers": {
    "viberank": {
      "command": "npx",
      "args": ["-y", "viberank-mcp"],
      "env": {
        "VIBERANK_TOKEN": "vbr_…"
      }
    }
  }
}
```

On Windows, use `cmd /c`:

```json
{
  "mcpServers": {
    "viberank": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "viberank-mcp"],
      "env": {
        "VIBERANK_TOKEN": "vbr_…"
      }
    }
  }
}
```

### Other MCP clients

Run `npx -y viberank-mcp` as a stdio server. Node.js 18 or newer.

## Which account a submission goes to

- **With a token** (`VIBERANK_TOKEN`, or the one `npx viberank-cli login` saved in `~/.viberank/config.json`): the server files the submission under the token's owner and marks it verified. The MCP server asks viberank who that is before uploading, and the result names that account. No username is needed.
- **Without a token**: `github_username` is required, and it should be your own GitHub handle, because it becomes a public profile. If the agent calls without one, nothing is uploaded. The MCP server suggests a handle instead (the one this machine submitted under before, or the repository's owner when GitHub confirms that's a personal account, never an organization) and the agent asks you to confirm it before calling again. Once a profile is verified, unsigned submissions to it are refused, so nobody else can write to yours.

## Tools

### `get_usage`

Runs `ccusage@20 daily --json --by-agent` locally and returns a summary: API-equivalent cost, tokens, days tracked, date range and cost per tool. Sends nothing. Cached for 5 minutes.

- `force_refresh` (boolean, optional): re-run ccusage instead of using the cache.

### `submit_to_viberank`

Uploads your usage to the leaderboard. On success it returns the account it was filed under, your profile URL, your standing (rank, top percentage, tier, and README badge markdown), and next steps the agent can offer: adding the badge to your README, and turning on daily autosubmit with `npx viberank-cli login` and `npx viberank-cli autosubmit`.

- `github_username` (string): your GitHub username. Required without a token, not needed with one.

### `get_leaderboard`

The current leaderboard: rank, username, cost, tokens, tools and verified status for each entry.

- `limit` (integer, optional): 1 to 50, default 10.
- `tool` (string, optional): rank only users of one tool, such as `claude`, `codex`, `gemini`, `opencode` or `copilot`.

### `get_profile`

One developer's profile: rank, cost, tokens, days tracked, tools and verified status. Says `found: false` when there's no profile for that username.

- `username` (string, required): the GitHub username.

### `get_stats`

Site-wide numbers from [`/api/stats`](https://www.viberank.app/api/stats): developer count, total spend and tokens, monthly spend percentiles, tool and model adoption, the monthly trend and tiers, with methodology and caveats.

## Example prompts

- "What's my AI coding usage?"
- "Submit my usage to viberank."
- "Show the top 20 on viberank for Codex."
- "Look up octocat on viberank."
- "How does my monthly spend compare with other developers?"

## What is sent, and where

Only `submit_to_viberank` sends your usage, and only to `https://www.viberank.app/api/submit`. Along with the ccusage report it sends:

- `Authorization: Bearer <token>` when you have a token, otherwise `X-GitHub-User: <username>`.
- `X-Machine-Id`: the anonymous random ID in `~/.viberank/machine-id`, shared with the CLI and created on first use, so usage from your laptop and desktop adds up instead of overwriting.
- `X-Viberank-Client: mcp/<version>`.

The read tools fetch public data from viberank.app. Without a token, `submit_to_viberank` also asks the GitHub API whether a suggested handle is a personal account; only the handle is sent.

## Troubleshooting

- **"VIBERANK_TOKEN is set but is not a viberank token"**: the variable holds something other than `vbr_` plus 43 characters, often the `vbr_…` placeholder from these docs. Paste the real token or remove the variable.
- **"was rejected by viberank"**: the token was revoked. Mint a new one at [viberank.app/settings/tokens](https://www.viberank.app/settings/tokens).
- **"a GitHub username is required"**: there's no token, so tell the agent your GitHub username, or add a token.
- **"No usage found"**: ccusage found no logs on this machine. Use Claude Code, Codex or another supported tool first.
- **"Could not run ccusage@20"**: check that `npx --version` works and that the machine is online; the first run downloads ccusage.

## Development

```bash
npm install
npm run build    # tsc into dist/
npm test         # unit tests, no network
npm run smoke    # starts dist/index.js over stdio and calls the read tools against viberank.app
npm run smoke -- --usage   # also runs get_usage (ccusage, local only)
```

The smoke test never calls `submit_to_viberank`.

The package is listed in the [MCP registry](https://registry.modelcontextprotocol.io) as `io.github.sculptdotfun/viberank` (`mcpName` in `package.json`, metadata in `server.json`). Keep the `version` fields in `server.json` in step with `package.json`.

## Links

- [viberank](https://www.viberank.app)
- [Source](https://github.com/sculptdotfun/viberank/tree/main/packages/viberank-mcp-server)
- [Issues](https://github.com/sculptdotfun/viberank/issues)
- [viberank-cli](https://www.npmjs.com/package/viberank-cli), for submitting from a terminal and daily autosubmit

## License

MIT
