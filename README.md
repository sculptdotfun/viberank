# viberank

A community-driven leaderboard for Claude Code (formerly Claude Engineer) usage. Track your AI-assisted coding progress and compete with developers worldwide.

![viberank](https://img.shields.io/badge/viberank-Track%20Your%20Claude%20Code%20Usage-orange)
![License](https://img.shields.io/badge/license-MIT-blue)
![Next.js](https://img.shields.io/badge/Next.js-15.3.4-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)

## Overview

viberank is an open-source leaderboard where developers can upload their Claude Code usage statistics and see how they rank globally. Built with Next.js, TypeScript, and Convex, it provides a minimal, sophisticated interface inspired by Claude's design principles.

### Features

- 🏆 **Global Leaderboard** - See how you rank among Claude Code users worldwide
- 📊 **Profile Pages** - Beautiful profiles at `viberank.app/profile/{username}` with usage charts
- 🚀 **Multiple Submission Methods** - CLI tool, curl command, or web upload
- 📈 **Usage Analytics** - Track your token usage and costs over time with interactive charts
- 🔍 **Advanced Filtering** - View rankings by custom date ranges (7d, 30d, all time)
- 🔐 **GitHub Authentication** - Secure sign-in with GitHub OAuth
- 🛡️ **Data Validation** - Automatic validation to ensure fair competition
- 🔄 **Smart Merging** - Submit multiple times without data loss
- 📱 **Responsive Design** - Beautiful on desktop and mobile
- 🎯 **Share Cards** - Share your achievements on social media

## Getting Started

### Submitting Your Usage Data

#### Option 1: Using the viberank CLI (Recommended)

The easiest way to submit your usage data:

```bash
npx viberank
```

This will:
- Automatically detect your GitHub username from git config
- Generate your usage data using ccusage
- Submit it to the leaderboard
- Give you a direct link to your profile

#### Option 2: MCP Server (for Claude Desktop)

If you're using Claude Desktop or another MCP-compatible client, you can use our MCP server for seamless integration:

```json
// Add to ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "viberank": {
      "command": "npx",
      "args": ["@viberank/mcp-server"]
    }
  }
}
```

Then just ask Claude: "Submit my usage stats to Viberank"

#### Option 3: Using curl

If you prefer to use curl directly:

```bash
# Generate usage data
npx ccusage@latest --json > cc.json

# Get your GitHub username
GITHUB_USER=$(git config user.name)

# Submit to viberank
curl -X POST https://viberank.app/api/submit \
  -H "Content-Type: application/json" \
  -H "X-GitHub-User: $GITHUB_USER" \
  -d @cc.json
```

#### Option 4: Web Upload

1. Visit [viberank.app](https://viberank.app)
2. Sign in with GitHub
3. Click "Submit Your Stats"
4. Upload your `cc.json` file

### Profile Pages

Every user gets a beautiful profile page at `viberank.app/profile/{github-username}` featuring:

- 📊 **Usage Chart** - Interactive area chart showing daily costs over time
- 📈 **Statistics** - Total cost, tokens, days active, and averages
- 📝 **Submission History** - Detailed breakdown of all submissions
- 🏷️ **Model Usage** - See which Claude models you use most
- 🔗 **GitHub Integration** - Links to your GitHub profile

### Data Validation & Fair Play

To maintain leaderboard integrity, viberank validates all submissions:

#### Automatic Validation
- ✅ **Token math verification** - Ensures input + output + cache tokens = total
- ✅ **Negative value check** - Rejects any negative values
- ✅ **Date validation** - No future dates allowed
- ✅ **Realistic limits** - Flags unusually high usage for review

#### Validation Limits
- Maximum daily cost: $5,000
- Maximum daily tokens: 50 million
- Cost per token ratio: 0.000001 to 0.1

Submissions exceeding these limits are flagged for review and hidden from the main leaderboard to ensure fair competition.

### Multiple Submissions

viberank intelligently handles multiple submissions:
- **Overlapping dates**: Merges data at the daily level, preserving all your usage history
- **Non-overlapping dates**: Adds to your profile without affecting existing data
- **Updates**: Submit new data anytime - it will merge with existing data without loss

## Development

### Prerequisites

- Node.js 18+ and pnpm
- A [Convex](https://convex.dev) account
- GitHub OAuth App credentials

### Installation

1. Clone the repository:
```bash
git clone https://github.com/sculptdotfun/viberank.git
cd viberank
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your `.env.local`:
```env
# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# NextAuth
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-secret-here # Generate with: openssl rand -base64 32

# GitHub OAuth
GITHUB_ID=your-github-oauth-app-id
GITHUB_SECRET=your-github-oauth-app-secret
```

5. Set up Convex:
```bash
npx convex dev
```

6. Run the development server:
```bash
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001) to see the app.

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Database**: Convex (real-time, serverless)
- **Authentication**: NextAuth.js with GitHub OAuth
- **Charts**: Recharts for data visualization
- **Animations**: Framer Motion
- **Styling**: Tailwind CSS with custom Claude-inspired theme
- **CLI Tool**: Node.js with prompts and chalk
- **Development**: Turbopack, ESLint, Prettier

## API Documentation

### POST /api/submit

Submit usage data programmatically:

```bash
curl -X POST https://viberank.app/api/submit \
  -H "Content-Type: application/json" \
  -H "X-GitHub-User: YOUR_GITHUB_USERNAME" \
  -d @cc.json
```

Response:
```json
{
  "success": true,
  "submissionId": "...",
  "message": "Successfully submitted data for username",
  "profileUrl": "https://viberank.app/profile/username"
}
```

## Contributing

We love contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Style

- We use ESLint and Prettier for code formatting
- Run `pnpm lint` to check for linting errors
- Run `pnpm format` to format code

## Deployment

### Deploy on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sculptdotfun/viberank)

### Environment Variables for Production

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXTAUTH_URL` (your production URL)
- `NEXTAUTH_SECRET`
- `GITHUB_ID`
- `GITHUB_SECRET`

## Security

- All authentication is handled through GitHub OAuth
- Usage data is validated to ensure it comes from the official ccusage tool
- No sensitive data is stored - only aggregated usage statistics
- Suspicious submissions are automatically flagged for review

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Claude](https://claude.ai) by Anthropic for making AI-assisted coding amazing
- [ccusage](https://github.com/ryoppippi/ccusage) for the usage tracking tool
- The Claude Code community for inspiration

## Links

- [Website](https://viberank.app)
- [GitHub](https://github.com/sculptdotfun/viberank)
- [Report Issues](https://github.com/sculptdotfun/viberank/issues)
- [NPM Package](https://www.npmjs.com/package/viberank)

---

Made with 🧡 by the viberank community