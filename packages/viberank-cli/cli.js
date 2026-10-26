#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { getToken, getSavedToken, getMachineId, readConfig, writeConfig, clearToken, looksLikeToken, saveTokenOwner, savedTokenOwner, CONFIG_DIR } from './lib/config.js';
import { remoteOwnerKind, resolveTokenOwner, whoami } from './lib/identity.js';
import * as autosubmit from './lib/autosubmit.js';
import { collectCorpus, corpusScope } from './lib/corpus.js';
import { autosubmitPitch, keepLocalHistoryHint } from './lib/pitch.js';
import { blockedMessage, helpText, parseArgs, submitMode } from './lib/args.js';
import { CCUSAGE, generateReport, noUsageHelp, parseReport } from './lib/ccusage.js';
import { SITE, describeWait, failureMessage, isVerifiedRefusal, networkErrorCode, postReport, submitHeaders } from './lib/submit.js';
import { appendLog, formatLogLine, isOverdue, lastSuccess, timeAgo } from './lib/runlog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json to get version
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const CLI_VERSION = packageJson.version;

const ARGS = parseArgs(process.argv.slice(2));

// Scheduled mode is an explicit --quiet and nothing else. A missing TTY used
// to count as well, which sent every run from an agent's shell or CI down the
// scheduled path; submitMode in lib/args.js has the story.
const QUIET = ARGS.flags.quiet;

// Whether a person can answer prompts. prompts reads stdin, and without a TTY
// there it either gets EOF and "cancels" or waits on a pipe that never
// answers, so every prompt below sits behind this.
const INTERACTIVE = !QUIET && process.stdin.isTTY === true;

// The report goes in viberank's own folder rather than the current one,
// which is usually somebody's repository, and is regenerated on every run so
// a stale one is never what gets sent.
const REPORT_FILE = path.join(CONFIG_DIR, 'cc.json');

// RunAtLoad and logon triggers fire on every boot, so a scheduled run skips
// itself within this long of a success.
const SKIP_WITHIN_MS = 20 * 60 * 60 * 1000;

const pad2 = (n) => String(n).padStart(2, '0');

/** GitHub handle: 1-39 alphanumerics with single interior hyphens. The
 * fallback source for the default is `git config user.name`, which has held
 * anything from real names to captured shell fragments — one of which ended
 * up as a public profile and a sitemap entry (#119). Validate rather than
 * warn: a warning is skippable, a re-prompt is not. */
function looksLikeGithubHandle(value) {
  return /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(value);
}

/**
 * Generate a fresh report with ccusage, save it to REPORT_FILE and check its
 * shape. Throws with a message a person can act on.
 */
async function loadReport() {
  const text = await generateReport();
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  // Saved before it is checked, so a report the CLI can't read is there to look at.
  fs.writeFileSync(REPORT_FILE, text, { mode: 0o600 });
  return parseReport(text);
}

/**
 * loadReport behind a spinner that counts the seconds. ccusage routinely
 * takes 15-25 s, and a spinner that doesn't move for that long reads as a hang.
 */
