import { execFile, type ExecFileOptionsWithStringEncoding } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Running ccusage and checking what it printed.
 *
 * This used to be `execSync('npx ccusage@latest daily --json > <tmpfile>')`:
 * a shell, an unquoted redirect into a temp path (which breaks on a Windows
 * user name with a space in it), and whatever ccusage major happened to be
 * latest. Now it runs npx without a shell, reads stdout directly, and pins the
 * major the server's normalizer was written against.
 */

export const CCUSAGE = 'ccusage@20';

/**
 * How to invoke npx without a shell and without relying on PATH, ported from
 * packages/viberank-cli/lib/npx.js. On Windows the only npx on disk is
 * `npx.cmd`, a batch shim Node refuses to spawn without `shell: true` since the
 * CVE-2024-27980 fix (#137). npm ships npx as a plain .js file next to node, so
 * run that through the node binary already running this server.
 */
export function resolveNpxArgv(
  env: {
    execPath?: string;
    platform?: string;
    exists?: (target: string) => boolean;
    realpath?: (target: string) => string | null;
  } = {}
): { argv: string[]; shell: boolean } {
  const execPath = env.execPath ?? process.execPath;
  const platform = env.platform ?? process.platform;
  const exists = env.exists ?? fs.existsSync;
  const realpath =
    env.realpath ??
    ((target: string) => {
      try {
        return fs.realpathSync(target);
      } catch {
        return null;
      }
    });
  // The target platform's separator rules, not the host's, so the Windows
  // branch behaves the same when exercised from a test on any machine.
  const p = platform === 'win32' ? path.win32 : path.posix;
  const dir = p.dirname(execPath);
  const shim = p.join(dir, platform === 'win32' ? 'npx.cmd' : 'npx');

  const cli = [
    // Windows: node.exe and node_modules/npm share the install directory.
    p.join(dir, 'node_modules', 'npm', 'bin', 'npx-cli.js'),
    // POSIX: bin/node with lib/node_modules alongside it.
    p.join(dir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
    // Homebrew and friends leave the shim as a symlink into a relocated npm,
    // and running the symlink depends on `/usr/bin/env node`, so follow it.
    realpath(shim),
  ].find((candidate): candidate is string => !!candidate?.endsWith('.js') && exists(candidate));
  if (cli) return { argv: [execPath, cli], shell: false };

  // No npm layout found (an unbundled node, or a distro that moved npm). The
  // shim at least works when PATH is populated.
  const runner = exists(shim) ? shim : 'npx';
  return { argv: [runner], shell: platform === 'win32' };
}

/** cmd.exe splits on bare spaces, and the node install path usually has one. */
const quote = (arg: string): string => (/[\s"^&|<>]/.test(arg) ? `"${arg.replace(/"/g, '""')}"` : arg);

export type NpxRunner = (args: string[]) => Promise<string>;

/**
 * Run `npx <args>` and resolve with stdout. Asynchronous on purpose: ccusage
 * takes tens of seconds on a long history, and a synchronous child would stall
 * every other MCP message for that long. The child gets its own pipes, so
 * nothing it prints can reach this server's stdout, which carries the protocol.
 */
export const runNpx: NpxRunner = (args) => {
  const { argv, shell } = resolveNpxArgv();
  const [command, ...prefix] = argv;
  const full = [...prefix, ...args];
  const options: ExecFileOptionsWithStringEncoding = {
    encoding: 'utf8',
    // A by-agent report for a long history runs to tens of megabytes.
    maxBuffer: 256 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
    windowsHide: true,
    ...(shell ? { shell: true } : {}),
  };
  const file = shell ? quote(command) : command;
  const fileArgs = shell ? full.map(quote) : full;
  return new Promise((resolve, reject) => {
    execFile(file, fileArgs, options, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, { stdout: String(stdout ?? ''), stderr: String(stderr ?? '') }));
        return;
      }
      resolve(String(stdout));
    });
  });
};

function outputOf(error: unknown, stream: 'stdout' | 'stderr'): string {
  const text = (error as Record<string, unknown> | null)?.[stream];
  return typeof text === 'string' ? text : '';
}

/**
 * The daily report, with the per-agent split when this ccusage supports it.
 *
 * `--by-agent` lets the server apply a Claude transcript cleanup to Claude's
 * tokens alone instead of taking the same day's Codex usage with it (#125).
 * The retry is narrow on purpose: only "unknown option" means the flag is the
 * problem. Any other failure would fail the same way without it, and retrying
 * would hide the real error behind a second 30-second run.
 */
export async function runCcusageDaily(run: NpxRunner = runNpx): Promise<string> {
  const base = ['-y', CCUSAGE, 'daily', '--json'];
  try {
    return await run([...base, '--by-agent']);
  } catch (error) {
    if (!/unknown option.*--by-agent/i.test(outputOf(error, 'stderr'))) throw error;
    return run(base);
  }
}

interface UsageCounts {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
}

interface DailyRow extends Partial<UsageCounts> {
  date?: string;
  period?: string;
  agent?: string;
  agents?: Array<{ agent?: string; totalCost?: number }>;
  metadata?: { agents?: string[] };
}

export interface UsageReport {
  daily: DailyRow[];
  totals: UsageCounts;
}

export interface UsageSummary {
  totalCost: number;
  totalTokens: number;
  daysTracked: number;
  firstDate: string | null;
  lastDate: string | null;
  tools: Array<{ tool: string; cost: number | null }>;
}

export type ParsedUsage =
  | { status: 'ok'; report: UsageReport; summary: UsageSummary }
  | { status: 'empty' }
  | { status: 'invalid'; error: string };

const COUNT_FIELDS: Array<keyof UsageCounts> = [
  'inputTokens',
  'outputTokens',
  'cacheCreationTokens',
  'cacheReadTokens',
  'totalTokens',
  'totalCost',
];

/**
 * Run ccusage and check its report. Throws only for a genuine failure (npx or
 * ccusage could not run); an empty history is a result, not an error.
 */
export async function loadUsage(run: NpxRunner = runNpx): Promise<ParsedUsage> {
  let stdout: string;
  try {
    stdout = await runCcusageDaily(run);
  } catch (error) {
    // ccusage has a plain "No usage data found." message besides the empty
    // JSON report. Accept it on either stream and with any exit code, since
    // in every case it means nothing has been logged yet.
    const said = `${outputOf(error, 'stdout')}\n${outputOf(error, 'stderr')}`;
    if (/no usage data found/i.test(said)) return { status: 'empty' };
    throw error;
  }
  return parseUsageReport(stdout);
}

/**
 * Check ccusage's output before anything is built on it. The server rejects a
 * report without `daily` and `totals`, and an empty `daily` is not an error at
 * all: it means no supported tool has logged anything on this machine yet.
 */
export function parseUsageReport(stdout: string): ParsedUsage {
  const text = stdout.trim();
  if (/^no usage data found/i.test(text)) return { status: 'empty' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { status: 'invalid', error: `${CCUSAGE} did not print JSON. It began: ${text.slice(0, 120) || '(nothing)'}` };
  }

  const report = parsed as Partial<UsageReport> | null;
  if (!report || !Array.isArray(report.daily)) {
    return { status: 'invalid', error: `${CCUSAGE} printed JSON without a "daily" array.` };
  }
  if (report.daily.length === 0) return { status: 'empty' };

  const totals = report.totals as Partial<UsageCounts> | undefined;
  const missing = COUNT_FIELDS.filter((field) => typeof totals?.[field] !== 'number');
  if (missing.length > 0) {
    return { status: 'invalid', error: `${CCUSAGE} printed totals without ${missing.join(', ')}.` };
  }

  const valid = report as UsageReport;
  return { status: 'ok', report: valid, summary: summarize(valid) };
}

/** What an agent needs to talk about the report, without the report itself:
 * a long by-agent history is megabytes and would swamp the conversation. */
function summarize(report: UsageReport): UsageSummary {
  const dates = new Set<string>();
  const toolCost = new Map<string, number | null>();
  for (const row of report.daily) {
    const date = row.date ?? row.period;
    if (date) dates.add(date);
    // Per-agent costs only exist with --by-agent; without it, the tools are
    // still named in metadata, just without a cost each.
    for (const slice of row.agents ?? []) {
      if (!slice.agent) continue;
      toolCost.set(slice.agent, (toolCost.get(slice.agent) ?? 0) + (Number(slice.totalCost) || 0));
    }
    const named = [...(row.metadata?.agents ?? []), ...(row.agent && row.agent !== 'all' ? [row.agent] : [])];
    for (const tool of named) if (!toolCost.has(tool)) toolCost.set(tool, null);
  }
  const sorted = [...dates].sort();
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    totalCost: round(report.totals.totalCost),
    totalTokens: report.totals.totalTokens,
    daysTracked: dates.size,
    firstDate: sorted[0] ?? null,
    lastDate: sorted[sorted.length - 1] ?? null,
    tools: [...toolCost.entries()]
      .map(([tool, cost]) => ({ tool, cost: cost === null ? null : round(cost) }))
      .sort((a, b) => (b.cost ?? -1) - (a.cost ?? -1)),
  };
}
