/**
 * The command line: what was asked for, and how a submit should run.
 *
 * The previous parser dropped every argument starting with `--` before
 * looking at the rest, so `--help` was discarded and a bare `npx viberank-cli
 * --help` started a submission. Flags are read here first, and the decisions
 * that depend on them are plain functions the tests can call.
 */

/** Every command, in the order help lists them. */
export const COMMANDS = [
  ['submit', 'Submit your usage now (the default)'],
  ['login', 'Save an API token: paste it, or pass --token'],
  ['logout', 'Forget the saved token, and turn autosubmit off'],
  ['autosubmit', 'Submit once a day in the background'],
  ['autosubmit off', 'Stop submitting automatically'],
  ['status', 'Token, schedule, last submission and recent runs'],
  ['help', 'Show this help'],
];

/** Every option, in the order help lists them. `names` are what parseArgs accepts. */
export const OPTIONS = [
  { names: ['--user'], value: '<handle>', key: 'user', help: 'GitHub handle to submit as, when there is no token' },
  { names: ['-y', '--yes'], key: 'yes', help: 'Submit without asking for confirmation' },
  { names: ['--token'], value: '<token>', key: 'token', help: 'With login: the token to save, without a prompt' },
  { names: ['--quiet'], key: 'quiet', help: 'Scheduled mode: no prompts, one line per run in ~/.viberank/autosubmit.log' },
  { names: ['-h', '--help'], key: 'help', help: 'Show this help' },
  { names: ['-v', '--version'], key: 'version', help: 'Print the version' },
];

/**
 * @param {string[]} argv process.argv.slice(2)
 * @returns {{ command: string | undefined, arg: string | undefined,
 *   flags: { user: string | null, yes: boolean, token: string | null, quiet: boolean, help: boolean, version: boolean },
 *   unknown: string[], missing: string[] }}
 *   `unknown` holds options nobody defined; `missing` holds options that take
 *   a value but were given none.
 */
export function parseArgs(argv) {
  const flags = { user: null, yes: false, token: null, quiet: false, help: false, version: false };
  const positional = [];
  const unknown = [];
  const missing = [];

  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (raw === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (!raw.startsWith('-') || raw === '-') {
      positional.push(raw);
      continue;
    }

    const eq = raw.startsWith('--') ? raw.indexOf('=') : -1;
    const name = eq === -1 ? raw : raw.slice(0, eq);
    const option = OPTIONS.find((o) => o.names.includes(name));
    if (!option) {
      unknown.push(name);
      continue;
    }
    if (!option.value) {
      flags[option.key] = true;
      continue;
    }

    let value = eq === -1 ? argv[i + 1] : raw.slice(eq + 1);
    // `--user --yes` is a forgotten value, not a handle called "--yes".
    if (eq === -1 && (value === undefined || value.startsWith('-'))) value = undefined;
    else if (eq === -1) i++;
    if (!value) {
      missing.push(name);
      continue;
    }
    // People write handles the way GitHub displays them.
    flags[option.key] = option.key === 'user' ? value.replace(/^@/, '') : value;
  }

  const [command, arg] = positional;
  return { command, arg, flags, unknown, missing };
}

/**
 * How a submit should run.
 *
 * Only `--quiet` means scheduled. A missing TTY used to count too, on the
 * theory that nobody was there to answer, but Claude Code's Bash tool, CI and
 * `| tee` all run without one, and each of those runs was told it had "no API
 * token" and to re-enable a schedule it never had. No terminal means "never
 * prompt", not "you are cron".
 *
 *   'scheduled'   --quiet: one log line, no prompts
 *   'interactive' a person at a terminal; prompts as needed
 *   'unattended'  no terminal, but enough to submit without asking: a token,
 *                 or --user <handle> with --yes (an unverified submission,
 *                 the same one the interactive path makes after its prompts)
 *   'blocked'     no terminal and nothing to go on; say what would work
 */
export function submitMode({ quiet, interactive, hasToken, user, yes }) {
  if (quiet) return 'scheduled';
  if (interactive) return 'interactive';
  if (hasToken) return 'unattended';
  if (user && yes) return 'unattended';
  return 'blocked';
}

/** What to print in 'blocked' mode. Plain lines; the caller styles them. */
export function blockedMessage() {
  return [
    'There is no terminal here to ask questions in, so nothing was submitted.',
    'Any one of these works:',
    '  - Run `npx viberank-cli` in your own terminal.',
    '  - Pass `--user <github-handle> --yes` to submit unverified, without questions.',
    '  - Save a token with `npx viberank-cli login --token <token>`, or set VIBERANK_TOKEN.',
    '    Tokens are at https://www.viberank.app/settings/tokens',
  ];
}

/** Help text, plain. Lists every command and every option above. */
export function helpText() {
  const pad = (text, width) => text.padEnd(width);
  const commands = COMMANDS.map(([name, help]) => `  ${pad(name, 18)}${help}`);
  const options = OPTIONS.map((o) => {
    const label = `${o.names.join(', ')}${o.value ? ` ${o.value}` : ''}`;
    return `  ${pad(label, 20)}${o.help}`;
  });
  return [
    'Usage: npx viberank-cli [command] [options]',
    '',
    'Commands',
    ...commands,
    '',
    'Options',
    ...options,
    '',
    'Without a terminal (CI, an agent\'s shell), a submit needs a token',
    '(`login --token`, or VIBERANK_TOKEN), or `--user <handle> --yes`.',
    '',
    'Most people run `login` once, then `autosubmit` once, and never think',
    'about it again: your rank stays current instead of freezing on the day',
    'you first submitted.',
  ].join('\n');
}
