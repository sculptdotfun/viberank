# Viberank MCP Server

Submit your Claude Code usage stats to [Viberank](https://viberank.app) directly from your MCP-compatible AI assistant!

## Features

- 🚀 **Automatic Usage Tracking** - Fetch your Claude Code usage stats via ccusage
- 📊 **Direct Submission** - Submit to Viberank leaderboard without leaving your workflow
- 🔄 **Smart Caching** - Caches usage data for 5 minutes to reduce overhead
- 👤 **Profile Management** - View profiles and leaderboard data
- 🔐 **GitHub Integration** - Automatically detects your GitHub username from git config

## Installation

### Option 1: NPM Global Install
```bash
npm install -g @viberank/mcp-server
```

### Option 2: Local Development
```bash
git clone https://github.com/sculptdotfun/viberank.git
cd viberank/packages/viberank-mcp-server
npm install
npm run build
```

## Configuration

### Claude Desktop (macOS)

Add to your Claude Desktop configuration at `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "viberank": {
      "command": "npx",
      "args": ["@viberank/mcp-server"]
    }
  }
}
```

### Claude Desktop (Windows)

Add to your Claude Desktop configuration at `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "viberank": {
      "command": "npx",
      "args": ["@viberank/mcp-server"]
    }
  }
}
```

### Other MCP-Compatible Clients

For other MCP clients, use the following command:
```bash
npx @viberank/mcp-server
```

Or if installed locally:
```bash
node /path/to/viberank-mcp-server/dist/index.js
```

## Available Tools

### 1. `get_usage`
Fetches your current Claude Code usage statistics.

**Parameters:**
- `force_refresh` (boolean, optional): Force refresh the data, bypassing cache

**Example:**
```
Use the get_usage tool to check my Claude usage stats
```

### 2. `submit_to_viberank`
Submits your usage statistics to the Viberank leaderboard.

**Parameters:**
- `github_username` (string, optional): Your GitHub username
- `auto_detect_username` (boolean, optional): Auto-detect from git config (default: true)

**Example:**
```
Submit my Claude usage to Viberank
```

### 3. `get_profile`
Get the Viberank profile URL for a specific user.

**Parameters:**
- `username` (string, required): GitHub username to look up

**Example:**
```
Show me the Viberank profile for octocat
```

### 4. `get_leaderboard`
Get information about the Viberank leaderboard.

**Parameters:**
- `limit` (number, optional): Number of top users to show (default: 10)

**Example:**
```
Show me the top 20 users on Viberank
```

## Usage Examples

### Basic Workflow

1. **Check your usage:**
   ```
   Hey Claude, use the Viberank MCP server to check my current Claude usage
   ```

2. **Submit to leaderboard:**
   ```
   Now submit my usage stats to Viberank
   ```

3. **View your profile:**
   ```
   Show me my Viberank profile
   ```

### Advanced Usage

- **Force refresh data:**
  ```
  Get my Claude usage with a fresh fetch (don't use cache)
  ```

- **Submit with specific username:**
  ```
  Submit my stats to Viberank using the username "myGitHubUser"
  ```

## How It Works

1. **Usage Collection**: The MCP server runs `ccusage` to collect your Claude Code usage statistics
2. **Data Processing**: Statistics are parsed and validated
3. **Submission**: Data is sent to the Viberank API with your GitHub username
4. **Verification**: CLI submissions are marked as unverified (use OAuth on the website for verified submissions)

## Troubleshooting

### "Failed to get usage data"
- Make sure you've used Claude Code at least once
- Ensure `ccusage` is accessible (it's automatically installed via npx)

### "GitHub username is required"
- Set your git config: `git config --global user.name "YourGitHubUsername"`
- Or provide the username explicitly in the tool call

### Cache Issues
- Use `force_refresh: true` to bypass the 5-minute cache
- The cache helps reduce overhead when checking stats frequently

## Security & Privacy

- Your usage data is only sent to Viberank when you explicitly use the `submit_to_viberank` tool
- No data is collected or transmitted without your action
- GitHub usernames from git config are only read locally
- All submissions via MCP are marked as "unverified" (use OAuth on the website for verified submissions)

## Development

### Building from Source
```bash
npm install
npm run build
```

### Running in Development
```bash
npm run dev
```

### Testing Locally
```bash
# Start the server
node dist/index.js

# In another terminal, send test commands via MCP protocol
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT - See LICENSE file for details

## Links

- [Viberank Website](https://viberank.app)
- [GitHub Repository](https://github.com/sculptdotfun/viberank)
- [Report Issues](https://github.com/sculptdotfun/viberank/issues)
- [MCP Protocol Docs](https://modelcontextprotocol.io)