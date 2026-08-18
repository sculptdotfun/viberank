#!/usr/bin/env node

import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import fetch from 'node-fetch';
import { getToken, getMachineId, readConfig, writeConfig, clearToken, looksLikeToken, CONFIG_DIR } from './lib/config.js';
import * as autosubmit from './lib/autosubmit.js';
import { collectCorpus } from './lib/corpus.js';
import { runNpx } from './lib/npx.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Quiet mode: no prompts, no cwd side effects, timestamped log lines. A
// scheduled run passes --quiet explicitly; a missing TTY means there is no
// human to answer prompts either way, so treat that as quiet too rather than
// cancel (the pre-1.5 behavior: prompts got EOF, "cancelled", exit 0 — every
// scheduled autosubmit run since the feature shipped was a silent no-op).
const QUIET = process.argv.includes('--quiet') || !process.stdin.isTTY;

/** GitHub handle: 1-39 alphanumerics with single interior hyphens. The
 * fallback source for the default is `git config user.name`, which has held
 * anything from real names to captured shell fragments — one of which ended
 * up as a public profile and a sitemap entry (#119). Validate rather than
 * warn: a warning is skippable, a re-prompt is not. */
function looksLikeGithubHandle(value) {
  return /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(value);
}

/** Generate a fresh ccusage report to `dest` without relying on PATH or a
 * shell redirect — a launchd/schtasks job runs with a minimal PATH that has
 * no node or npx on it. lib/npx.js resolves the npx entrypoint next to the
 * running node binary; going through node rather than the `npx.cmd` shim is
 * also what keeps this from throwing EINVAL on Windows (#137). */
function generateCcJson(dest) {
  const out = runNpx(['-y', 'ccusage@latest', 'daily', '--json'], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  fs.writeFileSync(dest, out);
}

// Read package.json to get version
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const CLI_VERSION = packageJson.version;


const SITE = 'https://www.viberank.app';

function help() {
  console.log(`
${chalk.yellow.bold('viberank')} — submit your AI coding usage

  ${chalk.bold('npx viberank-cli')}                 submit now (interactive)
  ${chalk.bold('npx viberank-cli login')}           save an API token
  ${chalk.bold('npx viberank-cli logout')}          forget the saved token
  ${chalk.bold('npx viberank-cli autosubmit')}      submit once a day in the background
  ${chalk.bold('npx viberank-cli autosubmit off')}  stop submitting automatically
  ${chalk.bold('npx viberank-cli status')}          show token and schedule state

Most people run ${chalk.bold('login')} once, then ${chalk.bold('autosubmit')} once, and never think
about it again — your rank stays current instead of freezing on the day you
first submitted.
`);
}

async function login() {
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
    console.log(chalk.red('\nNo token entered.'));
    process.exit(1);
  }

  // Prove it works before saving, so a typo fails here rather than silently
  // at 9am tomorrow inside a scheduler.
  const spinner = ora('Verifying…').start();
  const res = await fetch(`${SITE}/api/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.trim()}` },
    body: '{}'
  });

  if (res.status === 401) {
    spinner.fail('That token was rejected — it may be revoked or mistyped.');
    process.exit(1);
  }
  // Any other status means the token authenticated and the empty body was
  // then rejected on its own merits, which is what we want.
  spinner.succeed('Token verified');

  writeConfig({ token: token.trim() });
  console.log(chalk.green(`\n✓ Saved to ${CONFIG_DIR}/config.json (owner-only)\n`));
  console.log(`Next: ${chalk.bold('npx viberank-cli autosubmit')} to keep your rank current.\n`);
}

function logout() {
  clearToken();
  console.log(chalk.green('\n✓ Token removed. Scheduled submissions will stop working.\n'));
}

function showStatus() {
  const token = getToken();
  const s = autosubmit.status();

  console.log(chalk.yellow.bold('\nviberank status\n'));
  console.log(`  token       ${token ? chalk.green('saved') : chalk.gray('none — run `viberank login`')}`);
  console.log(`  autosubmit  ${s.enabled ? chalk.green(`on (${s.scheduler})`) : chalk.gray('off')}`);
  console.log(`  machine id  ${getMachineId()}`);

  if (s.log.length) {
    console.log(chalk.gray('\n  recent runs:'));
    for (const line of s.log) console.log(chalk.gray(`    ${line}`));
  }
  console.log();
}

