#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json to get version
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const CLI_VERSION = packageJson.version;

async function main() {
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
    initial: githubUser || '',
    validate: value => value.length > 0 || 'Username is required'
  });
  
  if (!response.username) {
    console.log(chalk.red('Username is required. Exiting.'));
    process.exit(1);
  }
  
  githubUser = response.username;

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
        execSync('npx ccusage@latest --json > cc.json', { 
          encoding: 'utf8',
          stdio: 'pipe' 
        });
        spinner.succeed('Generated cc.json successfully');
      } catch (error) {
        spinner.fail('Failed to generate cc.json');
        console.error(chalk.red('Error:', error.message));
        console.log(chalk.yellow('\nMake sure you have run Claude Code at least once.'));
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
      execSync('npx ccusage@latest --json > cc.json', { 
        encoding: 'utf8',
        stdio: 'pipe' 
      });
      spinner.succeed('Generated cc.json successfully');
    } catch (error) {
      spinner.fail('Failed to generate cc.json');
      console.error(chalk.red('Error:', error.message));
      console.log(chalk.yellow('\nMake sure you have run Claude Code at least once.'));
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

  // Submit to Viberank
  const submitSpinner = ora('Submitting to Viberank...').start();
  
  try {
    const ccData = JSON.parse(fs.readFileSync(ccJsonPath, 'utf8'));
    
    const response = await fetch('https://www.viberank.app/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-User': githubUser,
        'X-CLI-Version': CLI_VERSION
      },
      body: JSON.stringify(ccData)
    });

    // Check if response is ok before parsing
    if (!response.ok) {
      let errorMessage = `Server returned ${response.status} ${response.statusText}`;
      
      // Try to parse error details from response
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
        if (errorData.requestId) {
          errorMessage += ` (Request ID: ${errorData.requestId})`;
        }
      } catch {
        // If JSON parsing fails, use the status text
      }
      
      submitSpinner.fail('Failed to submit to Viberank');
      console.error(chalk.red('Error:', errorMessage));
      
      // Provide helpful troubleshooting tips based on status code
      if (response.status === 400) {
        console.log(chalk.yellow('\nTroubleshooting tips:'));
        console.log(chalk.yellow('- Ensure you\'re using the latest version of ccusage'));
        console.log(chalk.yellow('- Try regenerating your cc.json file: npx ccusage@latest --json > cc.json'));
        console.log(chalk.yellow('- Check that your cc.json file is valid JSON'));
      } else if (response.status === 413) {
        console.log(chalk.yellow('\nYour usage data is too large. Consider submitting data for a shorter time period.'));
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
    } else {
      submitSpinner.fail('Failed to submit to Viberank');
      console.error(chalk.red('Error:', result.error || 'Unknown error'));
      
      // Provide helpful context for common errors
      if (result.error && result.error.includes('cc.json')) {
        console.log(chalk.yellow('\nTry regenerating your cc.json file:'));
        console.log(chalk.yellow('  npx ccusage@latest --json > cc.json'));
      }
      
      process.exit(1);
    }
  } catch (error) {
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

main().catch(error => {
  console.error(chalk.red('Unexpected error:', error.message));
  process.exit(1);
});