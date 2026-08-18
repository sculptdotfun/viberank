import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG_DIR } from './config.js';

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
 */

const LABEL = 'app.viberank.autosubmit';
const LOG_FILE = path.join(CONFIG_DIR, 'autosubmit.log');

export function platform() {
  if (process.platform === 'darwin') return 'launchd';
  if (process.platform === 'linux') return 'systemd';
  if (process.platform === 'win32') return 'schtasks';
  return null;
}

const plistPath = () =>
  path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const systemdDir = () => path.join(os.homedir(), '.config', 'systemd', 'user');

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
function invocation() {
  const cli = fileURLToPath(new URL('../cli.js', import.meta.url));
  const ephemeral = cli.includes(`${path.sep}_npx${path.sep}`);

  if (!ephemeral) return { argv: [process.execPath, cli], durable: true };

  // Resolve npx next to the running node so the scheduler doesn't need PATH.
  const npx = path.join(path.dirname(process.execPath), 'npx');
  const runner = fs.existsSync(npx) ? npx : 'npx';
  return { argv: [runner, '-y', 'viberank-cli@latest'], durable: false };
}

function plist(hour) {
  const { argv } = invocation();
  const args = [...argv, 'submit', '--quiet']
    .map((a) => `    <string>${a}</string>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>${hour}</integer><key>Minute</key><integer>0</integer></dict>
  <!-- launchd coalesces a missed StartCalendarInterval on wake from sleep,
       but not across a power-off: a laptop shut down overnight would skip
       the day entirely. RunAtLoad fires at login instead; the CLI's quiet
       path skips within 20h of a success, so this never double-submits. -->
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${LOG_FILE}</string>
  <key>StandardErrorPath</key><string>${LOG_FILE}</string>
</dict>
</plist>
`;
}

function systemdUnits(hour) {
  const { argv } = invocation();
  const exec = [...argv, 'submit', '--quiet'].join(' ');
  return {
    service: `[Unit]
Description=Submit AI coding usage to viberank

[Service]
Type=oneshot
ExecStart=${exec}
`,
    timer: `[Unit]
Description=Daily viberank submission

[Timer]
OnCalendar=*-*-* ${String(hour).padStart(2, '0')}:00:00
# Run as soon as possible after a missed trigger, so a machine that was off
# at the scheduled time still submits once it comes back.
Persistent=true

[Install]
WantedBy=timers.target
`,
  };
}

export function enable(hour = 9) {
  const target = platform();
  if (!target) throw new Error(`Unsupported platform: ${process.platform}`);
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });

  if (target === 'launchd') {
    const file = plistPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, plist(hour));
    // Unload first so re-running enable updates an existing schedule rather
    // than failing with "already loaded".
    try { execFileSync('launchctl', ['unload', file], { stdio: 'ignore' }); } catch { /* not loaded */ }
    execFileSync('launchctl', ['load', file], { stdio: 'ignore' });
    return { scheduler: 'launchd', path: file, hour, durable: invocation().durable };
  }

  if (target === 'systemd') {
    const dir = systemdDir();
    fs.mkdirSync(dir, { recursive: true });
    const units = systemdUnits(hour);
    fs.writeFileSync(path.join(dir, 'viberank.service'), units.service);
    fs.writeFileSync(path.join(dir, 'viberank.timer'), units.timer);
    execFileSync('systemctl', ['--user', 'daemon-reload'], { stdio: 'ignore' });
    execFileSync('systemctl', ['--user', 'enable', '--now', 'viberank.timer'], { stdio: 'ignore' });
    return { scheduler: 'systemd', path: dir, hour, durable: invocation().durable };
  }

  const { argv } = invocation();
  const tr = [...argv, 'submit', '--quiet'].map((a) => `"${a}"`).join(' ');
  execFileSync('schtasks', [
    '/Create', '/F', '/TN', 'viberank-autosubmit',
    '/TR', tr,
    '/SC', 'DAILY', '/ST', `${String(hour).padStart(2, '0')}:00`,
  ], { stdio: 'ignore' });
  // A DAILY trigger does not catch up if the machine was off at the scheduled
  // time. A second ONLOGON task covers that; the CLI's 20-hour guard keeps
  // the pair from double-submitting.
  try {
    execFileSync('schtasks', [
      '/Create', '/F', '/TN', 'viberank-autosubmit-logon',
      '/TR', tr,
      '/SC', 'ONLOGON',
    ], { stdio: 'ignore' });
  } catch { /* logon trigger can need elevation on some setups; daily still works */ }
  return { scheduler: 'schtasks', path: 'viberank-autosubmit', hour, durable: invocation().durable };
}

export function disable() {
  const target = platform();
  if (target === 'launchd') {
    const file = plistPath();
    try { execFileSync('launchctl', ['unload', file], { stdio: 'ignore' }); } catch { /* not loaded */ }
    try { fs.unlinkSync(file); } catch { /* already gone */ }
    return true;
  }
  if (target === 'systemd') {
    try { execFileSync('systemctl', ['--user', 'disable', '--now', 'viberank.timer'], { stdio: 'ignore' }); } catch { /* not enabled */ }
    for (const unit of ['viberank.timer', 'viberank.service']) {
      try { fs.unlinkSync(path.join(systemdDir(), unit)); } catch { /* already gone */ }
    }
    try { execFileSync('systemctl', ['--user', 'daemon-reload'], { stdio: 'ignore' }); } catch { /* fine */ }
    return true;
  }
  if (target === 'schtasks') {
    for (const tn of ['viberank-autosubmit', 'viberank-autosubmit-logon']) {
      try { execFileSync('schtasks', ['/Delete', '/F', '/TN', tn], { stdio: 'ignore' }); } catch { /* not present */ }
    }
    return true;
  }
  return false;
}

export function status() {
  const target = platform();
  const log = fs.existsSync(LOG_FILE)
    ? fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').slice(-5)
    : [];

  if (target === 'launchd') {
    return { scheduler: 'launchd', enabled: fs.existsSync(plistPath()), log };
  }
  if (target === 'systemd') {
    return { scheduler: 'systemd', enabled: fs.existsSync(path.join(systemdDir(), 'viberank.timer')), log };
  }
  if (target === 'schtasks') {
    let enabled = false;
    try {
      execFileSync('schtasks', ['/Query', '/TN', 'viberank-autosubmit'], { stdio: 'ignore' });
      enabled = true;
    } catch {
      // Not registered.
    }
    return { scheduler: 'schtasks', enabled, log };
  }
  return { scheduler: null, enabled: false, log };
}

export { LOG_FILE };
