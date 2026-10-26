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
