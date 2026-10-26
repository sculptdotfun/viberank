#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import { getMachineId, readToken, rememberedUsername, savedTokenOwner } from './config.js';
import { gitRemoteOwner, isGithubHandle, resolveSubmitIdentity } from './identity.js';
import { CCUSAGE, loadUsage, type ParsedUsage } from './ccusage.js';
import { getJson, requestJson, SITE, type ApiDeps } from './api.js';
import {
  badReport,
  ccusageFailed,
  identityStop,
  leaderboardResult,
  noUsage,
  profileResult,
  reply,
  statsResult,
  submitResult,
  usageResult,
  type ToolResult,
  type Uploadable,
} from './results.js';

// Read at run time so the version the server reports, and the one stamped on
// submissions, can never drift from the published package.
const VERSION: string = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const API: ApiDeps = { fetch: (url, init) => fetch(url, init), userAgent: `viberank-mcp/${VERSION}` };
const CACHE_MS = 5 * 60 * 1000;

const TOOLS = [
  {
    name: 'get_usage',
    description:
      "Read the user's local AI coding usage (Claude Code, Codex, Gemini CLI, OpenCode and the other tools " +
      `ccusage supports) by running ${CCUSAGE} on this machine. Returns a summary: API-equivalent cost in USD, ` +
      'tokens, days tracked, date range and cost per tool. Sends nothing anywhere. Can take a minute on a long ' +
      'history; results are cached for 5 minutes.',
    inputSchema: {
      type: 'object',
      properties: {
        force_refresh: { type: 'boolean', description: 'Re-run ccusage instead of using the 5-minute cache.', default: false },
      },
    },
  },
  {
    name: 'submit_to_viberank',
    description:
      "Upload the user's local usage to the public viberank.app leaderboard. Call it only when the user asked " +
      'to submit. With a VIBERANK_TOKEN configured, the submission is verified and filed under the token\'s ' +
      "account, so leave github_username out. Without a token, github_username is required and must be the user's " +
      'own GitHub handle, confirmed with them, because it becomes a public profile. Called without one, it uploads ' +
      'nothing and suggests a handle to confirm with the user before calling again. On success it returns rank, ' +
      'tier and a README badge you can offer to add.',
    inputSchema: {
      type: 'object',
      properties: {
        github_username: {
          type: 'string',
          description:
            "The user's own GitHub username, as they confirmed it. Not a display name, not an organization. " +
            'Leave it out when VIBERANK_TOKEN is set.',
        },
      },
    },
  },
  {
    name: 'get_leaderboard',
    description:
      'The current viberank leaderboard, ranked by API-equivalent cost. Each entry has rank, username, ' +
      'totalCost (USD), totalTokens, tools, verified, underReview and profileUrl. Pass tool to rank only the ' +
      'users of one tool; get_stats lists the tool slugs.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'How many top entries to return, 1 to 50.', minimum: 1, maximum: 50, default: 10 },
        tool: { type: 'string', description: 'A tool slug such as "claude", "codex", "gemini", "opencode" or "copilot".' },
      },
    },
  },
  {
    name: 'get_profile',
    description:
      "One developer's viberank profile: global rank, total cost and tokens, days tracked, tools and whether " +
      "it is verified. Profiles are keyed by GitHub username. Returns found: false when there's no such profile.",
    inputSchema: {
      type: 'object',
      properties: { username: { type: 'string', description: 'The GitHub username to look up.' } },
      required: ['username'],
    },
  },
  {
    name: 'get_stats',
    description:
      'Site-wide viberank statistics: developer and submission counts, total tokens and API-equivalent cost, ' +
      'monthly spend per developer (median and percentiles), tool and model adoption, the monthly trend and ' +
      "tier counts, with methodology, caveats and a citation line. Use it to compare one developer's spend " +
      "with everyone else's.",
    inputSchema: { type: 'object', properties: {} },
  },
];

/** A tool argument as a trimmed string, with a leading @ dropped from handles. */
function argString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().replace(/^@/, '');
  return trimmed || undefined;
}

/** The leaderboard's own bounds (default 10, at most 50), applied here so an
 * out-of-range request gets the nearest valid answer rather than an error. */
function clampLimit(value: unknown): number {
  const requested = value === undefined || value === null || value === '' ? 10 : Math.trunc(Number(value));
  return Number.isFinite(requested) ? Math.min(50, Math.max(1, requested)) : 10;
}

function submitHeaders(identity: Uploadable): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Viberank-Client': `mcp/${VERSION}`,
    'X-Machine-Id': getMachineId(),
    // With a token the server ignores X-GitHub-User and files the upload under
    // the token's owner. The header is still sent when that owner is known, as
    // the CLI does, so an older server gets a claim that agrees with the token.
    ...(identity.kind === 'token' ? { Authorization: `Bearer ${identity.token}` } : {}),
    ...(identity.username ? { 'X-GitHub-User': identity.username } : {}),
  };
}

