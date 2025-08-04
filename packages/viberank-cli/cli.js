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

async function main() {
  console.log(chalk.yellow.bold('\n🚀 Viberank Submission Tool\n'));

  // Get GitHub username from git config
  let githubUser;
  try {
    githubUser = execSync('git config user.name', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.log(chalk.yellow('Warning: Could not get GitHub username from git config'));
  }

  if (!githubUser) {
    const response = await prompts({
      type: 'text',
      name: 'username',
      message: 'Please enter your GitHub username:',
      validate: value => value.length > 0 || 'Username is required'
    });
    
    if (!response.username) {
      console.log(chalk.red('Username is required. Exiting.'));
      process.exit(1);
    }
    
    githubUser = response.username;
  }

  console.log(`GitHub username: ${chalk.green(githubUser)}\n`);

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
    
    const response = await fetch('https://viberank.app/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-User': githubUser
      },
      body: JSON.stringify(ccData)
    });

    const result = await response.json();

    if (result.success) {
      submitSpinner.succeed('Successfully submitted to Viberank!');
      console.log(`\nView your profile at: ${chalk.green(result.profileUrl)}\n`);
    } else {
      submitSpinner.fail('Failed to submit to Viberank');
      console.error(chalk.red('Error:', result.error || 'Unknown error'));
      process.exit(1);
    }
  } catch (error) {
    submitSpinner.fail('Failed to submit to Viberank');
    console.error(chalk.red('Error:', error.message));
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