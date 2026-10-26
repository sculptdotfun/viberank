import { TOKENS_PAGE } from './config.js';
import { CCUSAGE, type UsageSummary } from './ccusage.js';
import { SITE, type ApiResult } from './api.js';
import type { Identity } from './identity.js';

/**
 * What each tool says back to the agent.
 *
 * Kept apart from the server wiring so the wording can be tested against
 * fixed server responses without running ccusage or touching the network.
 * Every result is one JSON text block, and `isError` marks results the agent
 * should treat as a failure to fix or retry rather than as an answer.
 */

export type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };
export type Uploadable = Extract<Identity, { kind: 'token' | 'claim' }>;
type Failure = Exclude<ApiResult, { kind: 'ok' }>;

const ISSUES = 'https://github.com/sculptdotfun/viberank/issues';

export function reply(payload: Record<string, unknown>, isError = false): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], ...(isError ? { isError: true } : {}) };
}

export function ccusageFailed(error: unknown): ToolResult {
  const detail = String((error as Error)?.message ?? error).trim().slice(0, 600);
  return reply(
    {
      success: false,
      error: `Could not run ${CCUSAGE}: ${detail}`,
      next: 'Check that Node.js and npm work here (`npx --version`) and that the machine is online, then try again.',
    },
    true
  );
}

export function noUsage(): Record<string, unknown> {
  return {
    success: false,
    error: `No usage found: ${CCUSAGE} found no logs from Claude Code, Codex, Gemini CLI or any other tool it reads on this machine.`,
    next: 'Use one of those tools first. If the user expected data here, their logs may be on another machine.',
  };
}

export function badReport(detail: string): Record<string, unknown> {
  return {
    success: false,
    error: `ccusage's output was not a usage report, so nothing was read. ${detail}`,
    next: `Retry with force_refresh. If it keeps happening, report it at ${ISSUES}.`,
  };
}

export function usageResult(summary: UsageSummary, cached: boolean): ToolResult {
  return reply({
    success: true,
    cached,
    summary,
    note: 'Costs are what this usage would cost at API list prices, computed by ccusage from local logs, not amounts billed.',
  });
}

/** A read tool's failure, worded by what actually went wrong. */
export function readFailure(response: Failure, what: string, route: string): ToolResult {
  if (response.kind === 'no_route') {
    return reply(
      {
        success: false,
        error: `viberank.app does not serve ${route} yet (HTTP 404), so ${what} cannot be read from here.`,
        next: `This needs a newer viberank.app deployment. Until then, the user can browse ${SITE}.`,
      },
      true
    );
  }
  if (response.kind === 'unreachable') return reply({ success: false, error: response.error, next: 'Try again in a minute.' }, true);
  return reply({ success: false, error: `viberank.app could not return ${what}: ${response.error} (HTTP ${response.status}).` }, true);
}

export function leaderboardResult(response: ApiResult, tool: string | undefined): ToolResult {
  if (response.kind !== 'ok') return readFailure(response, 'the leaderboard', '/api/leaderboard');
  const entries = Array.isArray(response.body.entries) ? response.body.entries : [];
  return reply({
    success: true,
    updatedAt: response.body.updatedAt ?? null,
    tool: tool ?? 'all',
    count: entries.length,
    entries,
    ...(entries.length === 0 && tool ? { note: `Nobody on the board has used "${tool}". get_stats lists the tools people use.` } : {}),
  });
}

/** A missing profile is an answer (found: false), not a failure, and it never
 * comes with a link: a profile URL for a handle with no profile is a dead end. */
export function profileResult(response: ApiResult, username: string): ToolResult {
  if (response.kind === 'rejected' && response.status === 404) {
    return reply({
      success: false,
      found: false,
      username,
      error: `No viberank profile for @${username}. They have not submitted yet, or their GitHub username is spelled differently.`,
    });
  }
  if (response.kind !== 'ok') return readFailure(response, 'profiles', '/api/profile');
  return reply({ success: true, found: true, profile: response.body });
}

export function statsResult(response: ApiResult): ToolResult {
  if (response.kind !== 'ok') return readFailure(response, 'site statistics', '/api/stats');
  return reply({ success: true, stats: response.body });
}

/** Why a submission was not attempted, from the identity check. Asking for a
 * username is a normal step, so only the other reasons are marked as errors. */
