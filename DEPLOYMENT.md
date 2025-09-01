# Employee Claude Code Usage Submission Setup

## Installation Instructions

### 1. Copy Files to System Locations

```bash
# Copy the script to system location
sudo cp submit-ccusage.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/submit-ccusage.sh

# Copy the plist to user's LaunchAgents directory
cp com.company.ccusage.plist ~/Library/LaunchAgents/
```

### 2. Load the LaunchAgent

```bash
# Load the agent (will start automatically on login)
launchctl load ~/Library/LaunchAgents/com.company.ccusage.plist

# Enable the agent
launchctl enable gui/$(id -u)/com.company.ccusage
```

### 3. Verify Installation

```bash
# Check if the agent is loaded
launchctl list | grep com.company.ccusage

# Test the script manually
/usr/local/bin/submit-ccusage.sh
```

## How It Works

- **Schedule**: Runs daily at 10:00 AM and on system startup
- **Duplicate Prevention**: Uses daily lock files (`/tmp/ccusage-submitted-YYYY-MM-DD`)
- **Email Detection**: Prompts for manual input or uses `CC_USER_EMAIL` environment variable
- **Data Source**: Reads from `~/.config/claude-code/cc.json`
- **Logging**: Logs to `/tmp/ccusage-submit.log` and `/tmp/ccusage-submit-error.log`
- **Cleanup**: Automatically removes files older than 7 days
- **Archiving**: Saves submitted data to `~/.config/claude-code/submitted/`

## Troubleshooting

### Check Logs
```bash
tail -f /tmp/ccusage-submit.log
tail -f /tmp/ccusage-submit-error.log
```

### Manual Test
```bash
/usr/local/bin/submit-ccusage.sh
```

### Uninstall
```bash
launchctl unload ~/Library/LaunchAgents/com.company.ccusage.plist
rm ~/Library/LaunchAgents/com.company.ccusage.plist
sudo rm /usr/local/bin/submit-ccusage.sh
```

## Email Configuration

The script will prompt for email input on first run. To avoid prompts in automated environments, set the environment variable:

```bash
# Option 1: Set environment variable globally
echo 'export CC_USER_EMAIL="user@company.com"' >> ~/.bashrc
echo 'export CC_USER_EMAIL="user@company.com"' >> ~/.zshrc

# Option 2: Set in the plist file (add to EnvironmentVariables)
```

To set the email in the plist, add this to the plist file:
```xml
<key>EnvironmentVariables</key>
<dict>
    <key>CC_USER_EMAIL</key>
    <string>user@company.com</string>
</dict>
```

## Requirements

- macOS with LaunchAgent support
- `curl` (pre-installed on macOS)
- User email configured via `CC_USER_EMAIL` environment variable or manual input
- Claude Code installed and generating `cc.json` files