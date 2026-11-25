# viberank for Claude Code

Your weekly [viberank](https://www.viberank.app) rank, where you already look.

- **Syncs on its own.** When a Claude Code session starts or ends, the plugin starts `npx -y viberank-cli@latest submit --quiet` in the background, at most once an hour. It never blocks the session and prints nothing into it. No launchd, systemd or Task Scheduler job.
- **Your rank in the status line.** `vr #41/126 ▲6 · $27 to @palewave`: rank of N on this week's board, movement since last week, and the dollars to pass the person above. Read from a local file, so it costs no network call.
- **`/viberank`** shows the longer line and the links to your week's recap.

## Install

You need Node 18+ and a viberank token (the sync signs submissions with it).

1. Sign in once from a terminal. This submits, saves your token and writes your first standing:

   ```sh
   npx viberank-cli
   ```

   (Or `npx viberank-cli login --token vbr_…` with a token from https://www.viberank.app/settings/tokens.)

2. Add the marketplace and install the plugin, inside Claude Code:

   ```
   /plugin marketplace add https://raw.githubusercontent.com/sculptdotfun/viberank/main/packages/viberank-claude-plugin/.claude-plugin/marketplace.json
   /plugin install viberank@viberank
   ```

   From a shell: `claude plugin marketplace add <same URL>` and `claude plugin install viberank@viberank`.

3. Start a new session. The first SessionStart copies the status-line script to `~/.viberank/statusline.mjs` (a path that survives plugin updates) and starts the first sync.

## Status line

Plugins cannot set the status line, so add it to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.viberank/statusline.mjs",
    "padding": 0
  }
}
```

Already have a status line? Append the segment to it, e.g. in your script:

```sh
echo "$(your-existing-line) · $(node ~/.viberank/statusline.mjs)"
```

Formats: `node ~/.viberank/statusline.mjs --format <f>`, or set `VIBERANK_STATUS_FORMAT`.

| format    | prints |
|-----------|--------|
| `short`   | `vr #41/126 ▲6 · $27 to @palewave` (default) |
| `compact` | `#41 ▲6` |
| `long`    | `viberank wk48 d3 · #41/126 Ranked ▲6 · $835 · $27 to @palewave · 4w streak` |
| `json`    | the saved record |
| template  | e.g. `"{rank}/{of} {move} wk{week}"`; keys: rank, of, move, gap, above, week, day, cost, tokens, plans, class, streak, user, status |

Off the Ranked board the class is named (`vr open #12/40 ▲1`). After Monday 00:00 UTC, until the next sync, it reads `vr wk48 final #41/126`. Colours follow `NO_COLOR` and `--no-color`. `npx viberank-cli status --format short` prints the same line without the plugin.

### ccstatusline

In [ccstatusline](https://github.com/sirmalloc/ccstatusline), add a **Custom Command** widget (`npx ccstatusline@latest`, then Add Widget, Custom Command) with the command `node ~/.viberank/statusline.mjs --format compact` and "preserve colors" on. In `~/.config/ccstatusline/settings.json` the item looks like:

```json
{ "id": "viberank", "type": "custom-command", "commandPath": "node ~/.viberank/statusline.mjs --format compact", "timeout": 1000, "preserveColors": true }
```

## Settings

| env | default | effect |
|-----|---------|--------|
| `VIBERANK_SYNC_HOURS` | `1` | minimum hours between background syncs |
| `VIBERANK_SYNC` | on | `off` stops the plugin syncing (the status line still works) |
| `VIBERANK_TOKEN` | | used instead of the saved token |

The plugin keeps its own stamp in `~/.viberank/plugin-sync.json`. What each sync did is in `~/.viberank/autosubmit.log`, the same log the CLI's scheduled job writes. `npx viberank-cli status` shows both.

If you also turned on `npx viberank-cli autosubmit`, the two do not double-submit: a sync skips itself within an hour of any successful submission. You can turn the scheduled job off with `npx viberank-cli autosubmit off` once the plugin is in.

## What it sends

The same as the CLI: daily totals from [ccusage](https://github.com/ryoppippi/ccusage) (tokens, API-equivalent cost, models, tools). No prompts, code or file contents. See https://www.viberank.app/privacy.

## Layout

```
.claude-plugin/plugin.json       manifest
.claude-plugin/marketplace.json  single-plugin marketplace (git-subdir source)
hooks/hooks.json                 SessionStart + SessionEnd -> scripts/sync.mjs
scripts/sync.mjs                 debounced, detached sync; installs the status line
scripts/statusline.mjs           status line (identical to viberank-cli's lib/statusline.js)
commands/viberank.md             /viberank
```

Format reference: https://code.claude.com/docs/en/plugins-reference, https://code.claude.com/docs/en/hooks, https://code.claude.com/docs/en/statusline, https://code.claude.com/docs/en/plugin-marketplaces.