async function autosubmitCommand(arg) {
  if (arg === 'off' || arg === 'disable') {
    autosubmit.disable();
    console.log(chalk.green('\n✓ Automatic submission disabled.\n'));
    return;
  }

  if (!autosubmit.platform()) {
    console.log(chalk.red(`\nNo supported scheduler on ${process.platform}.`));
    console.log('Run `npx viberank-cli submit` from your own cron instead.\n');
    process.exit(1);
  }

  if (!getToken()) {
    console.log(chalk.yellow('\nA scheduled run cannot sign in through a browser, so it needs a token first.'));
    console.log(`Run ${chalk.bold('npx viberank-cli login')}, then try again.\n`);
    process.exit(1);
  }

  const { hour } = await prompts({
    type: 'number',
    name: 'hour',
    message: 'Hour of day to submit (0-23):',
    initial: 9,
    validate: (v) => (v >= 0 && v <= 23) || '0-23'
  });

  const result = autosubmit.enable(hour ?? 9);
  console.log(chalk.green(`\n✓ Submitting daily at ${String(result.hour).padStart(2, '0')}:00 via ${result.scheduler}.`));
  console.log(chalk.gray(`  ${result.path}`));
  if (!result.durable) {
    // Scheduled through `npx -y` because this copy lives in npm's throwaway
    // cache. Say so, rather than let someone wonder why a background job
    // reaches the network.
    console.log(chalk.gray('  Runs via npx, so it stays on the latest version.'));
    console.log(chalk.gray('  For an offline-capable job: npm i -g viberank-cli, then re-run this.'));
  }
  console.log(chalk.gray('  Turn it off with: npx viberank-cli autosubmit off\n'));
}

/**
 * The scheduled path: no prompts, no cwd writes, one timestamped line per run.
 * Identity comes from the API token (the server resolves the token's owner and
 * ignores the header claim), so a token is required here.
 */
async function quietSubmit() {
  const stamp = () => `[${new Date().toISOString()}]`;

  if (!getToken()) {
    console.error(`${stamp()} no API token — run \`npx viberank-cli login\`, then re-enable autosubmit`);
    process.exit(1);
  }

  // RunAtLoad/logon triggers fire on every boot; skip if a run already
  // succeeded in the last 20 hours so catch-up never double-submits.
  const last = readConfig().lastAutosubmit;
  if (last && Date.now() - Date.parse(last) < 20 * 60 * 60 * 1000) {
    console.log(`${stamp()} already submitted at ${last}, skipping`);
    return;
  }

  const ccJsonPath = path.join(CONFIG_DIR, 'cc.json');
  try {
    generateCcJson(ccJsonPath);
  } catch (error) {
    console.error(`${stamp()} ccusage failed: ${error.message}`);
    process.exit(1);
  }

  const ccData = JSON.parse(fs.readFileSync(ccJsonPath, 'utf8'));
  try {
    const corpus = collectCorpus();
    if (corpus) ccData.drift = { corpus };
  } catch { /* best effort */ }

  const githubUser = readConfig().username || 'autosubmit';
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch('https://www.viberank.app/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-User': githubUser,
          'X-CLI-Version': CLI_VERSION,
          'X-Machine-Id': getMachineId(),
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(ccData),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.success) {
        writeConfig({ lastAutosubmit: new Date().toISOString() });
        console.log(`${stamp()} submitted ${ccData.daily?.length ?? '?'} days — ${result.profileUrl ?? ''}`);
        try { fs.unlinkSync(ccJsonPath); } catch { /* fine */ }
        return;
      }
      lastError = new Error(result.error || `server returned ${response.status}`);
      if (response.status !== 503 && response.status < 500) break; // 4xx: retrying won't help
    } catch (error) {
      lastError = error; // network error — retry
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 5000 * attempt));
  }

  try { fs.unlinkSync(ccJsonPath); } catch { /* fine */ }
  console.error(`${stamp()} submit failed: ${lastError?.message ?? 'unknown error'}`);
  process.exit(1);
}

