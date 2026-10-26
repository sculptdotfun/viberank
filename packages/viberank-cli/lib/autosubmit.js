import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG_DIR, getMachineId, writeConfig } from './config.js';
import { isWsl } from './ccusage.js';
import { resolveNpxArgv } from './npx.js';
import { readLog } from './runlog.js';

/**
 * Daily background submission via the platform's own scheduler.
 *
 * No daemon of our own: launchd, systemd and Task Scheduler already survive
 * reboots, handle missed runs and write logs, and a long-lived node process
 * sitting in a user's tray to fire once a day would be a worse version of
 * software they already have.
 *
 * Daily rather than every few minutes. The server merges a submission by
 * folding every incoming day into stored per-machine slices, so a submission
 * costs roughly the same whether it is one day old or thirty — and a
 * leaderboard that updates once a day reads no differently to one that updates
 * every five minutes.
 *
 * The text each scheduler is given is built by pure functions (plist,
 * systemdUnits, windowsScript) so it can be checked as strings: nothing in the
 * tests ever loads a job.
 */

const LABEL = 'app.viberank.autosubmit';
const LOG_FILE = path.join(CONFIG_DIR, 'autosubmit.log');
const TASK = 'viberank-autosubmit';
const LOGON_TASK = 'viberank-autosubmit-logon';

export function platform() {
  if (process.platform === 'darwin') return 'launchd';
  if (process.platform === 'linux') return 'systemd';
  if (process.platform === 'win32') return 'schtasks';
  return null;
}

const plistPath = () =>
  path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const systemdDir = () => path.join(os.homedir(), '.config', 'systemd', 'user');
const windowsScriptPath = () => path.join(CONFIG_DIR, 'autosubmit.cmd');

/** Where a scheduled job finds node when the directory of the node it was
 * given is not enough: the usual install locations, in the usual order. */
export const FALLBACK_PATH = ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin'];

/** A Homebrew keg: `<prefix>/Cellar/<formula>/<version>/…`. Upgrading the
 * formula deletes the version directory, and with it any job pointing there. */
const KEG = /^(.*)[\\/]Cellar[\\/]([^\\/]+)[\\/][^\\/]+[\\/]bin[\\/]node$/;

