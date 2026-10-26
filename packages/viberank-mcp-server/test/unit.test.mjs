// Unit tests for the decisions the MCP server makes before it touches the
// network: which account a submission goes to, how ccusage is run and read,
// and how a viberank.app answer is classified. Runs against the build, with
// fetch and npx faked, so it never reaches viberank.app or GitHub.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readToken } from '../dist/config.js';
import { resolveSubmitIdentity } from '../dist/identity.js';
import { loadUsage, parseUsageReport, resolveNpxArgv, runCcusageDaily } from '../dist/ccusage.js';
import { requestJson } from '../dist/api.js';
import { leaderboardResult, profileResult, submitResult } from '../dist/results.js';

const TOKEN = `vbr_${'a'.repeat(43)}`;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const html = (status) => new Response('<html>not found</html>', { status, headers: { 'content-type': 'text/html' } });

/** Identity deps with a fake fetch that answers by URL. */
function deps({ whoami, githubType, remembered = null, remote = null, saved = null } = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, auth: init.headers?.Authorization });
    if (url.endsWith('/api/token/whoami')) return whoami ? whoami() : json(500, {});
    if (url.startsWith('https://api.github.com/users/')) return githubType ? json(200, { type: githubType }) : json(403, {});
    throw new Error(`unexpected request to ${url}`);
  };
  return {
    calls,
    deps: {
      site: 'https://site.test',
      fetch,
      savedTokenOwner: () => saved,
      rememberedUsername: () => remembered,
      remoteOwner: async () => remote,
    },
  };
}

const tokenState = { status: 'ok', token: TOKEN, source: 'env' };

test('with a token, the account is whoami\'s answer and no username is needed', async () => {
  const { deps: d, calls } = deps({ whoami: () => json(200, { username: 'octocat' }) });
  const identity = await resolveSubmitIdentity(undefined, tokenState, d);
  assert.deepEqual(identity, { kind: 'token', token: TOKEN, source: 'env', username: 'octocat' });
  assert.equal(calls[0].auth, `Bearer ${TOKEN}`);
});

test('with a token, a different requested username is refused instead of silently ignored', async () => {
  const { deps: d } = deps({ whoami: () => json(200, { username: 'octocat' }) });
  const identity = await resolveSubmitIdentity('someone-else', tokenState, d);
  assert.equal(identity.kind, 'stop');
  assert.equal(identity.reason, 'token_mismatch');
  assert.match(identity.error, /belongs to @octocat/);
  assert.equal((await resolveSubmitIdentity('OctoCat', tokenState, d)).kind, 'token', 'case does not matter');
});

test('a revoked token stops before any upload', async () => {
  const { deps: d } = deps({ whoami: () => json(401, { error: 'revoked' }) });
  const identity = await resolveSubmitIdentity(undefined, tokenState, d);
  assert.equal(identity.reason, 'token_rejected');
});

test('when whoami is unreachable, the owner the CLI saved for this token is used', async () => {
  const { deps: d } = deps({ whoami: () => json(503, {}), saved: 'octocat' });
  assert.equal((await resolveSubmitIdentity(undefined, tokenState, d)).username, 'octocat');
});

test('a malformed VIBERANK_TOKEN is reported, not skipped', async () => {
  assert.deepEqual(readToken({ VIBERANK_TOKEN: 'vbr_…' }), { status: 'malformed', source: 'env' });
  assert.deepEqual(readToken({ VIBERANK_TOKEN: ` ${TOKEN} ` }), { status: 'ok', token: TOKEN, source: 'env' });
  const { deps: d } = deps();
  assert.equal((await resolveSubmitIdentity(undefined, { status: 'malformed', source: 'env' }, d)).reason, 'token_malformed');
});

test('without a token or username, a user-owned remote is offered for confirmation and nothing is submitted', async () => {
  const { deps: d } = deps({ remote: 'octocat', githubType: 'User' });
  const identity = await resolveSubmitIdentity(undefined, { status: 'none' }, d);
  assert.equal(identity.kind, 'stop');
  assert.equal(identity.reason, 'needs_username');
  assert.equal(identity.candidate, 'octocat');
  assert.match(identity.next, /github_username "octocat"/);
});

test('an organization-owned remote is never offered as the username (#181)', async () => {
  const { deps: d } = deps({ remote: 'sculptdotfun', githubType: 'Organization' });
  const identity = await resolveSubmitIdentity(undefined, { status: 'none' }, d);
  assert.equal(identity.reason, 'needs_username');
  assert.equal(identity.candidate, undefined);
  assert.match(identity.error, /organization @sculptdotfun/);
});

test('an owner GitHub cannot classify is not offered either', async () => {
  const { deps: d } = deps({ remote: 'octocat' });
  const identity = await resolveSubmitIdentity(undefined, { status: 'none' }, d);
  assert.equal(identity.candidate, undefined);
});