async function readUsage() {
  const started = Date.now();
  const seconds = () => Math.round((Date.now() - started) / 1000);
  const label = `Reading your usage with ${CCUSAGE}…`;
  const spinner = ora(label).start();
  const tick = setInterval(() => { spinner.text = `${label} ${seconds()}s`; }, 1000);
  try {
    const data = await loadReport();
    clearInterval(tick);
    if (data.daily.length === 0) spinner.warn('ccusage found no usage');
    else spinner.succeed(`Read ${data.daily.length} days of usage (${seconds()}s)`);
    return data;
  } catch (error) {
    clearInterval(tick);
    spinner.fail('Could not read your usage');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

/** Per-month corpus size, so the server can tell a transcript the runtime
 * rewrote from history the user deleted (#112). Best effort: a scan that
 * fails must never block a submission. */
function withCorpus(data) {
  try {
    const corpus = collectCorpus();
    if (corpus) return { ...data, drift: { corpus, scope: corpusScope() } };
  } catch {
    // No corpus block; the server falls back to holding the high-water mark.
  }
  return data;
}

function help() {
  console.log(`\n${chalk.yellow.bold('viberank')} — submit your AI coding usage (v${CLI_VERSION})\n`);
  console.log(helpText());
  console.log();
}

async function login() {
  const saved = ARGS.flags.token !== null ? await saveVerifiedToken(ARGS.flags.token.trim())
    : INTERACTIVE ? await acquireToken()
    : noTerminalForLogin();
  if (!saved) process.exit(1);
  console.log(`Next: ${chalk.bold('npx viberank-cli autosubmit')} to keep a running backup.\n`);
}

function noTerminalForLogin() {
  console.log(chalk.yellow('\nThere is no terminal here to paste a token into.'));
  console.log(`Pass it instead: ${chalk.bold('npx viberank-cli login --token vbr_…')} (tokens are at ${SITE}/settings/tokens)\n`);
  return false;
}

/**
 * Walk someone through creating and saving a token.
 *
 * Returns false instead of exiting so it can be offered mid-flow — the
 * autosubmit prompt used to hand out two commands to run later and end there,
 * which is a dead end at the exact moment someone has just said yes.
 */
async function acquireToken() {
  const url = `${SITE}/settings/tokens`;
  console.log(chalk.yellow.bold('\nConnect this machine to viberank\n'));
  console.log(`  1. Open ${chalk.cyan(url)}`);
  console.log('  2. Sign in with GitHub and click ' + chalk.bold('Create token'));
  console.log('  3. Paste it below\n');

  // Best effort — a headless box just uses the printed URL.
  try {
    // `start` is a cmd builtin and reads its first quoted argument as a
    // window title, hence the empty one before the URL.
    const command = process.platform === 'darwin' ? `open "${url}"`
      : process.platform === 'win32' ? `start "" "${url}"`
      : `xdg-open "${url}"`;
    execSync(command, { stdio: 'ignore', windowsHide: true });
  } catch {
    // No browser available; the URL above is enough.
  }

  const { token } = await prompts({
    type: 'password',
    name: 'token',
    message: 'Token:',
    validate: (v) => looksLikeToken(v.trim()) || 'That does not look like a viberank token (vbr_…)'
  });

  if (!token) {
    console.log(chalk.gray('\nNo token entered.'));
    return false;
  }
  return saveVerifiedToken(token.trim());
}

/**
 * Prove a token works, then save it. Shared by the pasted and the --token
 * paths, so a typo fails here rather than silently at 9am tomorrow inside a
 * scheduler. whoami also says whose token it is, which is the account every
 * submission with it is filed under (#181).
 */
async function saveVerifiedToken(token) {
  if (!looksLikeToken(token)) {
    console.log(chalk.red('\nThat does not look like a viberank token (vbr_ followed by 43 characters).\n'));
    return false;
  }

  const spinner = ora('Verifying…').start();
  const who = await whoami(SITE, token, { fetch });

  let rejected = who.status === 'rejected';
  if (who.status === 'unsupported' || who.status === 'unreachable') {
    // A server without whoami: an empty submit authenticates the token and is
    // then rejected on its own merits, which is all this needs.
    try {
      const res = await fetch(`${SITE}/api/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Viberank-Client': `cli/${CLI_VERSION}`,
          Authorization: `Bearer ${token}`,
        },
        body: '{}'
      });
      rejected = res.status === 401;
    } catch (error) {
      spinner.fail(`Could not check the token: ${failureMessage({ error })}`);
      return false;
    }
  }

  if (rejected) {
    spinner.fail('That token was rejected — it may be revoked or mistyped.');
    return false;
  }
  spinner.succeed(who.username ? `Token verified — signed in as @${who.username}` : 'Token verified');

  writeConfig({ token });
  if (who.username) saveTokenOwner(token, who.username);
  console.log(chalk.green(`\n✓ Saved to ${CONFIG_DIR}/config.json (owner-only)\n`));
  return true;
}

/** Forget the token, and the schedule with it: a scheduled run cannot submit
 * without a token, so leaving it on would only fill the log with failures. */
function logout() {
  const scheduled = autosubmit.isEnabled();
  clearToken();
  if (scheduled) autosubmit.disable();
  console.log(chalk.green('\n✓ Token removed.'));
  if (scheduled) {
    console.log(chalk.gray('  Automatic submission is off too, since it cannot submit without a token.'));
    console.log(chalk.gray('  Log in and run `npx viberank-cli autosubmit` to turn it back on.'));
  }
  if (process.env.VIBERANK_TOKEN) {
    console.log(chalk.gray('  VIBERANK_TOKEN is still set in this shell, and the CLI will keep using it here.'));
  }
  console.log();
}

/** The token line of `status`: whose it is, per the server, or that it was revoked. */
async function describeToken(token) {
  if (!token) return chalk.gray('none — run `npx viberank-cli login`');
  const source = token === process.env.VIBERANK_TOKEN ? 'from VIBERANK_TOKEN' : 'saved';
  const who = await whoami(SITE, token, { fetch });
  if (who.status === 'ok') return chalk.green(`${source}, signed in as @${who.username}`);
  if (who.status === 'rejected') {
    return chalk.red(`${source}, but REJECTED: it was revoked or mistyped. Run \`npx viberank-cli login\` to save a new one.`);
  }
  return chalk.yellow(`${source}, not checked (could not reach viberank.app)`);
}

function describeSchedule(s, config) {
  if (!s.scheduler) return chalk.gray(`not available on ${process.platform}`);
  if (!s.enabled) return chalk.gray('off — run `npx viberank-cli autosubmit`');
  const at = config.autosubmit ? `, daily at ${pad2(config.autosubmit.hour)}:${pad2(config.autosubmit.minute)}` : '';
  const line = chalk.green(`on (${s.scheduler})${at}`);
  if (!s.lastRun) return line;
  if (!s.lastRun.ran) return `${line}${chalk.gray(', not run yet')}`;
  const exit = `last run exited ${s.lastRun.exitCode}`;
  return `${line}, ${s.lastRun.exitCode === 0 ? chalk.green(exit) : chalk.red(exit)}`;
}

/** Things about the schedule that mean it will not work as it stands. */
function scheduleWarnings(s, token) {
  if (!s.enabled) return [];
  const notes = [];
  if (s.outdated) {
    notes.push('This job was set up by an older version and cannot find node. Run `npx viberank-cli autosubmit` once to repair it.');
  } else if (s.lastRun?.exitCode === 127) {
    notes.push('The last run could not find node or npx. Run `npx viberank-cli autosubmit` to rewrite the job.');
  }
  if (!getSavedToken()) {
    notes.push(token
      ? 'The scheduled job cannot see VIBERANK_TOKEN. Save the token with `npx viberank-cli login --token <token>`.'
      : 'There is no saved token, so the scheduled job cannot submit. Run `npx viberank-cli login`.');
  }
  return notes;
}

async function showStatus() {
  const token = getToken();
  const config = readConfig();
  const s = autosubmit.status();

  console.log(chalk.yellow.bold('\nviberank status\n'));
  console.log(`  token        ${await describeToken(token)}`);
  console.log(`  autosubmit   ${describeSchedule(s, config)}`);
  for (const note of scheduleWarnings(s, token)) console.log(chalk.yellow(`  ! ${note}`));

  const last = lastSuccess(config);
  console.log(`  last submit  ${last ? `${last.toLocaleString()} (${timeAgo(last)})` : chalk.gray('none recorded on this machine')}`);
  if (isOverdue({ enabled: s.enabled, last, enabledAt: config.autosubmit?.enabledAt })) {
    console.log(chalk.yellow('  ! No successful submission in over 48 hours. The recent runs below should say why.'));
  }
  console.log(`  machine id   ${getMachineId()}`);

  if (s.log.length) {
    console.log(chalk.gray(`\n  recent runs (${autosubmit.LOG_FILE}):`));
    for (const line of s.log) console.log(chalk.gray(`    ${line}`));
  }
  console.log();
}

/**
 * A scheduled run cannot sign in through a browser and does not inherit the
 * shell's VIBERANK_TOKEN, so autosubmit needs a token saved on disk. Get one
 * inline when someone is here to paste it, rather than send them off to run
 * `login` and come back.
 */
async function ensureSavedToken() {
  if (getSavedToken()) return true;
  console.log(chalk.yellow(process.env.VIBERANK_TOKEN
    ? '\nVIBERANK_TOKEN is set in this shell, but a scheduled job will not see it, so it needs a saved token.'
    : '\nA scheduled run cannot sign in through a browser, so it needs a token first.'));
  if (!INTERACTIVE) {
    console.log(`Save one with ${chalk.bold('npx viberank-cli login --token <token>')} (from ${SITE}/settings/tokens), then run this again.\n`);
    return false;
  }
  return acquireToken();
}

/** Install the daily job and say how to check on it. False if the scheduler refused it. */
function enableAutosubmit(hour) {
  let result;
  try {
    result = autosubmit.enable(hour);
  } catch (error) {
    console.log(chalk.red(`\nCould not turn on automatic submission.\n${error.message}\n`));
    return false;
  }
  console.log(chalk.green(`\n✓ Submitting daily at ${pad2(result.hour)}:${pad2(result.minute)} via ${result.scheduler}.`));
  console.log(chalk.gray(`  ${result.path}`));
  console.log(chalk.gray('  The minute is fixed per machine, so not everyone submits at once.'));
  if (!result.durable) {
    // Scheduled through `npx -y` because this copy lives in npm's throwaway
    // cache. Say so, rather than let someone wonder why a background job
    // reaches the network.
    console.log(chalk.gray('  Runs via npx, so it stays on the latest version.'));
    console.log(chalk.gray('  For an offline-capable job: npm i -g viberank-cli, then re-run this.'));
  }
  console.log(`  Check on it any time: ${chalk.bold('npx viberank-cli status')}`);
  console.log(chalk.gray('  Turn it off with: npx viberank-cli autosubmit off\n'));
  return true;
}

async function autosubmitCommand(arg) {
  if (arg === 'off' || arg === 'disable') {
    autosubmit.disable();
    console.log(chalk.green('\n✓ Automatic submission disabled.\n'));
    return;
  }

  if (!autosubmit.platform()) {
    console.log(chalk.red(`\nNo supported scheduler on ${process.platform}.`));
    console.log('Run `npx viberank-cli submit --quiet` from your own cron instead.\n');
    process.exit(1);
  }

  if (!(await ensureSavedToken())) process.exit(1);

  let hour = 9;
  if (INTERACTIVE) {
    const answer = await prompts({
      type: 'number',
      name: 'hour',
      message: 'Hour of day to submit (0-23):',
      initial: 9,
      validate: (v) => (v >= 0 && v <= 23) || '0-23'
    });
    if (answer.hour === undefined) {
      console.log(chalk.gray('\nCancelled; nothing was scheduled.\n'));
      return;
    }
    hour = answer.hour;
  }
  if (!enableAutosubmit(hour)) process.exit(1);
}

/** Whether stdout is the autosubmit log itself, as it is under launchd. */
function outputIsLogFile() {
  try {
    const out = fs.fstatSync(1);
    const log = fs.statSync(autosubmit.LOG_FILE);
    return out.ino === log.ino && out.dev === log.dev;
  } catch {
    return false;
  }
}

/** One dated line in ~/.viberank/autosubmit.log, echoed to the console
 * unless the console is that very file. */
function logRun(entry) {
  const line = formatLogLine(entry);
  let logged = false;
  try {
    appendLog(autosubmit.LOG_FILE, line);
    logged = true;
  } catch {
    // A read-only home still gets the console line.
  }
  if (!logged || !outputIsLogFile()) (entry.outcome === 'fail' ? console.error : console.log)(line);
}

/**
 * The scheduled path: no prompts, no cwd writes, one dated line per run.
 * Identity comes from the API token (the server resolves the token's owner and
 * ignores the header claim), so a token is required here.
 */
async function quietSubmit() {
  const token = getToken();
  if (!token) {
    logRun({ outcome: 'fail', detail: 'no API token: run `npx viberank-cli login`, then `npx viberank-cli autosubmit` again' });
    process.exit(1);
  }

  // Any success counts, a manual one included: it sent the same data, and a
  // second send within the hour would only meet the rate limit.
  const last = lastSuccess(readConfig());
  if (last && Date.now() - last.getTime() < SKIP_WITHIN_MS) {
    logRun({ outcome: 'skip', detail: `already submitted at ${last.toISOString()}` });
    return;
  }

  let data;
  try {
    data = await loadReport();
  } catch (error) {
    logRun({ outcome: 'fail', detail: `ccusage: ${error.message}` });
    process.exit(1);
  }
  if (data.daily.length === 0) {
    logRun({ outcome: 'fail', detail: 'ccusage found no usage on this machine; run `npx viberank-cli` in a terminal to see where it looks' });
    process.exit(1);
  }

  // The server files a token submission under the token's owner whatever the
  // header says, so log that owner; a revoked token is reported here instead
  // of as a generic 401 after the upload.
  const owner = await resolveTokenOwner(SITE, token, savedTokenOwner(token), { fetch });
  if (owner.rejected) {
    logRun({ outcome: 'fail', status: 401, detail: 'API token rejected (revoked?): run `npx viberank-cli login` again' });
    process.exit(1);
  }
  if (owner.fresh) saveTokenOwner(token, owner.username);

  const githubUser = owner.username || readConfig().username || 'autosubmit';
  const outcome = await postReport({
    fetch,
    headers: submitHeaders({ version: CLI_VERSION, machineId: getMachineId(), githubUser, token }),
    payload: withCorpus(data),
    scheduled: true,
  });

  if (outcome.ok) {
    const now = new Date().toISOString();
    writeConfig({ lastAutosubmit: now, lastSubmit: now });
    const as = owner.username ? ` as @${owner.username}` : '';
    const waited = outcome.waitedSeconds ? `, after waiting ${describeWait(outcome.waitedSeconds)} for the rate limit` : '';
    logRun({ outcome: 'ok', status: outcome.status, detail: `submitted ${data.daily.length} days${as}${waited} ${outcome.body.profileUrl ?? ''}` });
    return;
  }

  const retry = outcome.status === 429 && outcome.retryAfter != null ? ` (try again in ${describeWait(outcome.retryAfter)})` : '';
  logRun({ outcome: 'fail', status: outcome.status, detail: `${failureMessage(outcome)}${retry}` });
  process.exit(1);
}

/**
 * Ask which GitHub account to submit as. Used only without a known token
 * owner: with one, the server decides and there is nothing to ask.
 */
async function askUsername() {
  // `source` matters: a GitHub remote owned by a user is evidence,
  // `git config user.name` is a guess, and only evidence is allowed to become
  // the prompt's default (#141).
  let githubUser;
  let source = null;

  // A handle this machine already submitted under beats every guess: it is
  // the one answer we know is right, and pre-filling it means a stray reply to
  // the prompt ("NO") can't quietly start a second profile (#151).
  const remembered = looksLikeGithubHandle(readConfig().username ?? '') ? readConfig().username : null;

  // First, try to extract from GitHub remote URL, e.g.
  // https://github.com/username/repo(.git) or git@github.com:username/repo.git
  try {
    const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
    const githubMatch = remoteUrl.match(/github\.com[:/]([^/]+)\//);
    if (githubMatch) {
      githubUser = githubMatch[1];
      source = 'remote';
    }
  } catch {
    // Repository might not have a GitHub remote
  }

  // A remote's owner is often an organization, which nobody can sign in as;
  // pre-filling it is how an organization became a profile (#181). Ask GitHub
  // which kind of account it is, and pre-fill only a confirmed user. Skipped
  // when a remembered handle wins anyway.
  if (source === 'remote' && !remembered && looksLikeGithubHandle(githubUser)) {
    const kind = await remoteOwnerKind(githubUser, { fetch });
    if (kind === 'user') {
      console.log(chalk.gray(`Detected GitHub username from repository: ${githubUser}`));
    } else {
      if (kind === 'organization') {
        console.log(chalk.gray(`This repository belongs to the GitHub organization "${githubUser}", not a user.`));
      }
      source = 'remote-unconfirmed';
    }
  }

  // If we couldn't get it from remote, try git config user.name as fallback
  if (!githubUser) {
    try {
      githubUser = execSync('git config user.name', { encoding: 'utf8' }).trim();
      source = 'gitconfig';
    } catch {
      console.log(chalk.yellow('Could not detect GitHub username automatically'));
    }
  }

  // Always confirm with the user.
  //
  // Only a remote owned by a confirmed GitHub user pre-fills the answer.
  // `git config user.name` is usually a display name, and pre-filling it
  // turned a reflexive Enter into a submission under a handle that wasn't the
  // user's — that is how a public profile called "Matt" appeared, holding 86B
  // tokens belonging to mattw90 (#141). Validation cannot catch it: "Matt" is
  // a perfectly well-formed GitHub handle. An organization, or an owner GitHub
  // couldn't confirm, is shown the same way: in the question, not the field.
  const hint = remembered ? null
    : source === 'gitconfig' ? `git config says "${githubUser}"`
    : source === 'remote-unconfirmed' ? `the repository owner is "${githubUser}"`
    : null;
  const response = await prompts({
    type: 'text',
    name: 'username',
    message: hint
      ? `GitHub username (${hint} — type it if that's you)`
      : 'GitHub username:',
    initial: remembered ?? (source === 'remote' && looksLikeGithubHandle(githubUser) ? githubUser : ''),
    validate: (value) =>
      looksLikeGithubHandle(value.trim()) ||
      'That is not a valid GitHub username (1-39 letters, digits, single hyphens)'
  });

  if (!response.username) {
    console.log(chalk.red('Username is required. Exiting.'));
    process.exit(1);
  }

  githubUser = response.username.trim();

  if (remembered && githubUser.toLowerCase() !== remembered.toLowerCase()) {
    const switchResponse = await prompts({
      type: 'confirm',
      name: 'switch',
      message: `This machine submitted as @${remembered} before. Submit as @${githubUser} instead? That is a separate profile.`,
      initial: false
    });
    if (!switchResponse.switch) githubUser = remembered;
  }
  return githubUser;
}

/**
 * The name for X-GitHub-User when no token owner is known: --user, else the
 * prompt, else (unattended, with a token an old server could not name) the
 * name this machine used before. Null when there is nothing to go on; with a
 * token the server ignores the header anyway.
 */
async function chooseUsername() {
  const flagged = ARGS.flags.user;
  const remembered = readConfig().username;
  if (flagged) {
    if (remembered && remembered.toLowerCase() !== flagged.toLowerCase()) {
      console.log(chalk.yellow(`This machine submitted as @${remembered} before; @${flagged} is a separate profile.`));
    }
    return flagged;
  }
  if (INTERACTIVE) return askUsername();
  return looksLikeGithubHandle(remembered ?? '') ? remembered : null;
}

/**
 * With a saved token the server files the submission under the token's owner
 * and ignores any typed name, so find that owner first (#181). Returns the
 * owner, or null when it can't be known (old server, offline, nothing saved).
 */
async function signedInOwner(token) {
  const spinner = ora('Checking your saved token…').start();
  const owner = await resolveTokenOwner(SITE, token, savedTokenOwner(token), { fetch });
  if (owner.rejected) {
    spinner.fail('Your saved API token was rejected — it may have been revoked.');
    console.log(`Run ${chalk.bold('npx viberank-cli login')} to save a new one, or ${chalk.bold('npx viberank-cli logout')} to submit without one.\n`);
    process.exit(1);
  }
  if (!owner.username) {
    spinner.stop();
    return null;
  }
  if (owner.fresh) {
    try { saveTokenOwner(token, owner.username); } catch { /* best effort */ }
  }
  spinner.succeed(`Signed in as @${owner.username}`);
  return owner.username;
}

async function confirmSubmit(githubUser, signedInAs, token) {
  const { submit } = await prompts({
    type: 'confirm',
    name: 'submit',
    // Name only the account the server will actually file this under. With a
    // token whose owner is unknown (an older server), the typed name is not
    // it, so don't claim one (#181).
    message: signedInAs
      ? `Submit to Viberank as @${githubUser} (signed in) — ${SITE}/profile/${githubUser}?`
      : token
        ? 'Submit to Viberank with your saved token? It is filed under the account that owns the token.'
        : `Submit to Viberank as @${githubUser} (${SITE}/profile/${githubUser})?`,
    initial: true
  });
  return Boolean(submit);
}

async function postWithSpinner(payload, githubUser) {
  const spinner = ora('Submitting to Viberank...').start();
  const outcome = await postReport({
    fetch,
    headers: submitHeaders({ version: CLI_VERSION, machineId: getMachineId(), githubUser, token: getToken() }),
    payload,
    onRetry: ({ reason, attempt, delayMs }) => {
      const what = reason === 'network' ? 'Connection failed' : 'Viberank is temporarily unavailable';
      spinner.text = `${what}. Retrying in ${delayMs / 1000} seconds... (attempt ${attempt}/3)`;
    },
  });
  if (outcome.ok) spinner.succeed('Successfully submitted to Viberank!');
  else spinner.fail('Failed to submit to Viberank');
  return outcome;
}

/** The error, plus what to do about it where there is something to do. */
function explainFailure(outcome) {
  if (outcome.error) {
    if (networkErrorCode(outcome.error)) {
      console.error(chalk.red('Error: Unable to connect to Viberank server'));
      console.log(chalk.yellow('\nPlease check your internet connection and try again.'));
    } else {
      console.error(chalk.red('Error:', outcome.error.message));
    }
    return;
  }
  if (outcome.body === null) {
    console.error(chalk.red(`Error: Invalid response from server (${outcome.status})`));
    console.log(chalk.yellow('\nThe server may be experiencing issues. Please try again later.'));
    return;
  }

  console.error(chalk.red('Error:', failureMessage(outcome)));
  const { status } = outcome;
  if (status === 400) {
    console.log(chalk.yellow('\nTroubleshooting tips:'));
    console.log(chalk.yellow(`- This CLI reads your usage with ${CCUSAGE}; make sure the CLI itself is current: npx viberank-cli@latest`));
    console.log(chalk.yellow(`- The report it sent is at ${REPORT_FILE}`));
  } else if (isVerifiedRefusal(outcome) && !INTERACTIVE) {
    console.log(chalk.yellow(`\nSave a token with ${chalk.bold('npx viberank-cli login --token <token>')} (from ${SITE}/settings/tokens), then submit again.`));
  } else if (status === 413) {
    console.log(chalk.yellow('\nYour usage data is too large. Consider submitting data for a shorter time period.'));
  } else if (status === 429) {
    const wait = outcome.retryAfter != null ? `Try again in ${describeWait(outcome.retryAfter)}.` : 'Try again a little later.';
    console.log(chalk.yellow(`\nviberank limits how often one account can submit. ${wait}`));
  } else if (status === 503) {
    console.log(chalk.yellow('\nThe database service is temporarily unavailable.'));
    console.log(chalk.yellow('Please wait a few minutes and try again.'));
  } else if (status >= 500) {
    console.log(chalk.yellow('\nThe server is experiencing issues. Please try again in a few moments.'));
    console.log(chalk.yellow('If this persists, please report it at: https://github.com/sculptdotfun/viberank/issues'));
  }
}

/**
 * Submit, recovering on the spot from the one refusal a person can fix there:
 * a verified profile refusing an unsigned submission. Signing in fixes it, so
 * do that inline and send the same payload again, rather than stop and make
 * them read their usage all over again. Exits on failure.
 */
async function sendReport(payload, githubUser) {
  let outcome = await postWithSpinner(payload, githubUser);
  if (!outcome.ok && isVerifiedRefusal(outcome) && INTERACTIVE && !getToken()) {
    console.log(chalk.yellow(`\n@${githubUser} is verified, so a submission to it has to be signed with a token.`));
    console.log(chalk.yellow('Sign in once and this one goes through, without reading your usage again.'));
    if (await acquireToken()) outcome = await postWithSpinner(payload, githubUser);
  }
  if (!outcome.ok) {
    explainFailure(outcome);
    process.exit(1);
  }
  return outcome.body;
}

/** Where you landed, and the badge, right here. This is the one moment
 * someone is actually pleased with the tool, and it used to print a bare URL
 * — which is why almost nobody has ever put the badge up. */
function showResult(result) {
  const st = result.standing;
  if (st && st.totalDevelopers > 0) {
    console.log(
      `\n  ${chalk.yellow.bold(`#${st.rank}`)} of ${st.totalDevelopers.toLocaleString('en-US')} developers` +
      `  ${chalk.gray('·')}  top ${chalk.bold(st.topPercent + '%')}` +
      `  ${chalk.gray('·')}  ${chalk.bold(st.tier)} tier`
    );
  }
  console.log(`\n  Profile: ${chalk.green(result.profileUrl)}`);
  if (st && st.badgeMarkdown) {
    console.log(`\n  ${chalk.gray('Badge for your README:')}`);
    console.log(`  ${chalk.cyan(st.badgeMarkdown)}\n`);
  } else {
    console.log('');
  }
  if (result.hint) console.log(chalk.yellow(result.hint) + '\n');
  if (result.notice) console.log(chalk.gray(result.notice) + '\n');
}

/** A submit with a person at the terminal, or an unattended one that has
 * what it needs (see submitMode). Never prompts unless INTERACTIVE. */
async function main() {
  console.log(chalk.yellow.bold(`\n🚀 Viberank Submission Tool v${CLI_VERSION}\n`));

  const token = getToken();
  const signedInAs = token ? await signedInOwner(token) : null;
  if (signedInAs && ARGS.flags.user && ARGS.flags.user.toLowerCase() !== signedInAs.toLowerCase()) {
    console.log(chalk.yellow(`The token decides the account, so this is filed under @${signedInAs}, not @${ARGS.flags.user}.`));
  }
  const githubUser = signedInAs ?? (await chooseUsername());

  const data = await readUsage();
  if (data.daily.length === 0) {
    console.log();
    for (const line of noUsageHelp()) console.log(chalk.yellow(line));
    console.log();
    process.exit(1);
  }

  console.log('\nSummary:');
  console.log(`  Total Cost: ${chalk.green('$' + Math.round(data.totals.totalCost))}`);
  console.log(`  Total Tokens: ${chalk.green(data.totals.totalTokens.toLocaleString())}`);
  console.log(`  Days Tracked: ${chalk.green(data.daily.length)}\n`);

  if (INTERACTIVE && !ARGS.flags.yes && !(await confirmSubmit(githubUser, signedInAs, token))) {
    console.log(chalk.yellow('Submission cancelled.'));
    process.exit(0);
  }

  const result = await sendReport(withCorpus(data), githubUser ?? 'autosubmit');
  // Remember the handle only once a submission has landed under it, so the
  // next prompt's default is a name this machine really submitted as. A
  // scheduled --quiet run also falls back to it, having no TTY to ask on.
  try {
    writeConfig({ lastSubmit: new Date().toISOString(), ...(githubUser ? { username: githubUser } : {}) });
  } catch { /* best effort */ }
  showResult(result);

  if (INTERACTIVE) await offerAutosubmit(data);
  console.log(chalk.green('\nDone! 🎉'));
}

/**
 * Offer to keep submitting after a successful one-off submit.
 *
 * A single submission freezes your rank on the day you sent it, and 94% of
 * people who join never send a second one — the feature that fixes that has
 * been a settings page nobody visits. So ask here, where the value is obvious,
 * defaulted to yes.
 *
 * Deliberately a prompt and not a silent default: this installs a scheduled
 * job that runs daily and uploads. Doing that without an explicit yes is not
 * something to spring on anyone, least of all this audience.
 */
async function offerAutosubmit(ccData) {
  if (!INTERACTIVE) return;                 // nobody to ask
  if (!autosubmit.platform()) return;       // no scheduler we can drive
  if (autosubmit.isEnabled()) {
    // Already on, but a job from before 1.13 cannot start, and cannot fix
    // itself either. This is the moment its owner is here to hear it.
    if (autosubmit.status().outdated) {
      console.log(chalk.yellow('\nYour daily autosubmit job was set up by an older version and cannot find node.'));
      console.log(chalk.yellow(`Run ${chalk.bold('npx viberank-cli autosubmit')} once to repair it.`));
    }
    return;
  }

  // The pitch used to be about keeping a rank fresh. That is the vanity reason
  // and it converts badly — 62 of ~1,100 people have ever sent a second report.
  // The true reason is better: Claude Code deletes session transcripts after
  // `cleanupPeriodDays`, 30 by default, with no warning and no recovery. Once
  // it runs, the local history is gone for every tool that reads those files.
  // What has already been submitted here survives it. That makes autosubmit a
  // backup rather than a leaderboard chore, and it is the one thing viberank
  // can offer that a tool reading the same folder cannot.
  for (const line of autosubmitPitch(ccData)) console.log(chalk.gray(line));

  const { enable } = await prompts({
    type: 'confirm',
    name: 'enable',
    message: 'Keep a running backup of my usage?',
    initial: true,
  });
  if (!enable) {
    console.log(chalk.gray('No problem — turn it on later with `npx viberank-cli autosubmit`.'));
    return;
  }

  // A scheduled run can't open a browser, so it needs a token first. Offer to
  // do it here rather than printing two commands to run later: they just said
  // yes, and sending them away to read instructions is where that yes is lost.
  if (!getSavedToken() && !(await acquireToken())) {
    console.log(chalk.gray(`Turn it on any time with ${chalk.bold('npx viberank-cli autosubmit')}.\n`));
    return;
  }

  if (enableAutosubmit(9)) {
    // We back the history up; we can also tell them how to stop losing it in
    // the first place. Costs nothing and is the more useful half of the advice.
    console.log(chalk.gray(`  ${keepLocalHistoryHint()}`));
  } else {
    console.log(chalk.gray('Run `npx viberank-cli autosubmit` to try again.'));
  }
}

async function submitCommand() {
  if (QUIET) return quietSubmit();
  if (ARGS.flags.user && !looksLikeGithubHandle(ARGS.flags.user)) {
    console.error(chalk.red(`"${ARGS.flags.user}" is not a valid GitHub username (1-39 letters, digits, single hyphens).`));
    process.exit(1);
  }
  const mode = submitMode({
    quiet: QUIET,
    interactive: INTERACTIVE,
    hasToken: Boolean(getToken()),
    user: ARGS.flags.user,
    yes: ARGS.flags.yes,
  });
  if (mode === 'blocked') {
    const [first, ...rest] = blockedMessage();
    console.error(chalk.yellow(`\n${first}`));
    for (const line of rest) console.error(line);
    console.error();
    process.exit(1);
  }
  return main();
}

const run = async () => {
  // Global fetch arrived in Node 18. Without it every network call would
  // fail with "fetch is not defined", which says nothing about the fix.
  if (typeof fetch !== 'function') {
    throw new Error(`viberank-cli needs Node.js 18 or newer; this is ${process.version}.`);
  }

  // Read before anything else. These used to be filtered out with every
  // other `--` argument, so `--help` started a submission.
  if (ARGS.flags.version) return console.log(CLI_VERSION);
  if (ARGS.flags.help || ARGS.command === 'help') return help();
  if (ARGS.unknown.length || ARGS.missing.length) {
    for (const name of ARGS.unknown) console.error(chalk.red(`Unknown option: ${name}`));
    for (const name of ARGS.missing) console.error(chalk.red(`${name} needs a value`));
    console.error(`Run ${chalk.bold('npx viberank-cli --help')} for every command and option.`);
    process.exit(1);
  }

  switch (ARGS.command) {
    case undefined:
    case 'submit':
      return submitCommand();
    case 'login':
      return login();
    case 'logout':
      return logout();
    case 'status':
      return showStatus();
    case 'autosubmit':
      return autosubmitCommand(ARGS.arg);
    default:
      console.error(chalk.red(`Unknown command: ${ARGS.command}`));
      help();
      process.exit(1);
  }
};

run().catch(error => {
  // A scheduled run logs to a file nobody watches, so it goes there as a
  // dated line like every other outcome; an undated stack trace is close to
  // useless when it turns up weeks later.
  if (QUIET) logRun({ outcome: 'fail', detail: `unexpected error: ${error.message}` });
  else console.error(chalk.red(`Unexpected error: ${error.message}`));
  process.exit(1);
});
