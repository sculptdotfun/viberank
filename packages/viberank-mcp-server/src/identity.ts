import { execFile } from 'child_process';
import { promisify } from 'util';
import { TOKENS_PAGE, type TokenState } from './config.js';

/**
 * Who a submission is filed under, decided before anything is uploaded.
 *
 * The rules are the CLI's (packages/viberank-cli/lib/identity.js), with one
 * difference: the CLI can show a prompt, and a tool call cannot. So where the
 * CLI pre-fills a guess and waits for Enter, this returns the guess to the
 * agent and refuses to submit until the agent calls again with the handle the
 * user confirmed.
 */

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const execFileAsync = promisify(execFile);

/** 1-39 alphanumerics with single interior hyphens, which is GitHub's rule. */
export function isGithubHandle(value: string): boolean {
  return /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(value);
}

async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export type OwnerKind = 'user' | 'organization' | 'unknown';

/**
 * Whether a GitHub account is a person, the only kind that can sign in and
 * own a profile. Running inside an organization's repository used to offer
 * the organization's name, and one confirmation created a profile nobody can
 * sign in as (#181). 'unknown' covers rate limits, offline and timeouts, and
 * callers must never treat it as 'user'.
 */
export async function remoteOwnerKind(
  owner: string,
  { fetch: fetchImpl, timeoutMs = 2000 }: { fetch: FetchLike; timeoutMs?: number }
): Promise<OwnerKind> {
  try {
    const res = await fetchWithTimeout(
      fetchImpl,
      `https://api.github.com/users/${encodeURIComponent(owner)}`,
      { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'viberank-mcp' } },
      timeoutMs
    );
    if (!res.ok) return 'unknown';
    const body = (await res.json()) as { type?: unknown };
    if (body?.type === 'Organization') return 'organization';
    if (body?.type === 'User') return 'user';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export type WhoamiResult = {
  status: 'ok' | 'rejected' | 'unsupported' | 'unreachable';
  username: string | null;
};

/**
 * The account a token files submissions under, per the server. The server
 * ignores X-GitHub-User whenever a token is present, so this, and not any
 * name the agent passed, is the account to report back.
 */
export async function whoami(
  site: string,
  token: string,
  { fetch: fetchImpl, timeoutMs = 5000 }: { fetch: FetchLike; timeoutMs?: number }
): Promise<WhoamiResult> {
  try {
    const res = await fetchWithTimeout(
      fetchImpl,
      `${site}/api/token/whoami`,
      { headers: { Authorization: `Bearer ${token}` } },
      timeoutMs
    );
    if (res.status === 401) return { status: 'rejected', username: null };
    if (res.status === 404) return { status: 'unsupported', username: null };
    if (!res.ok) return { status: 'unreachable', username: null };
    const body = (await res.json()) as { username?: unknown };
    return typeof body?.username === 'string' && body.username
      ? { status: 'ok', username: body.username }
      : { status: 'unreachable', username: null };
  } catch {
    return { status: 'unreachable', username: null };
  }
}

/** The owner in this directory's GitHub remote URL, or null. Run without a
 * shell, and bounded, because a hung git must not hold up the tool call. */
export async function gitRemoteOwner(cwd: string = process.cwd()): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['config', '--get', 'remote.origin.url'], {
      cwd,
      timeout: 3000,
      windowsHide: true,
    });
    const owner = stdout.trim().match(/github\.com[:/]([^/]+)\//)?.[1];
    return owner && isGithubHandle(owner) ? owner : null;
  } catch {
    return null;
  }
}

export type Identity =
  | { kind: 'token'; token: string; source: 'env' | 'config'; username: string | null }
  | { kind: 'claim'; username: string }
  | {
      kind: 'stop';
      reason:
        | 'invalid_username'
        | 'token_malformed'
        | 'token_rejected'
        | 'token_mismatch'
        | 'organization'
        | 'needs_username';
      error: string;
      candidate?: string;
      next?: string;
    };

export interface IdentityDeps {
  site: string;
  fetch: FetchLike;
  savedTokenOwner: (token: string) => string | null;
  rememberedUsername: () => string | null;
  remoteOwner: () => Promise<string | null>;
}

const TOKEN_ADVICE =
  `Or set VIBERANK_TOKEN to a token from ${TOKENS_PAGE}: submissions are then verified and ` +
  'filed under the token\'s account with no username needed.';

/**
 * Decide the account for one submission, or say why not to submit.
 *
 * With a token the server decides, so the only job is to learn its answer
 * (whoami) and refuse if the agent asked for a different account. Without a
 * token the username is an unverified claim that creates a public profile, so
 * it has to come from the user, never from a guess made here.
 */
