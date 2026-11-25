/**
 * The commands the site tells people to run, in one place so every copy
 * button, page and llms.txt hands out the same line.
 */

/** Reads local usage with ccusage and submits it. */
export const CLI_COMMAND = "npx viberank-cli";

/**
 * Daily submissions from the OS scheduler. `autosubmit` on its own fails
 * without a token, which is where the modal's copy button used to leave
 * people, so the line logs in first.
 */
export const AUTOSUBMIT_COMMAND = "npx viberank-cli login && npx viberank-cli autosubmit";

/** Adds the viberank MCP server to Claude Code, after which Claude can submit for you. */
export const MCP_COMMAND = "claude mcp add --scope user viberank -- npx -y viberank-mcp";

/** Writes the file the web upload takes. */
export const CCUSAGE_EXPORT_COMMAND = "npx ccusage@latest daily --json > cc.json";

/**
 * The Claude Code plugin, from the repo-root marketplace
 * (.claude-plugin/marketplace.json). Run inside Claude Code.
 */
export const PLUGIN_MARKETPLACE_COMMAND = "/plugin marketplace add sculptdotfun/viberank";
export const PLUGIN_INSTALL_COMMAND = "/plugin install viberank@viberank";

/** The status-line entry the plugin README asks for in ~/.claude/settings.json. */
export const PLUGIN_STATUSLINE_JSON = `"statusLine": { "type": "command", "command": "node ~/.viberank/statusline.mjs", "padding": 0 }`;

/** A prompt to paste into Claude Code, Codex or Cursor: the agent installs and runs viberank for you. */
export const AGENT_PROMPT = `Put me on viberank (https://www.viberank.app), the weekly league for AI coding usage.
1. Run \`npx viberank-cli --help\` to see the options. If I have a token (VIBERANK_TOKEN or ~/.viberank/config.json), run \`npx viberank-cli\`. Otherwise ask me for my GitHub handle and run \`npx viberank-cli --user <handle> --yes\`.
2. Tell me my rank this week and the gap to the person above, from the CLI output.
3. Ask before turning on daily sync (\`npx viberank-cli login\`, then \`npx viberank-cli autosubmit\`). If you are Claude Code, offer the plugin instead: \`/plugin marketplace add sculptdotfun/viberank\` and \`/plugin install viberank@viberank\`.
Only daily totals leave the machine (tokens, API-equivalent cost, models, tools). Never send code, prompts or file contents.`;