class ViberankMCPServer {
  private server: Server;
  private cachedUsage: { at: number; parsed: Extract<ParsedUsage, { status: 'ok' }> } | null = null;

  constructor() {
    this.server = new Server(
      { name: 'viberank-mcp', version: VERSION },
      {
        capabilities: { tools: {} },
        instructions:
          'viberank is a public leaderboard of AI coding usage. The read tools (get_usage, get_leaderboard, ' +
          'get_profile, get_stats) are safe to call. submit_to_viberank publishes data: call it only when the ' +
          'user asks, and confirm their GitHub username with them unless a token is configured.',
      }
    );
    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;
      switch (name) {
        case 'get_usage':
          return this.getUsage(args.force_refresh === true);
        case 'submit_to_viberank':
          return this.submitToViberank(argString(args.github_username));
        case 'get_leaderboard':
          return this.getLeaderboard(args.limit, args.tool);
        case 'get_profile':
          return this.getProfile(argString(args.username));
        case 'get_stats':
          return statsResult(await getJson('/api/stats', API));
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  /** ccusage's report, from the cache unless `fresh`. A failure to run comes
   * back as a tool result, because the agent has to tell the user. */
  private async usage(fresh: boolean): Promise<{ parsed: ParsedUsage; cached: boolean } | ToolResult> {
    if (!fresh && this.cachedUsage && Date.now() - this.cachedUsage.at < CACHE_MS) {
      return { parsed: this.cachedUsage.parsed, cached: true };
    }
    try {
      const parsed = await loadUsage();
      if (parsed.status === 'ok') this.cachedUsage = { at: Date.now(), parsed };
      return { parsed, cached: false };
    } catch (error) {
      return ccusageFailed(error);
    }
  }

  private async getUsage(forceRefresh: boolean): Promise<ToolResult> {
    const result = await this.usage(forceRefresh);
    if ('content' in result) return result;
    const { parsed, cached } = result;
    if (parsed.status === 'empty') return reply(noUsage());
    if (parsed.status === 'invalid') return reply(badReport(parsed.error), true);
    return usageResult(parsed.summary, cached);
  }

  private async submitToViberank(requested: string | undefined): Promise<ToolResult> {
    // Identity first: there is no point spending a minute on ccusage for a
    // submission that is going to be refused or needs the user's answer.
    const identity = await resolveSubmitIdentity(requested, readToken(), {
      site: SITE,
      fetch: API.fetch,
      savedTokenOwner,
      rememberedUsername,
      remoteOwner: () => gitRemoteOwner(),
    });
    if (identity.kind === 'stop') return identityStop(identity);

    const result = await this.usage(true);
    if ('content' in result) return result;
    const { parsed } = result;
    if (parsed.status === 'empty') return reply({ ...noUsage(), submitted: false });
    if (parsed.status === 'invalid') return reply({ ...badReport(parsed.error), submitted: false }, true);

    const response = await requestJson(
      `${SITE}/api/submit`,
      { method: 'POST', headers: submitHeaders(identity), body: JSON.stringify(parsed.report) },
      { ...API, timeoutMs: 120000 }
    );
    return submitResult(response, identity, parsed.summary);
  }

  private async getLeaderboard(limitArg: unknown, toolArg: unknown): Promise<ToolResult> {
    const tool = argString(toolArg)?.toLowerCase();
    if (tool !== undefined && !/^[a-z0-9][a-z0-9._-]{0,39}$/.test(tool)) {
      return reply({ success: false, error: `"${tool.slice(0, 40)}" is not a tool slug. get_stats lists them (tools[].tool).` }, true);
    }
    const query = new URLSearchParams({ limit: String(clampLimit(limitArg)), ...(tool ? { tool } : {}) });
    return leaderboardResult(await getJson(`/api/leaderboard?${query}`, API), tool);
  }

  private async getProfile(username: string | undefined): Promise<ToolResult> {
    if (!username || !isGithubHandle(username)) {
      return reply({ success: false, error: 'Pass username: a GitHub username (1-39 letters, digits and single hyphens).' }, true);
    }
    return profileResult(await getJson(`/api/profile/${encodeURIComponent(username)}`, API), username);
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    // stdout carries the protocol, so anything meant for a person goes to stderr.
    console.error(`viberank MCP server ${VERSION} running on stdio`);
  }
}

const server = new ViberankMCPServer();
server.start().catch((error) => {
  console.error('viberank MCP server failed to start:', error);
  process.exit(1);
});