function isExecutableFile(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function realpathOrNull(file) {
  try {
    return fs.realpathSync(file);
  } catch {
    return null;
  }
}

/**
 * A path to the running node that survives upgrades.
 *
 * `process.execPath` is the resolved binary, which under Homebrew is the
 * versioned keg (`/opt/homebrew/Cellar/node/24.7.0/bin/node`). `brew upgrade`
 * deletes that directory, so a job pointing there dies with the next upgrade.
 * The fix is to find a stable name for the same binary:
 *
 *   1. a `node` on PATH, outside any keg, that is this very binary (so a
 *      version-manager shim that would pick some other node is never chosen);
 *   2. Homebrew's own stable link for the formula, `<prefix>/opt/<formula>`;
 *   3. otherwise the running node, as before.
 *
 * Every input is injectable so each case can be tested on any machine.
 */
export function stableNodePath({
  execPath = process.execPath,
  pathEnv = process.env.PATH ?? process.env.Path ?? '',
  platform: target = process.platform,
  isFile = isExecutableFile,
  realpath = realpathOrNull,
} = {}) {
  const p = target === 'win32' ? path.win32 : path.posix;
  const separator = target === 'win32' ? ';' : ':';
  const name = target === 'win32' ? 'node.exe' : 'node';
  const self = realpath(execPath) ?? execPath;
  const sameBinary = (candidate) => isFile(candidate) && (realpath(candidate) ?? candidate) === self;

  for (const dir of pathEnv.split(separator)) {
    // npm puts node_modules/.bin directories on PATH while it runs a bin, and
    // relative entries mean nothing to a scheduler.
    if (!dir || !p.isAbsolute(dir) || /[\\/]node_modules[\\/]/.test(`${dir}/`)) continue;
    const candidate = p.join(dir, name);
    if (KEG.test(candidate)) continue;
    if (sameBinary(candidate)) return candidate;
  }

  const keg = execPath.match(KEG);
  if (keg) {
    const opt = p.join(keg[1], 'opt', keg[2], 'bin', 'node');
    if (sameBinary(opt)) return opt;
  }
  return execPath;
}

/** PATH for a scheduled job: node's own directory first, then the usual
 * places, without repeats. POSIX only; Windows gets its PATH in the script. */
export function schedulePath(nodePath) {
  return [...new Set([path.posix.dirname(nodePath), ...FALLBACK_PATH])].join(':');
}

/**
 * The minute past the hour this machine submits at, 0-59, fixed per machine.
 *
 * Every job used to fire at :00, so the whole board arrived in the same minute
 * and met the per-user rate limit and the database together. The machine id
 * is a random UUID, so hashing it spreads machines evenly and keeps each one
 * on the same minute every day.
 */
export function scheduleMinute(machineId) {
  return crypto.createHash('sha256').update(String(machineId)).digest().readUInt32BE(0) % 60;
}

/**
 * The argv a scheduler should run. Absolute, because a launchd or systemd job
 * starts with a minimal PATH.
 *
 * The subtlety is *which* absolute path. `npx viberank-cli autosubmit` runs
 * this file out of npm's `_npx` cache, which npm garbage-collects — baking
 * that path into a plist produces a job that works today and silently stops
 * firing weeks later, which is worse than not scheduling at all because
 * nothing announces the failure.
 *
 * So: use the direct path only when this copy lives somewhere durable (a
 * global install, or a project's own node_modules). Otherwise schedule
 * `npx -y viberank-cli@latest`, which re-resolves on every run. That costs a
 * registry round-trip once a day and keeps the job self-updating.
 */
export function invocation({
  node = stableNodePath(),
  cli = fileURLToPath(new URL('../cli.js', import.meta.url)),
  resolveNpx = resolveNpxArgv,
} = {}) {
  const ephemeral = cli.includes(`${path.sep}_npx${path.sep}`);
  if (!ephemeral) return { argv: [node, cli], durable: true, node };

  // Resolve npx next to the stable node, so the job names neither a keg nor
  // PATH. On Windows that means node's own npx-cli.js rather than the
  // `npx.cmd` shim, which Task Scheduler cannot launch as a program (#137).
  // If no npm sits beside it, the running node's own layout still works.
  let npx = resolveNpx({ execPath: node });
  if (npx.argv.length === 1 && node !== process.execPath) npx = resolveNpx();
  return { argv: [...npx.argv, '-y', 'viberank-cli@latest'], durable: false, node };
}

const xml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The launchd agent, as text. */
export function plist({ hour, minute, argv, pathValue, logFile = LOG_FILE }) {
  const args = argv.map((a) => `    <string>${xml(a)}</string>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <!-- launchd starts a job with almost no PATH, and npx starts viberank and
       ccusage through bins that look node up there. Without this every run
       exited 127 before doing anything. -->
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>${xml(pathValue)}</string></dict>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>${hour}</integer><key>Minute</key><integer>${minute}</integer></dict>
  <!-- launchd coalesces a missed StartCalendarInterval on wake from sleep,
       but not across a power-off: a laptop shut down overnight would skip
       the day entirely. RunAtLoad fires at login instead; the CLI's quiet
       path skips within 20h of a success, so this never double-submits. -->
  <key>RunAtLoad</key><true/>
  <!-- The CLI writes its own line per run to this file. Pointing the job's
       output here as well keeps what only launchd can see, such as node
       failing to start at all. -->
  <key>StandardOutPath</key><string>${xml(logFile)}</string>
  <key>StandardErrorPath</key><string>${xml(logFile)}</string>
</dict>
</plist>
`;
}

/**
 * One word of an ExecStart line. systemd splits on whitespace and honors
 * C-style quotes; `%` starts a specifier and `$` a variable even inside
 * quotes, so both are doubled whatever else happens. The old line was a plain
 * join, which broke on the first path with a space in it.
 */
export function systemdQuote(arg) {
  const escaped = String(arg).replace(/%/g, '%%').replace(/\$/g, '$$$$');
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(escaped)) return escaped;
  return `"${escaped.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** An Environment= assignment: quoted, `%` doubled. systemd does not expand
 * `$` here, so unlike ExecStart it is left alone. */
function systemdEnvironment(name, value) {
  const escaped = `${name}=${value}`.replace(/%/g, '%%').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `Environment="${escaped}"`;
}

const hhmm = (hour, minute) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

/** The systemd user service and timer, as text. */
export function systemdUnits({ hour, minute, argv, pathValue }) {
  return {
    service: `[Unit]
Description=Submit AI coding usage to viberank

[Service]
Type=oneshot
# A user service starts with a minimal PATH, and npx starts viberank and
# ccusage through bins that look node up there.
${systemdEnvironment('PATH', pathValue)}
ExecStart=${argv.map(systemdQuote).join(' ')}
`,
    timer: `[Unit]
Description=Daily viberank submission

[Timer]
OnCalendar=*-*-* ${hhmm(hour, minute)}:00
# Run as soon as possible after a missed trigger, so a machine that was off
# at the scheduled time still submits once it comes back.
Persistent=true

[Install]
WantedBy=timers.target
`,
  };
}

/** One word of a batch-file command line. `%` is doubled even inside quotes,
 * because a batch file expands `%name%` wherever it appears. */
export function windowsQuote(arg) {
  const escaped = String(arg).replace(/%/g, '%%');
  return /[\s"^&|<>()!,;=]/.test(escaped) ? `"${escaped}"` : escaped;
}

/**
 * The batch file Task Scheduler runs.
 *
 * A script rather than the command itself: /TR is capped at 261 characters,
 * which two quoted paths and a PATH assignment can pass on their own, and a
 * script is also where PATH can be set. The npx child needs node on PATH as
 * much as on any other platform, and node installed by a version manager is
 * only on the PATH of shells that ran its setup.
 */
export function windowsScript({ argv, nodePath }) {
  const nodeDir = path.win32.dirname(nodePath).replace(/%/g, '%%');
  const [command] = argv;
  // A .cmd started without `call` ends the script before `exit /b` runs.
  const call = /\.(cmd|bat)$/i.test(command) ? 'call ' : '';
  return [
    '@echo off',
    'rem Written by `npx viberank-cli autosubmit`; Task Scheduler runs it daily.',
    `set "PATH=${nodeDir};%PATH%"`,
    `${call}${argv.map(windowsQuote).join(' ')}`,
    'exit /b %ERRORLEVEL%',
    '',
  ].join('\r\n');
}

/**
 * Whether an installed job predates the explicit PATH, and so cannot start.
 * Every job written before 1.13 is one; it cannot repair itself, because it
 * never gets far enough to run any of this code.
 */
export function isOutdatedJob(scheduler, text) {
  if (typeof text !== 'string') return scheduler === 'schtasks';
  if (scheduler === 'launchd') return !text.includes('<key>EnvironmentVariables</key>');
  if (scheduler === 'systemd') return !/^Environment="?PATH=/m.test(text);
  return false;
}

/** `launchctl print` → the job's last exit, or null if it doesn't say. */
export function parseLaunchctlPrint(text) {
  if (/last exit code = \(never exited\)/.test(text)) return { ran: false, exitCode: null };
  const match = String(text).match(/last exit code = (-?\d+)/);
  return match ? { ran: true, exitCode: Number(match[1]) } : null;
}

/** `systemctl show -p ExecMainStatus -p ExecMainExitTimestamp` → the last exit. */
export function parseSystemdShow(text) {
  const fields = {};
  for (const line of String(text).split(/\r?\n/)) {
    const eq = line.indexOf('=');
    if (eq > 0) fields[line.slice(0, eq)] = line.slice(eq + 1).trim();
  }
  if (!('ExecMainStatus' in fields)) return null;
  const at = fields.ExecMainExitTimestamp;
  if (!at || at === 'n/a') return { ran: false, exitCode: null };
  return { ran: true, exitCode: Number(fields.ExecMainStatus), at };
}

/** `schtasks /Query /V /FO LIST` → the last result. English output only; a
 * localized Windows just shows nothing here. */
export function parseSchtasksQuery(text) {
  const match = String(text).match(/Last Result:\s*(-?\d+)/i);
  if (!match) return null;
  const code = Number(match[1]);
  // 267011 (0x41303) is Task Scheduler's "has not yet run".
  return code === 267011 ? { ran: false, exitCode: null } : { ran: true, exitCode: code };
}

/** Run a scheduler command, capturing what it said instead of discarding it:
 * the text is the only useful part of a failure. */
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 30_000, windowsHide: true });
  const stdout = (result.stdout ?? '').trim();
  const stderr = (result.stderr ?? '').trim();
  return {
    ok: !result.error && result.status === 0,
    stdout,
    stderr,
    detail: stderr || stdout || result.error?.message || `exited with code ${result.status}`,
  };
}

const remove = (file) => {
  try { fs.unlinkSync(file); } catch { /* already gone */ }
};

function enableLaunchd({ hour, minute, argv, node }) {
  const file = plistPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Unload first so re-running enable updates an existing schedule rather
  // than failing with "already loaded".
  if (fs.existsSync(file)) run('launchctl', ['unload', file]);
  fs.writeFileSync(file, plist({ hour, minute, argv, pathValue: schedulePath(node) }));
  const loaded = run('launchctl', ['load', file]);
  // `launchctl load` reports some failures ("Load failed: 5: Input/output
  // error") on stderr while still exiting 0.
  if (!loaded.ok || /failed/i.test(loaded.stderr)) {
    remove(file);
    throw new Error(`launchctl load failed: ${loaded.detail}`);
  }
  return file;
}

function enableSystemd({ hour, minute, argv, node }) {
  const dir = systemdDir();
  const files = [path.join(dir, 'viberank.service'), path.join(dir, 'viberank.timer')];
  const units = systemdUnits({ hour, minute, argv, pathValue: schedulePath(node) });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(files[0], units.service);
  fs.writeFileSync(files[1], units.timer);

  for (const step of [['daemon-reload'], ['enable', '--now', 'viberank.timer']]) {
    const result = run('systemctl', ['--user', ...step]);
    if (result.ok) continue;
    // Leave nothing behind. Unit files systemd never loaded still made
    // `status` report autosubmit as on, for a job that would never run.
    files.forEach(remove);
    run('systemctl', ['--user', 'daemon-reload']);
    const hint = isWsl()
      ? 'This looks like WSL without systemd. Turn it on with `[boot] systemd=true` in /etc/wsl.conf, then `wsl --shutdown`; or run `npx viberank-cli submit --quiet` from cron.'
      : 'Without a systemd user session (a container, some SSH setups), run `npx viberank-cli submit --quiet` from cron instead.';
    throw new Error(`systemctl --user ${step.join(' ')} failed: ${result.detail}\n${hint}`);
  }
  return dir;
}

function enableSchtasks({ hour, minute, argv, node }) {
  const script = windowsScriptPath();
  fs.writeFileSync(script, windowsScript({ argv, nodePath: node }));
  const tr = `"${script}"`;
  const daily = run('schtasks', [
    '/Create', '/F', '/TN', TASK, '/TR', tr, '/SC', 'DAILY', '/ST', hhmm(hour, minute),
  ]);
  if (!daily.ok) {
    remove(script);
    throw new Error(`schtasks /Create failed: ${daily.detail}`);
  }
  // A DAILY trigger does not catch up if the machine was off at the scheduled
  // time. A second ONLOGON task covers that; the CLI's 20-hour guard keeps
  // the pair from double-submitting. It can need elevation on some setups,
  // and the daily task still works without it, so its failure is not fatal.
  run('schtasks', ['/Create', '/F', '/TN', LOGON_TASK, '/TR', tr, '/SC', 'ONLOGON']);
  return TASK;
}

/**
 * Install the daily job. Throws with the scheduler's own error text, having
 * removed whatever it wrote, if the scheduler refuses it.
 */
export function enable(hour = 9) {
  const target = platform();
  if (!target) throw new Error(`Unsupported platform: ${process.platform}`);
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });

  const minute = scheduleMinute(getMachineId());
  const job = invocation();
  const spec = { hour, minute, argv: [...job.argv, 'submit', '--quiet'], node: job.node };
  const where = target === 'launchd' ? enableLaunchd(spec)
    : target === 'systemd' ? enableSystemd(spec)
    : enableSchtasks(spec);

  writeConfig({ autosubmit: { hour, minute, enabledAt: new Date().toISOString() } });
  return { scheduler: target, path: where, hour, minute, durable: job.durable };
}

export function disable() {
  const target = platform();
  if (target === 'launchd') {
    const file = plistPath();
    if (fs.existsSync(file)) run('launchctl', ['unload', file]);
    remove(file);
  } else if (target === 'systemd') {
    run('systemctl', ['--user', 'disable', '--now', 'viberank.timer']);
    for (const unit of ['viberank.timer', 'viberank.service']) remove(path.join(systemdDir(), unit));
    run('systemctl', ['--user', 'daemon-reload']);
  } else if (target === 'schtasks') {
    for (const tn of [TASK, LOGON_TASK]) run('schtasks', ['/Delete', '/F', '/TN', tn]);
    remove(windowsScriptPath());
  } else {
    return false;
  }
  writeConfig({ autosubmit: undefined });
  return true;
}

export function isEnabled(target = platform()) {
  if (target === 'launchd') return fs.existsSync(plistPath());
  if (target === 'systemd') return fs.existsSync(path.join(systemdDir(), 'viberank.timer'));
  if (target === 'schtasks') return run('schtasks', ['/Query', '/TN', TASK]).ok;
  return false;
}

function readOrNull(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function installedJobText(target) {
  if (target === 'launchd') return readOrNull(plistPath());
  if (target === 'systemd') return readOrNull(path.join(systemdDir(), 'viberank.service'));
  return readOrNull(windowsScriptPath());
}

/** Best effort: how the scheduler says the last run ended. Null when it
 * won't say (an old launchctl, a localized schtasks, no user bus). */
function lastRun(target) {
  if (target === 'launchd') {
    const result = run('launchctl', ['print', `gui/${process.getuid()}/${LABEL}`]);
    return result.ok ? parseLaunchctlPrint(result.stdout) : null;
  }
  if (target === 'systemd') {
    const result = run('systemctl', ['--user', 'show', 'viberank.service', '-p', 'ExecMainStatus', '-p', 'ExecMainExitTimestamp']);
    return result.ok ? parseSystemdShow(result.stdout) : null;
  }
  if (target === 'schtasks') {
    const result = run('schtasks', ['/Query', '/TN', TASK, '/V', '/FO', 'LIST']);
    return result.ok ? parseSchtasksQuery(result.stdout) : null;
  }
  return null;
}

export function status() {
  const target = platform();
  const log = readLog(LOG_FILE, 5);
  const enabled = isEnabled(target);
  if (!enabled) return { scheduler: target, enabled, log, outdated: false, lastRun: null };
  return {
    scheduler: target,
    enabled,
    log,
    outdated: isOutdatedJob(target, installedJobText(target)),
    lastRun: lastRun(target),
  };
}

export { LOG_FILE };