async function main() {
  if (QUIET) return quietSubmit();

  console.log(chalk.yellow.bold(`\n🚀 Viberank Submission Tool v${CLI_VERSION}\n`));

  // Try to get GitHub username from remote URL first, then fall back to git config
  let githubUser;
  
  // First, try to extract from GitHub remote URL
  try {
    const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
    // Match GitHub URLs like:
    // https://github.com/username/repo.git
    // git@github.com:username/repo.git
    // https://github.com/username/repo
    const githubMatch = remoteUrl.match(/github\.com[:/]([^/]+)\//);
    if (githubMatch) {
      githubUser = githubMatch[1];
      console.log(chalk.gray(`Detected GitHub username from repository: ${githubUser}`));
    }
  } catch (error) {
    // Repository might not have a GitHub remote
  }
  
  // If we couldn't get it from remote, try git config user.name as fallback
  if (!githubUser) {
    try {
      githubUser = execSync('git config user.name', { encoding: 'utf8' }).trim();
      console.log(chalk.yellow('Warning: Using git config user.name which might be your real name, not GitHub username'));
      console.log(chalk.yellow('Please verify this is correct or enter your GitHub username manually'));
    } catch (error) {
      console.log(chalk.yellow('Could not detect GitHub username automatically'));
    }
  }

  // Always confirm with the user
  const response = await prompts({
    type: 'text',
    name: 'username',
    message: 'GitHub username:',
    initial: githubUser && looksLikeGithubHandle(githubUser) ? githubUser : '',
    validate: (value) =>
      looksLikeGithubHandle(value.trim()) ||
      'That is not a valid GitHub username (1-39 letters, digits, single hyphens)'
  });
  
  if (!response.username) {
    console.log(chalk.red('Username is required. Exiting.'));
    process.exit(1);
  }
  
  githubUser = response.username.trim();
  // Remember it: a scheduled --quiet run has no TTY to ask on.
  try { writeConfig({ username: githubUser }); } catch { /* best effort */ }

  // Check if cc.json already exists
  let ccJsonPath = path.join(process.cwd(), 'cc.json');
  let usingExistingFile = false;

  if (fs.existsSync(ccJsonPath)) {
    const response = await prompts({
      type: 'confirm',
      name: 'useExisting',
      message: 'Found existing cc.json. Use this file?',
      initial: true
    });

    if (!response.useExisting) {
      // Generate new file
      const spinner = ora('Generating usage data with ccusage...').start();
      
      try {
        generateCcJson(ccJsonPath);
        spinner.succeed('Generated cc.json successfully');
      } catch (error) {
        spinner.fail('Failed to generate cc.json');
        console.error(chalk.red('Error:', error.message));
        console.log(chalk.yellow('\nMake sure you have used a supported AI coding tool (Claude Code, Codex, Gemini CLI, …) at least once.'));
        process.exit(1);
      }
    } else {
      usingExistingFile = true;
      console.log(chalk.green('✓ Using existing cc.json'));
    }
  } else {
    // Generate new file
    const spinner = ora('Generating usage data with ccusage...').start();
    
    try {
      generateCcJson(ccJsonPath);
      spinner.succeed('Generated cc.json successfully');
    } catch (error) {
      spinner.fail('Failed to generate cc.json');
      console.error(chalk.red('Error:', error.message));
      console.log(chalk.yellow('\nMake sure you have used a supported AI coding tool (Claude Code, Codex, Gemini CLI, …) at least once.'));
      process.exit(1);
    }
  }

  // Read and display summary
  try {
    const data = JSON.parse(fs.readFileSync(ccJsonPath, 'utf8'));
    console.log('\nSummary:');
    console.log(`  Total Cost: ${chalk.green('$' + Math.round(data.totals.totalCost))}`);
    console.log(`  Total Tokens: ${chalk.green(data.totals.totalTokens.toLocaleString())}`);
    console.log(`  Days Tracked: ${chalk.green(data.daily.length)}\n`);
  } catch (error) {
    console.error(chalk.red('Error reading cc.json:', error.message));
    process.exit(1);
  }

  // Confirm submission
  const confirmResponse = await prompts({
    type: 'confirm',
    name: 'submit',
    message: 'Submit to Viberank leaderboard?',
    initial: true
  });

  if (!confirmResponse.submit) {
    console.log(chalk.yellow('Submission cancelled.'));
    process.exit(0);
  }

  // Submit to Viberank with retry logic
  const submitSpinner = ora('Submitting to Viberank...').start();
  
  let attempt = 0;
  const maxAttempts = 3;
  const retryDelay = 5000; // 5 seconds
  
  while (attempt < maxAttempts) {
    attempt++;
    
    try {
      const ccData = JSON.parse(fs.readFileSync(ccJsonPath, 'utf8'));

      // Per-month corpus size, so the server can tell a transcript the runtime
      // rewrote from history the user deleted (#112). Best effort: a scan that
      // fails must never block a submission.
      try {
        const corpus = collectCorpus();
        if (corpus) ccData.drift = { corpus };
      } catch {
        // No corpus block; the server falls back to holding the high-water mark.
      }
      
      const response = await fetch('https://www.viberank.app/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // The header is a claim anyone can make; the token is proof. Sending
          // both keeps older servers working and lets a token-authenticated
          // submission come back verified.
          'X-GitHub-User': githubUser,
          'X-CLI-Version': CLI_VERSION,
          'X-Machine-Id': getMachineId(),
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
        },
        body: JSON.stringify(ccData)
      });

      // Check if response is ok before parsing
      if (!response.ok) {
        let errorMessage = `Server returned ${response.status} ${response.statusText}`;
        let requestId = null;
        let shouldRetry = false;
        
        // Try to parse error details from response
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
          if (errorData.requestId) {
            requestId = errorData.requestId;
            errorMessage += ` (Request ID: ${errorData.requestId})`;
          }
          if (errorData.retryAdvice) {
            shouldRetry = true;
          }
        } catch {
          // If JSON parsing fails, use the status text
        }
        
        // Handle 503 errors with retry
        if (response.status === 503 && attempt < maxAttempts) {
          submitSpinner.text = `Database temporarily unavailable. Retrying in ${retryDelay/1000} seconds... (attempt ${attempt}/${maxAttempts})`;
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue; // Retry the submission
        }
        
        submitSpinner.fail('Failed to submit to Viberank');
        console.error(chalk.red('Error:', errorMessage));
        
        // Provide helpful troubleshooting tips based on status code
        if (response.status === 400) {
          console.log(chalk.yellow('\nTroubleshooting tips:'));
          console.log(chalk.yellow('- Ensure you\'re using the latest version of ccusage'));
          console.log(chalk.yellow('- Try regenerating your cc.json file: npx ccusage@latest daily --json > cc.json'));
          console.log(chalk.yellow('- Check that your cc.json file is valid JSON'));
        } else if (response.status === 413) {
          console.log(chalk.yellow('\nYour usage data is too large. Consider submitting data for a shorter time period.'));
        } else if (response.status === 503) {
          console.log(chalk.yellow('\nThe database service is temporarily unavailable.'));
          console.log(chalk.yellow('Please wait a few minutes and try again.'));
          if (requestId) {
            console.log(chalk.gray(`Request ID for support: ${requestId}`));
          }
        } else if (response.status >= 500) {
          console.log(chalk.yellow('\nThe server is experiencing issues. Please try again in a few moments.'));
          console.log(chalk.yellow('If this persists, please report it at: https://github.com/sculptdotfun/viberank/issues'));
        }
        
        process.exit(1);
      }

      const result = await response.json();

      if (result.success) {
        submitSpinner.succeed('Successfully submitted to Viberank!');
        console.log(`\nView your profile at: ${chalk.green(result.profileUrl)}\n`);
        if (result.hint) {
          console.log(chalk.yellow(result.hint) + '\n');
        }
        if (result.notice) {
          console.log(chalk.gray(result.notice) + '\n');
        }
        break; // Success, exit the retry loop
      } else {
        submitSpinner.fail('Failed to submit to Viberank');
        console.error(chalk.red('Error:', result.error || 'Unknown error'));
        
        // Provide helpful context for common errors
        if (result.error && result.error.includes('cc.json')) {
          console.log(chalk.yellow('\nTry regenerating your cc.json file:'));
          console.log(chalk.yellow('  npx ccusage@latest daily --json > cc.json'));
        }
        
        process.exit(1);
      }
    } catch (error) {
      // On network errors, retry if we haven't exhausted attempts
      if ((error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') && attempt < maxAttempts) {
        submitSpinner.text = `Connection failed. Retrying in ${retryDelay/1000} seconds... (attempt ${attempt}/${maxAttempts})`;
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue; // Retry the submission
      }
      
      submitSpinner.fail('Failed to submit to Viberank');
      
      // Handle network errors specifically
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.error(chalk.red('Error: Unable to connect to Viberank server'));
        console.log(chalk.yellow('\nPlease check your internet connection and try again.'));
      } else if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
        console.error(chalk.red('Error: Invalid response from server'));
        console.log(chalk.yellow('\nThe server may be experiencing issues. Please try again later.'));
      } else {
        console.error(chalk.red('Error:', error.message));
      }
      
      process.exit(1);
    }
  }

  // Cleanup
  if (!usingExistingFile) {
    const cleanupResponse = await prompts({
      type: 'confirm',
      name: 'cleanup',
      message: 'Remove cc.json file?',
      initial: false
    });

    if (cleanupResponse.cleanup) {
      fs.unlinkSync(ccJsonPath);
      console.log(chalk.green('✓ Cleaned up cc.json'));
    }
  }

  console.log(chalk.green('\nDone! 🎉'));
}

const [command, arg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const run = async () => {
  switch (command) {
    case undefined:
    case 'submit':
      return main();
    case 'login':
      return login();
    case 'logout':
      return logout();
    case 'status':
      return showStatus();
    case 'autosubmit':
      return autosubmitCommand(arg);
    case 'help':
    case '--help':
    case '-h':
      return help();
    default:
      console.error(chalk.red(`Unknown command: ${command}`));
      help();
      process.exit(1);
  }
};

run().catch(error => {
  // A scheduled run logs to a file nobody watches, so stamp it — an
  // undated stack trace is close to useless when it turns up weeks later.
  const stamp = QUIET ? `[${new Date().toISOString()}] ` : '';
  console.error(chalk.red(`${stamp}Unexpected error: ${error.message}`));
  process.exit(1);
});