export function identityStop(identity: Extract<Identity, { kind: 'stop' }>): ToolResult {
  return reply(
    { success: false, submitted: false, error: identity.error, candidate: identity.candidate, next: identity.next },
    identity.reason !== 'needs_username'
  );
}

/** The account the server filed the upload under, read from the profile URL
 * it returns. That, not the name that was sent, is the one to report. */
export function filedUnder(profileUrl: unknown): string | null {
  if (typeof profileUrl !== 'string') return null;
  const match = profileUrl.match(/\/profile\/([^/?#]+)/);
  try {
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function autosubmitAdvice(identity: Uploadable): string {
  const steps =
    identity.kind === 'token' && identity.source === 'config'
      ? '`npx viberank-cli autosubmit`'
      : `\`npx viberank-cli login\` (pasting a token from ${TOKENS_PAGE}), then \`npx viberank-cli autosubmit\``;
  return (
    'Offer to set up daily autosubmit, so their rank stays current and their history outlives Claude Code ' +
    `deleting transcripts after 30 days. They run ${steps} in their own terminal, since both ask questions. ` +
    'Skip this if `npx viberank-cli status` already shows autosubmit on.'
  );
}

export function submitResult(response: ApiResult, identity: Uploadable, summary: UsageSummary): ToolResult {
  if (response.kind !== 'ok' || response.body.success !== true) return submitFailure(response, identity);

  const body = response.body;
  const account = filedUnder(body.profileUrl) ?? identity.username;
  const standing = (body.standing ?? null) as { badgeMarkdown?: unknown } | null;
  const next = [
    ...(typeof standing?.badgeMarkdown === 'string'
      ? [`Offer to add this badge to the user's README (ask before editing): ${standing.badgeMarkdown}`]
      : []),
    autosubmitAdvice(identity),
  ];

  return reply({
    success: true,
    submittedAs: account,
    verified: identity.kind === 'token',
    message: account ? `Submitted to viberank as @${account}.` : 'Submitted to viberank.',
    profileUrl: body.profileUrl ?? null,
    submissionId: body.submissionId ?? null,
    summary,
    // Passed through exactly as the server sent them: standing has rank,
    // totalDevelopers, topPercent, tier and badgeMarkdown; hint is the
    // server's advice to people without a token; notice is a one-line message
    // the server wants shown after a submission.
    standing,
    hint: body.hint ?? null,
    notice: body.notice ?? null,
    next,
  });
}

function submitFailure(response: ApiResult, identity: Uploadable): ToolResult {
  if (response.kind === 'unreachable') {
    return reply({ success: false, submitted: false, error: response.error, next: 'Nothing was uploaded. Try again in a minute.' }, true);
  }
  if (response.kind === 'no_route') {
    return reply({ success: false, submitted: false, error: 'viberank.app answered the submission with a 404 page.', next: 'Try again later.' }, true);
  }
  const error = response.kind === 'rejected' ? response.error : 'viberank.app did not confirm the submission.';
  return reply(
    {
      success: false,
      submitted: false,
      error: `viberank.app refused the submission: ${error} (HTTP ${response.status}).`,
      next: refusalAdvice(response.status, response.body, identity),
    },
    true
  );
}

/** What to do about a refused submission, by status. The server's error text
 * names the problem; this says what the user can do about it. */
function refusalAdvice(status: number, body: Record<string, unknown>, identity: Uploadable): string {
  if (status === 401) {
    return `The token was rejected. Mint a new one at ${TOKENS_PAGE} and update VIBERANK_TOKEN (or run \`npx viberank-cli login\`).`;
  }
  if (status === 403 && identity.kind === 'claim') {
    return (
      `@${identity.username} is verified, so only signed submissions can update it. If that is the user's ` +
      `account, set VIBERANK_TOKEN to a token from ${TOKENS_PAGE} in this MCP server's env and submit again.`
    );
  }
  if (status === 429) return `Submitted too recently. Wait ${Number(body.retryAfter) || 60} seconds, then try again.`;
  if (status === 413) return `The report is too large for one upload. Report it at ${ISSUES}.`;
  if (status >= 500) return 'A temporary problem on viberank.app. Nothing needs fixing locally; try again in a few minutes.';
  return `The server refused this report. If the error is about the data, report it at ${ISSUES}.`;
}