export async function resolveSubmitIdentity(
  requested: string | undefined,
  tokenState: TokenState,
  deps: IdentityDeps
): Promise<Identity> {
  if (requested !== undefined && !isGithubHandle(requested)) {
    return {
      kind: 'stop',
      reason: 'invalid_username',
      error:
        `"${requested.slice(0, 60)}" is not a valid GitHub username (1-39 letters, digits and ` +
        'single hyphens). Ask the user for their GitHub handle, not their display name.',
    };
  }

  if (tokenState.status === 'malformed') {
    return {
      kind: 'stop',
      reason: 'token_malformed',
      error:
        'VIBERANK_TOKEN is set but is not a viberank token (vbr_ followed by 43 characters). ' +
        `Mint one at ${TOKENS_PAGE} and put it in the MCP server's env, or remove the variable.`,
    };
  }

  if (tokenState.status === 'ok') {
    return resolveTokenIdentity(requested, tokenState, deps);
  }

  if (requested !== undefined) {
    // The agent may have passed the remote's owner without asking. An
    // organization can never sign in, so its profile would be orphaned.
    if ((await remoteOwnerKind(requested, { fetch: deps.fetch })) === 'organization') {
      return {
        kind: 'stop',
        reason: 'organization',
        error:
          `@${requested} is a GitHub organization, and only a personal account can own a ` +
          'viberank profile. Ask the user for their own GitHub username.',
      };
    }
    return { kind: 'claim', username: requested };
  }

  return askForUsername(deps);
}

async function resolveTokenIdentity(
  requested: string | undefined,
  tokenState: { token: string; source: 'env' | 'config' },
  deps: IdentityDeps
): Promise<Identity> {
  const where = tokenState.source === 'env' ? 'VIBERANK_TOKEN' : 'The token saved by viberank-cli';
  const who = await whoami(deps.site, tokenState.token, { fetch: deps.fetch });
  if (who.status === 'rejected') {
    return {
      kind: 'stop',
      reason: 'token_rejected',
      error:
        `${where} was rejected by viberank, so it has been revoked or mistyped. Mint a new ` +
        `token at ${TOKENS_PAGE} and update the MCP server's env (or run \`npx viberank-cli login\`).`,
    };
  }

  // Offline or an older server: fall back to the owner the CLI saved for this
  // exact token. If there is none, the server still files the upload under the
  // token's owner, and its reply names that account.
  const owner = who.status === 'ok' ? who.username : deps.savedTokenOwner(tokenState.token);
  if (requested !== undefined && owner && requested.toLowerCase() !== owner.toLowerCase()) {
    return {
      kind: 'stop',
      reason: 'token_mismatch',
      error:
        `${where} belongs to @${owner}, so viberank would file this under @${owner}, not ` +
        `@${requested}. Call again without github_username to submit as @${owner}. To submit ` +
        `as @${requested}, use a token minted by that account.`,
    };
  }
  return { kind: 'token', token: tokenState.token, source: tokenState.source, username: owner };
}

/** No token and no handle: find a candidate for the agent to confirm. */
async function askForUsername(deps: IdentityDeps): Promise<Identity> {
  const confirm = (candidate: string, why: string): Identity => ({
    kind: 'stop',
    reason: 'needs_username',
    candidate,
    error: `Not submitted: a GitHub username is required. ${why}`,
    next:
      `Ask the user whether @${candidate} is their GitHub account. If it is, call ` +
      `submit_to_viberank again with github_username "${candidate}"; if not, ask for theirs. ` +
      'Do not submit under a guess: the name becomes a public profile. ' + TOKEN_ADVICE,
  });

  // A handle this machine already submitted under is the one answer known to
  // be right, so it beats the repository (#151).
  const remembered = deps.rememberedUsername();
  if (remembered && isGithubHandle(remembered)) {
    return confirm(remembered, `This machine submitted as @${remembered} before (saved by viberank-cli).`);
  }

  const owner = await deps.remoteOwner();
  const kind = owner ? await remoteOwnerKind(owner, { fetch: deps.fetch }) : 'unknown';
  if (owner && kind === 'user') {
    return confirm(owner, `This repository's GitHub remote is owned by the user @${owner}.`);
  }

  const why =
    owner && kind === 'organization'
      ? `This repository belongs to the GitHub organization @${owner}, which cannot own a profile.`
      : owner
        ? `This repository's remote is owned by @${owner}, but GitHub could not confirm that is a personal account.`
        : 'It could not be detected.';
  return {
    kind: 'stop',
    reason: 'needs_username',
    error: `Not submitted: a GitHub username is required. ${why}`,
    next:
      'Ask the user for their GitHub username, then call submit_to_viberank again with ' +
      'github_username. ' + TOKEN_ADVICE,
  };
}