test('the handle this machine submitted under before beats the remote, without asking GitHub', async () => {
  const { deps: d, calls } = deps({ remembered: 'hubot', remote: 'octocat', githubType: 'User' });
  const identity = await resolveSubmitIdentity(undefined, { status: 'none' }, d);
  assert.equal(identity.candidate, 'hubot');
  assert.equal(calls.length, 0);
});

test('a confirmed username is submitted as a claim, unless it is an organization or malformed', async () => {
  const user = deps({ githubType: 'User' }).deps;
  assert.deepEqual(await resolveSubmitIdentity('octocat', { status: 'none' }, user), { kind: 'claim', username: 'octocat' });
  const offline = deps().deps;
  assert.equal((await resolveSubmitIdentity('octocat', { status: 'none' }, offline)).kind, 'claim', 'an unknown kind does not block a confirmed name');
  const org = deps({ githubType: 'Organization' }).deps;
  assert.equal((await resolveSubmitIdentity('sculptdotfun', { status: 'none' }, org)).reason, 'organization');
  assert.equal((await resolveSubmitIdentity('Matt Smith', { status: 'none' }, user)).reason, 'invalid_username');
});

test('ccusage is pinned, asked for --by-agent, and retried without it only on "unknown option"', async () => {
  const seen = [];
  const old = async (args) => {
    seen.push(args);
    if (args.includes('--by-agent')) throw Object.assign(new Error('exit 2'), { stderr: "Unknown option '--by-agent'\n" });
    return '{}';
  };
  assert.equal(await runCcusageDaily(old), '{}');
  assert.deepEqual(seen, [
    ['-y', 'ccusage@20', 'daily', '--json', '--by-agent'],
    ['-y', 'ccusage@20', 'daily', '--json'],
  ]);

  let runs = 0;
  const broken = async () => {
    runs++;
    throw Object.assign(new Error('npm ERR! network'), { stderr: 'npm ERR! network' });
  };
  await assert.rejects(runCcusageDaily(broken), /network/);
  assert.equal(runs, 1, 'any other failure is not retried');
});

test('an empty history is "no usage", not an error, whichever way ccusage says it', async () => {
  assert.deepEqual(parseUsageReport('{"daily":[],"totals":{}}'), { status: 'empty' });
  assert.deepEqual(parseUsageReport('No usage data found.\n'), { status: 'empty' });
  const saysSoAndExits = async () => {
    throw Object.assign(new Error('exit 1'), { stdout: '', stderr: 'No usage data found.' });
  };
  assert.deepEqual(await loadUsage(saysSoAndExits), { status: 'empty' });
});

test('output that is not a usage report is rejected with the reason', () => {
  assert.equal(parseUsageReport('Need to install ccusage@20').status, 'invalid');
  assert.match(parseUsageReport('{"totals":{}}').error, /"daily" array/);
  assert.match(parseUsageReport('{"daily":[{"period":"2026-10-01"}],"totals":{"totalCost":1}}').error, /inputTokens/);
});

test('the summary counts dates once and costs each tool from the by-agent split', () => {
  const counts = { inputTokens: 1, outputTokens: 1, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 2 };
  const report = {
    daily: [
      { period: '2026-10-01', agent: 'all', ...counts, totalCost: 3, agents: [{ agent: 'claude', totalCost: 2 }, { agent: 'codex', totalCost: 1 }] },
      { period: '2026-10-02', agent: 'all', ...counts, totalCost: 2, agents: [{ agent: 'claude', totalCost: 2 }] },
      { date: '2026-10-03', ...counts, totalCost: 1, metadata: { agents: ['gemini'] } },
    ],
    totals: { ...counts, totalTokens: 6, totalCost: 6.004 },
  };
  const parsed = parseUsageReport(JSON.stringify(report));
  assert.equal(parsed.status, 'ok');
  assert.deepEqual(parsed.summary, {
    totalCost: 6,
    totalTokens: 6,
    daysTracked: 3,
    firstDate: '2026-10-01',
    lastDate: '2026-10-03',
    tools: [
      { tool: 'claude', cost: 4 },
      { tool: 'codex', cost: 1 },
      { tool: 'gemini', cost: null },
    ],
  });
});

test('on Windows, npx runs through node and npx-cli.js, never the .cmd shim', () => {
  const execPath = 'C:\\Program Files\\nodejs\\node.exe';
  const cli = 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npx-cli.js';
  const resolved = resolveNpxArgv({ execPath, platform: 'win32', exists: (p) => p === cli, realpath: () => null });
  assert.deepEqual(resolved, { argv: [execPath, cli], shell: false });
});

