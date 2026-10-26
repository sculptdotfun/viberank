import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * How to invoke npx without a shell and without PATH.
 *
 * Two constraints pull in the same direction. A scheduled job (launchd,
 * systemd, schtasks) starts with a minimal PATH that has no node on it, so
 * bare `npx` is not resolvable. And on Windows the only thing on disk named
 * npx is `npx.cmd` — a batch shim, which Node has refused to spawn without
 * `shell: true` since the CVE-2024-27980 fix (18.20.2 / 20.12.2 / 21.7.3).
 * Passing it to execFileSync throws `spawnSync ... npx.cmd EINVAL` (#137).
 *
 * npm ships npx as a plain .js file next to node, so run *that* through the
 * node binary already executing this process: absolute, shell-free, and the
 * same on every platform.
 *
 * @param {{execPath?: string, platform?: string, exists?: (p: string) => boolean,
 *   realpath?: (p: string) => string | null}} env
 * @returns {{argv: string[], shell: boolean}} argv[0] is the command, the
 *   rest are arguments to prepend to the npx arguments. `shell` is true only
 *   on the Windows shim fallback, where the caller must quote.
 */
export function resolveNpxArgv(env = {}) {
  const execPath = env.execPath ?? process.execPath;
  const platform = env.platform ?? process.platform;
  const exists = env.exists ?? fs.existsSync;
  const realpath = env.realpath ?? ((target) => {
    try { return fs.realpathSync(target); } catch { return null; }
  });
  // Pinned to the target platform's separator rules rather than the host's,
  // so the Windows branch is exercisable from a test on any machine.
  const p = platform === 'win32' ? path.win32 : path.posix;
  const dir = p.dirname(execPath);

  const shim = p.join(dir, platform === 'win32' ? 'npx.cmd' : 'npx');

  const cli = [
    // Windows: node.exe and node_modules/npm share the install directory.
    p.join(dir, 'node_modules', 'npm', 'bin', 'npx-cli.js'),
    // POSIX: bin/node with lib/node_modules alongside it.
    p.join(dir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
    // Homebrew and friends relocate npm out of the node keg and leave the
    // shim as a symlink to it. Executing that symlink works interactively but
    // relies on its `/usr/bin/env node` shebang, which is exactly what a
    // scheduled job with a minimal PATH cannot satisfy — so follow it.
    realpath(shim),
  ].find((candidate) => candidate?.endsWith('.js') && exists(candidate));
  if (cli) return { argv: [execPath, cli], shell: false };

  // No npm layout to be found — an unbundled node, or a distro that moved it.
  // Fall back to the shim, which at least works when PATH is populated.
  const runner = exists(shim) ? shim : 'npx';
  return { argv: [runner], shell: platform === 'win32' };
}

/** cmd.exe swallows bare spaces; the node install path has one in it. */
const quote = (arg) => (/[\s"^&|<>]/.test(arg) ? `"${arg.replace(/"/g, '""')}"` : arg);

/**
 * `env` with the running node's directory first on PATH.
 *
 * npx starts ccusage, and a scheduler starts viberank itself, through bins
 * whose `#!/usr/bin/env node` line needs a node on PATH. A scheduled job may
 * have none, which is how every launchd run ended in exit 127. Windows spells
 * the variable `Path`, so the lookup ignores case: adding a second `PATH`
 * beside it would leave the platform to pick one.
 *
 * @param {Record<string, string | undefined>} env
 * @param {string} execPath
 * @param {string} [platform]
 */
export function withNodeOnPath(env, execPath, platform = process.platform) {
  const p = platform === 'win32' ? path.win32 : path.posix;
  const separator = platform === 'win32' ? ';' : ':';
  const key = Object.keys(env).find((name) => name.toUpperCase() === 'PATH') ?? 'PATH';
  const dir = p.dirname(execPath);
  const rest = (env[key] ?? '').split(separator).filter((entry) => entry && entry !== dir);
  return { ...env, [key]: [dir, ...rest].join(separator) };
}

/** The last few lines of a child's stderr: the error, not the whole log. */
function tail(text, lines = 6) {
  return text.trim().split(/\r?\n/).slice(-lines).join('\n');
}

/**
 * Run `npx <args>` without blocking the event loop, resolving with
 * `{ stdout, stderr }`.
 *
 * Asynchronous so a spinner can keep turning: ccusage reads every transcript
 * on the machine and takes 15-25 s, and the synchronous call this replaced
 * froze the terminal for all of it. Rejects with an Error carrying `stderr`,
 * `exitCode` and `timedOut`, so a caller can tell a refused flag from a hang.
 *
 * @param {string[]} args
 * @param {{ timeoutMs?: number, maxBuffer?: number }} [options]
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
export function runNpx(args, { timeoutMs = 0, maxBuffer = 256 * 1024 * 1024 } = {}) {
  const { argv, shell } = resolveNpxArgv();
  const [command, ...prefix] = argv;
  const full = [...prefix, ...args];
  const options = { windowsHide: true, env: withNodeOnPath(process.env, process.execPath) };
  const child = shell
    ? spawn(quote(command), full.map(quote), { ...options, shell: true })
    : spawn(command, full, options);

  return new Promise((resolve, reject) => {
    const stdout = [];
    const stderr = [];
    let size = 0;
    let stopped = null;
    const stop = (reason) => {
      stopped = reason;
      child.kill();
    };
    const timer = timeoutMs ? setTimeout(() => stop('timeout'), timeoutMs) : null;

    child.stdout.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBuffer) stop('overflow');
      else stdout.push(chunk);
    });
    // stderr is only ever shown as a tail, so there is no point keeping it all.
    child.stderr.on('data', (chunk) => {
      stderr.push(chunk);
      if (stderr.length > 64) stderr.shift();
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      const out = Buffer.concat(stdout).toString('utf8');
      const err = Buffer.concat(stderr).toString('utf8');
      if (exitCode === 0 && !stopped) return resolve({ stdout: out, stderr: err });

      const message = stopped === 'timeout' ? `timed out after ${Math.round(timeoutMs / 1000)} s`
        : stopped === 'overflow' ? `printed more than ${Math.round(maxBuffer / 1024 / 1024)} MB`
        : tail(err) || `exited with code ${exitCode}`;
      const error = new Error(message);
      Object.assign(error, { stderr: err, exitCode, timedOut: stopped === 'timeout' });
      reject(error);
    });
  });
}
