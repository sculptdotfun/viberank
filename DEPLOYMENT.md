# Employee Claude Code Usage Submission Setup

## Installation Instructions

### 1. Copy Files to System Locations

**Prerequisites:**
1. Install ccusage: `npm install -g ccusage` (https://github.com/ryoppippi/ccusage)

```bash
# Copy the script to system location
sudo cp submit-ccusage.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/submit-ccusage.sh

# Edit the plist file to set the correct email address
# Replace "user@company.com" with the actual employee email
nano com.company.ccusage.plist

# Copy the plist to user's LaunchAgents directory
cp com.company.ccusage.plist ~/Library/LaunchAgents/
```

### 2. Load the LaunchAgent

```bash
# Bootstrap the agent (modern approach)
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.company.ccusage.plist

# Enable the agent
launchctl enable gui/$(id -u)/com.company.ccusage
```

### 3. Verify Installation

```bash
# Check if the agent is loaded
launchctl list | grep com.company.ccusage

# Test the script manually
/usr/local/bin/submit-ccusage.sh user@company.com
```

## How It Works

- **Schedule**: Runs daily at 10:00 AM and on system startup
- **Duplicate Prevention**: Uses daily lock files (`/tmp/ccusage-submitted-YYYY-MM-DD`)
- **Email Parameter**: Takes email address as command line argument
- **Data Generation**: Runs `ccusage` command to generate fresh usage data in temp file
- **Logging**: Logs to `/tmp/ccusage-submit.log` and `/tmp/ccusage-submit-error.log`
- **Cleanup**: Automatically removes files older than 7 days and cleans up temp files after submission

## Troubleshooting

### Check Logs
```bash
tail -f /tmp/ccusage-submit.log
tail -f /tmp/ccusage-submit-error.log
```

### Manual Test
```bash
/usr/local/bin/submit-ccusage.sh user@company.com
```

### Uninstall
```bash
# Disable and remove the agent
launchctl disable gui/$(id -u)/com.company.ccusage
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.company.ccusage.plist
rm ~/Library/LaunchAgents/com.company.ccusage.plist
sudo rm /usr/local/bin/submit-ccusage.sh
```

## Email Configuration

The script requires an email address as a command line parameter. In the plist file, this is already configured in the `ProgramArguments` section. Make sure to replace `user@company.com` with the actual employee email address before copying the plist file.

## Requirements

- macOS with LaunchAgent support
- `curl` (pre-installed on macOS)
- `ccusage` installed globally (`npm install -g ccusage`)
- Access to Claude Code for the ccusage tool to read usage data