test('a 404 with JSON is an answer; a 404 page means the route is not deployed', async () => {
  const deps = (res) => ({ fetch: async () => res, userAgent: 'test' });
  assert.deepEqual(await requestJson('https://site.test/api/profile/x', {}, deps(json(404, { error: 'not found' }))), {
    kind: 'rejected',
    status: 404,
    error: 'not found',
    body: { error: 'not found' },
  });
  assert.deepEqual(await requestJson('https://site.test/api/profile/x', {}, deps(html(404))), { kind: 'no_route', status: 404 });
  assert.equal((await requestJson('https://site.test/api/stats', {}, deps(json(200, { totals: {} })))).kind, 'ok');
  assert.equal((await requestJson('https://site.test/api/stats', {}, deps(html(502)))).kind, 'unreachable');
  const offline = { fetch: async () => { throw new TypeError('fetch failed'); }, userAgent: 'test' };
  assert.match((await requestJson('https://site.test/api/stats', {}, offline)).error, /Could not reach site\.test/);
});

// Result wording, against fixed responses shaped like the server's contracts.
const parse = (result) => ({ body: JSON.parse(result.content[0].text), isError: result.isError === true });
const summary = { totalCost: 12, totalTokens: 3400, daysTracked: 2, firstDate: '2026-10-01', lastDate: '2026-10-02', tools: [] };

test('a successful submit passes standing, hint and notice through and names the account the server used', () => {
  const standing = {
    rank: 42,
    totalDevelopers: 1309,
    topPercent: 4,
    tier: 'Blaze',
    badgeMarkdown: '[![viberank](https://www.viberank.app/api/badge/octocat)](https://www.viberank.app/profile/octocat)',
  };
  const response = {
    kind: 'ok',
    status: 200,
    body: {
      success: true,
      submissionId: 'abc',
      message: 'Successfully submitted data for octocat',
      profileUrl: 'https://www.viberank.app/profile/octocat',
      standing,
      notice: 'A sponsor line.',
      hint: 'Run `npx viberank-cli login` then `npx viberank-cli autosubmit`.',
    },
  };
  const { body, isError } = parse(submitResult(response, { kind: 'claim', username: 'OctoCat' }, summary));
  assert.equal(isError, false);
  assert.equal(body.submittedAs, 'octocat', 'from the server, not the name sent');
  assert.equal(body.verified, false);
  assert.deepEqual(body.standing, standing);
  assert.equal(body.hint, response.body.hint);
  assert.equal(body.notice, 'A sponsor line.');
  assert.match(body.next[0], /badge to the user's README/);
  assert.ok(body.next[0].includes(standing.badgeMarkdown));
  assert.match(body.next[1], /npx viberank-cli login.*npx viberank-cli autosubmit/);
});

test("with the CLI's saved token, the autosubmit advice skips the login step", () => {
  const response = { kind: 'ok', status: 200, body: { success: true, profileUrl: 'https://www.viberank.app/profile/octocat', standing: null, hint: null } };
  const { body } = parse(submitResult(response, { kind: 'token', token: 't', source: 'config', username: 'octocat' }, summary));
  assert.equal(body.verified, true);
  assert.equal(body.next.length, 1, 'no badge line without a badge');
  assert.doesNotMatch(body.next[0], /login/);
});

test('a refused unsigned submit to a verified profile points at the token', () => {
  const response = { kind: 'rejected', status: 403, error: '@octocat is verified, so submissions to it need to be signed.', body: {} };
  const { body, isError } = parse(submitResult(response, { kind: 'claim', username: 'octocat' }, summary));
  assert.equal(isError, true);
  assert.equal(body.submitted, false);
  assert.match(body.next, /VIBERANK_TOKEN/);
});

test('the leaderboard and profile contracts come back as data; a missing profile has no link', () => {
  const entry = {
    rank: 1,
    username: 'octocat',
    totalCost: 99,
    totalTokens: 1,
    tools: ['claude'],
    verified: true,
    underReview: false,
    profileUrl: 'https://www.viberank.app/profile/octocat',
  };
  const board = parse(leaderboardResult({ kind: 'ok', status: 200, body: { updatedAt: '2026-10-26T00:00:00Z', entries: [entry] } }, 'claude'));
  assert.deepEqual(board.body, { success: true, updatedAt: '2026-10-26T00:00:00Z', tool: 'claude', count: 1, entries: [entry] });

  const missing = parse(profileResult({ kind: 'rejected', status: 404, error: 'Not found', body: { error: 'Not found' } }, 'nobody'));
  assert.equal(missing.isError, false);
  assert.equal(missing.body.found, false);
  assert.equal(missing.body.success, false);
  assert.doesNotMatch(JSON.stringify(missing.body), /https?:/);

  const undeployed = parse(profileResult({ kind: 'no_route', status: 404 }, 'octocat'));
  assert.equal(undeployed.isError, true);
  assert.match(undeployed.body.error, /does not serve \/api\/profile yet/);
});
