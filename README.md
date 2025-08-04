# viberank

A community-driven leaderboard for Claude Code (formerly Claude Engineer) usage. Track your AI-assisted coding progress and compete with developers worldwide.

![viberank](https://img.shields.io/badge/viberank-Track%20Your%20Claude%20Code%20Usage-orange)
![License](https://img.shields.io/badge/license-MIT-blue)
![Next.js](https://img.shields.io/badge/Next.js-15.3.4-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)

## Overview

viberank is an open-source leaderboard where developers can upload their Claude Code usage statistics and see how they rank globally. Built with Next.js, TypeScript, and Convex, it provides a minimal, sophisticated interface inspired by modern design principles.

### Features

- 🏆 **Global Leaderboard** - See how you rank among Claude Code users worldwide
- 📊 **Usage Analytics** - Track your token usage and costs over time
- 🔍 **Time Filters** - View rankings for different time periods
- 🔐 **GitHub Authentication** - Secure sign-in with GitHub OAuth
- 📱 **Responsive Design** - Beautiful on desktop and mobile
- 🎯 **Share Cards** - Share your achievements on social media

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- A [Convex](https://convex.dev) account
- GitHub OAuth App credentials
- [ccusage](https://github.com/ryoppippi/ccusage) CLI tool for generating usage data

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/viberank.git
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

### Submitting Usage Data

#### Option 1: Using the viberank CLI (Recommended)

The easiest way to submit your usage data:

```bash
npx viberank
```

This will automatically generate your usage data and submit it to the leaderboard.

#### Option 2: Using curl

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

#### Option 3: Manual Upload

1. Generate your usage file:
```bash
npx ccusage@latest --json > cc.json
```

2. Visit [viberank.app](https://viberank.app) and sign in with GitHub
3. Upload the `cc.json` file using the web interface

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Database**: Convex (real-time, serverless)
- **Authentication**: NextAuth.js with GitHub OAuth
- **Animations**: Framer Motion
- **Styling**: Tailwind CSS with custom Claude-inspired theme
- **Charts**: Recharts
- **Development**: Turbopack, ESLint, Prettier

## Project Structure

```
viberank/
├── src/
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   ├── lib/             # Utilities and helpers
│   └── types/           # TypeScript type definitions
├── convex/              # Convex backend functions
├── public/              # Static assets
└── ...config files
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

The easiest way to deploy viberank is using Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/viberank)

### Environment Variables for Production

Make sure to set all environment variables in your deployment platform:

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXTAUTH_URL` (your production URL)
- `NEXTAUTH_SECRET`
- `GITHUB_ID`
- `GITHUB_SECRET`

## Security

- All authentication is handled through GitHub OAuth
- Usage data is validated to ensure it comes from the official ccusage tool
- No sensitive data is stored - only aggregated usage statistics

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Claude](https://claude.ai) by Anthropic for making AI-assisted coding amazing
- [ccusage](https://github.com/ryoppippi/ccusage) for the usage tracking tool
- The Claude Code community for inspiration

## Links

- [Website](https://viberank.app)
- [GitHub](https://github.com/yourusername/viberank)
- [Report Issues](https://github.com/yourusername/viberank/issues)

---

Made with 🧡 by the viberank community