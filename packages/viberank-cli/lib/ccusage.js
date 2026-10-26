import fs from 'fs';
import os from 'os';
import path from 'path';
import { runNpx } from './npx.js';

/**
 * Producing the usage report: running ccusage, and making sense of what it
 * hands back.
 *
 * Kept apart from cli.js so the decisions in it (when to retry, what counts
 * as a usable report, what to say when there is no usage) can be tested
 * without running ccusage.
 */

/**
 * The ccusage the CLI runs, pinned to the major it was tested against.
 *
 * `@latest` meant a new major could change the report's shape under every
 * user on the same morning, and ccusage has done that before: v20 moved days
 * from `date` to `period`. A major pin still picks up fixes; a breaking
 * change arrives only when this line changes.
 */
export const CCUSAGE = 'ccusage@20';

/** Long enough for a very large history on a slow disk, short enough that a
 * hung run still ends on its own rather than holding a scheduled job open. */
export const CCUSAGE_TIMEOUT_MS = 180_000;

/**
 * `--by-agent` adds a per-agent split to each day, which lets the server apply
 * a Claude-transcript cleanup to Claude's tokens alone instead of taking the
 * same day's Codex usage down with it (#125). Early 20.x releases predate it
 * and a cached copy of one can still be what npx resolves.
 */
export const BY_AGENT = '--by-agent';

export function ccusageArgs(extra = []) {
  return ['-y', CCUSAGE, 'daily', '--json', ...extra];
}

/**
 * Whether ccusage failed because it does not know `flag`.
 *
 * That is the only failure a run without the flag can fix. Anything else (no
 * network for npx, a crash, a timeout) fails the same way twice, and retrying
 * used to cost another 15-25 s and then throw away the first error.
 */
export function rejectedFlag(error, flag) {
  const text = `${error?.stderr ?? ''}\n${error?.message ?? ''}`;
  return /unknown (?:option|flag|argument)/i.test(text) && text.includes(flag.replace(/^-+/, ''));
}

function timeoutMessage(ms) {
  return `ccusage did not finish within ${Math.round(ms / 1000)} s. It reads every transcript on this ` +
    `machine, so a very large history or a slow disk can do this. Try again, or run ` +
    `\`npx ${CCUSAGE} daily --json\` yourself to see where it stops.`;
}

/**
 * Run ccusage and return its JSON report as text.
 *
 * @param {{ run?: (args: string[]) => Promise<{ stdout: string }>, timeoutMs?: number }} [deps]
 *   `run` is injectable so the retry decision can be tested without npx.
 */
export async function generateReport({ timeoutMs = CCUSAGE_TIMEOUT_MS, run } = {}) {
  const exec = run ?? ((args) => runNpx(args, { timeoutMs }));
  try {
    return (await exec(ccusageArgs([BY_AGENT]))).stdout;
  } catch (first) {
    if (first?.timedOut) throw new Error(timeoutMessage(timeoutMs));
    if (!rejectedFlag(first, BY_AGENT)) throw first;
    try {
      // A submission without the split is still a perfectly good submission.
      return (await exec(ccusageArgs())).stdout;
    } catch (second) {
      if (second?.timedOut) throw new Error(timeoutMessage(timeoutMs));
      // Both errors: the first says why the flag was dropped, the second why
      // the report still could not be made.
      first.message = `${first.message}\nWithout ${BY_AGENT} it failed too: ${second.message}`;
      throw first;
    }
  }
}

function excerpt(text, max = 200) {
  const flat = String(text ?? '').trim().replace(/\s+/g, ' ');
  return flat.length > max ? `${flat.slice(0, max)}…` : flat || '(nothing)';
}

/**
 * Parse ccusage's output and check it has the shape the rest of the CLI reads.
 *
 * A report without `totals` used to surface as "Cannot read properties of
 * undefined (reading 'totalCost')", which tells nobody anything.
 */
export function parseReport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`ccusage did not print a JSON report. It printed: ${excerpt(text)}`);
  }

  const problems = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    problems.push('it is not an object');
  } else {
    if (!data.totals || typeof data.totals !== 'object') problems.push('no `totals`');
    else if (typeof data.totals.totalCost !== 'number' || typeof data.totals.totalTokens !== 'number') {
      problems.push('`totals` has no totalCost or totalTokens');
    }
    if (!Array.isArray(data.daily)) problems.push('no `daily` list');
  }
  if (problems.length) {
    throw new Error(
      `ccusage's report is not in the shape viberank reads (${problems.join(', ')}). ` +
      `This CLI is tested with ${CCUSAGE}; try \`npx viberank-cli@latest\`, and if it persists ` +
      'report it at https://github.com/sculptdotfun/viberank/issues'
    );
  }
  return data;
}

/** WSL reports itself as plain Linux; its kernel string says otherwise. */
export function isWsl({ env = process.env, platform = process.platform, readFile = fs.readFileSync } = {}) {
  if (platform !== 'linux') return false;
  if (env.WSL_DISTRO_NAME || env.WSL_INTEROP) return true;
  try {
    return /microsoft/i.test(readFile('/proc/version', 'utf8'));
  } catch {
    return false;
  }
}

/**
 * What to say when ccusage ran fine but found no usage at all.
 *
 * Submitting that would be pointless, and calling it a success hid the real
 * problem: the history lives somewhere ccusage was not looking.
 *
 * @returns {string[]} plain lines; the caller styles them
 */
export function noUsageHelp({ env = process.env, home = os.homedir(), wsl = isWsl() } = {}) {
  const tilde = (dir) => (dir.startsWith(home) ? `~${dir.slice(home.length)}` : dir);
  const claude = env.CLAUDE_CONFIG_DIR
    ? `CLAUDE_CONFIG_DIR (${env.CLAUDE_CONFIG_DIR})`
    : `${tilde(path.join(home, '.claude', 'projects'))} and ${tilde(path.join(home, '.config', 'claude', 'projects'))}`;
  const codex = env.CODEX_HOME ? `CODEX_HOME (${env.CODEX_HOME})` : tilde(path.join(home, '.codex'));

  return [
    'ccusage found no usage on this machine, so there is nothing to submit.',
    '',
    'Where it looks:',
    `  Claude Code   ${claude}`,
    `  Codex         ${codex}`,
    `  Others        each tool's own default folder (\`npx ${CCUSAGE} --help\` lists them)`,
    '',
    'Likely causes:',
    '  - You use your AI coding tools on a different machine. Run this there.',
    wsl
      ? '  - This is WSL, which has its own home folder. If you use Claude Code from Windows, run this in a Windows terminal instead.'
      : '  - WSL and Windows keep separate home folders. Run this on the side where you use Claude Code.',
    '  - Your tool keeps its history in a custom folder. Point CLAUDE_CONFIG_DIR (or CODEX_HOME) at it in this shell.',
  ];
}
