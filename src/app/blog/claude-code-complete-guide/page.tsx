import Link from "next/link";
import { ArrowLeft, Clock, Calendar, Terminal, Zap, Settings, Code, FileCode, Bot, Lightbulb, CheckCircle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Claude Code Complete Guide 2025: Installation, Commands & Best Practices",
  description: "Master Claude Code in 2025 with this comprehensive guide. Learn installation, essential commands, MCP servers, hooks, and advanced workflows for AI-powered terminal development.",
  keywords: ["claude code", "claude code tutorial", "claude code guide", "anthropic cli", "ai coding assistant", "terminal ai", "claude code commands", "mcp servers", "claude code installation"],
  openGraph: {
    title: "Claude Code Complete Guide 2025: Installation, Commands & Best Practices",
    description: "Master Claude Code with this comprehensive guide covering installation, commands, MCP servers, and advanced workflows.",
    url: "https://viberank.com/blog/claude-code-complete-guide",
    type: "article",
    publishedTime: "2025-10-12T00:00:00.000Z",
    authors: ["Viberank Team"],
    images: [
      {
        url: "/api/og?title=Claude%20Code%20Complete%20Guide%202025&description=Installation%2C%20Commands%20%26%20Best%20Practices",
        width: 1200,
        height: 630,
        alt: "Claude Code Complete Guide 2025",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Claude Code Complete Guide 2025: Installation, Commands & Best Practices",
    description: "Master Claude Code with this comprehensive guide covering installation, commands, and advanced workflows.",
    images: ["/api/og?title=Claude%20Code%20Complete%20Guide%202025&description=Installation%2C%20Commands%20%26%20Best%20Practices"],
  },
};

export default function ClaudeCodeCompleteGuide() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "Claude Code Complete Guide 2025: Installation, Commands & Best Practices",
    "description": "Master Claude Code in 2025 with this comprehensive guide covering installation, essential commands, MCP servers, and advanced workflows.",
    "image": "https://viberank.com/api/og?title=Claude%20Code%20Complete%20Guide%202025",
    "datePublished": "2025-10-12T00:00:00.000Z",
    "dateModified": "2025-10-12T00:00:00.000Z",
    "author": {
      "@type": "Organization",
      "name": "Viberank",
      "url": "https://viberank.com"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Viberank",
      "url": "https://viberank.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://viberank.com/icon.svg"
      }
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="prose prose-invert prose-stone max-w-none">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-stone-400 hover:text-orange-400 transition-colors mb-8 no-underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>

        <header className="mb-12">
          <h1 className="text-5xl font-bold text-stone-100 mb-4 leading-tight">
            Claude Code Complete Guide 2025: Installation, Commands & Best Practices
          </h1>

          <div className="flex items-center gap-6 text-sm text-stone-400 mb-8">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              October 12, 2025
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              12 min read
            </span>
          </div>

          <div className="p-6 bg-stone-900 border border-stone-800 rounded-lg">
            <p className="text-lg text-stone-300 m-0">
              <span className="font-semibold text-orange-400">Claude Code</span> is Anthropic's official CLI tool that brings
              AI-powered development directly into your terminal. This comprehensive guide covers everything from installation
              to advanced workflows, helping you become a power user in 2025.
            </p>
          </div>
        </header>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-stone-100 mb-6 flex items-center gap-3">
            <Terminal className="w-8 h-8 text-orange-400" />
            What is Claude Code?
          </h2>

          <p className="text-stone-300 text-lg leading-relaxed mb-6">
            Claude Code is an agentic coding assistant that lives in your terminal. Unlike IDE-based tools like Cursor
            or Copilot, Claude Code operates as a command-line interface that can read, write, and execute code across
            your entire project. It understands your codebase context and can perform complex multi-file operations
            autonomously.
          </p>

          <div className="grid md:grid-cols-3 gap-6 my-8">
            <div className="bg-stone-900 p-6 rounded-lg border border-stone-800 text-center">
              <div className="text-4xl font-bold text-orange-400 mb-2">100K+</div>
              <p className="text-stone-400 m-0">Context window tokens</p>
            </div>
            <div className="bg-stone-900 p-6 rounded-lg border border-stone-800 text-center">
              <div className="text-4xl font-bold text-orange-400 mb-2">CLI</div>
              <p className="text-stone-400 m-0">Terminal-native interface</p>
            </div>
            <div className="bg-stone-900 p-6 rounded-lg border border-stone-800 text-center">
              <div className="text-4xl font-bold text-orange-400 mb-2">MCP</div>
              <p className="text-stone-400 m-0">Model Context Protocol</p>
            </div>
          </div>

          <p className="text-stone-300 text-lg leading-relaxed">
            What sets Claude Code apart is its agentic nature—it doesn't just suggest code, it actively implements
            changes, runs tests, commits code, and even creates pull requests. Combined with MCP (Model Context Protocol),
            it can connect to external services like GitHub, databases, and APIs.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-stone-100 mb-6 flex items-center gap-3">
            <Zap className="w-8 h-8 text-orange-400" />
            Installation & Setup
          </h2>

          <p className="text-stone-300 text-lg leading-relaxed mb-6">
            Getting started with Claude Code takes less than a minute. Here's how to install and configure it:
          </p>

          <div className="bg-stone-900 rounded-lg p-6 border border-stone-800 my-8">
            <h3 className="text-xl font-semibold text-stone-100 mb-4">Step 1: Install via npm</h3>
            <div className="bg-stone-950 rounded-lg px-6 py-4 font-mono">
              <span className="text-stone-500">$</span>
              <span className="text-orange-400 ml-2">npm install -g @anthropic-ai/claude-code</span>
            </div>
            <p className="text-stone-400 text-sm mt-3 mb-0">
              Requires Node.js 18+ and npm. You can also use pnpm or yarn.
            </p>
          </div>

          <div className="bg-stone-900 rounded-lg p-6 border border-stone-800 my-8">
            <h3 className="text-xl font-semibold text-stone-100 mb-4">Step 2: Authenticate</h3>
            <div className="bg-stone-950 rounded-lg px-6 py-4 font-mono">
              <span className="text-stone-500">$</span>
              <span className="text-orange-400 ml-2">claude</span>
            </div>
            <p className="text-stone-400 text-sm mt-3 mb-0">
              On first run, Claude Code opens a browser window for OAuth authentication with your Anthropic account.
            </p>
          </div>

          <div className="bg-stone-900 rounded-lg p-6 border border-stone-800 my-8">
            <h3 className="text-xl font-semibold text-stone-100 mb-4">Step 3: Start Coding</h3>
            <div className="bg-stone-950 rounded-lg px-6 py-4 font-mono mb-3">
              <span className="text-stone-500">$</span>
              <span className="text-orange-400 ml-2">cd your-project</span>
            </div>
            <div className="bg-stone-950 rounded-lg px-6 py-4 font-mono">
              <span className="text-stone-500">$</span>
              <span className="text-orange-400 ml-2">claude</span>
            </div>
            <p className="text-stone-400 text-sm mt-3 mb-0">
              Navigate to any project directory and run claude to start an interactive session.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-stone-100 mb-6 flex items-center gap-3">
            <Code className="w-8 h-8 text-orange-400" />
            Essential Commands
          </h2>

          <p className="text-stone-300 text-lg leading-relaxed mb-6">
            Claude Code comes with powerful slash commands for common workflows. Here are the ones you'll use daily:
          </p>

          <div className="space-y-4 my-8">
            <div className="bg-stone-900 p-5 rounded-lg border border-stone-800">
              <div className="flex items-start gap-4">
                <code className="text-orange-400 font-mono bg-stone-950 px-3 py-1 rounded whitespace-nowrap">/help</code>
                <div>
                  <p className="text-stone-300 m-0">Shows all available commands and their descriptions. Essential for discovering features.</p>
                </div>
              </div>
            </div>

            <div className="bg-stone-900 p-5 rounded-lg border border-stone-800">
              <div className="flex items-start gap-4">
                <code className="text-orange-400 font-mono bg-stone-950 px-3 py-1 rounded whitespace-nowrap">/init</code>
                <div>
                  <p className="text-stone-300 m-0">Initializes Claude Code in your project, creating a CLAUDE.md file with project context and guidelines.</p>
                </div>
              </div>
            </div>

            <div className="bg-stone-900 p-5 rounded-lg border border-stone-800">
              <div className="flex items-start gap-4">
                <code className="text-orange-400 font-mono bg-stone-950 px-3 py-1 rounded whitespace-nowrap">/compact</code>
                <div>
                  <p className="text-stone-300 m-0">Compresses conversation history to save tokens while maintaining context. Use when context gets too long.</p>
                </div>
              </div>
            </div>

            <div className="bg-stone-900 p-5 rounded-lg border border-stone-800">
              <div className="flex items-start gap-4">
                <code className="text-orange-400 font-mono bg-stone-950 px-3 py-1 rounded whitespace-nowrap">/clear</code>
                <div>
                  <p className="text-stone-300 m-0">Clears the current conversation and starts fresh. Useful when switching between unrelated tasks.</p>
                </div>
              </div>
            </div>

            <div className="bg-stone-900 p-5 rounded-lg border border-stone-800">
              <div className="flex items-start gap-4">
                <code className="text-orange-400 font-mono bg-stone-950 px-3 py-1 rounded whitespace-nowrap">/cost</code>
                <div>
                  <p className="text-stone-300 m-0">Shows token usage and cost for the current session. Great for budget tracking.</p>
                </div>
              </div>
            </div>

            <div className="bg-stone-900 p-5 rounded-lg border border-stone-800">
              <div className="flex items-start gap-4">
                <code className="text-orange-400 font-mono bg-stone-950 px-3 py-1 rounded whitespace-nowrap">/doctor</code>
                <div>
                  <p className="text-stone-300 m-0">Runs diagnostics to check your Claude Code installation and configuration.</p>
                </div>
              </div>
            </div>

            <div className="bg-stone-900 p-5 rounded-lg border border-stone-800">
              <div className="flex items-start gap-4">
                <code className="text-orange-400 font-mono bg-stone-950 px-3 py-1 rounded whitespace-nowrap">/memory</code>
                <div>
                  <p className="text-stone-300 m-0">Manage persistent memory that persists across sessions. Store preferences, patterns, and context.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-stone-100 mb-6 flex items-center gap-3">
            <Settings className="w-8 h-8 text-orange-400" />
            MCP Servers: Extending Claude Code
          </h2>

          <p className="text-stone-300 text-lg leading-relaxed mb-6">
            The Model Context Protocol (MCP) is what makes Claude Code truly powerful. MCP servers let Claude
            connect to external tools and services—think of them as plugins that expand what Claude can do.
          </p>

          <div className="bg-gradient-to-r from-orange-900/20 to-stone-900/20 p-8 rounded-lg border border-orange-400/30 my-8">
            <h3 className="text-2xl font-semibold text-orange-400 mb-4">Popular MCP Servers</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-1" />
                <div>
                  <strong className="text-stone-200">GitHub MCP</strong>
                  <p className="text-stone-400 m-0">Create issues, PRs, manage repos, and review code directly through Claude.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-1" />
                <div>
                  <strong className="text-stone-200">PostgreSQL MCP</strong>
                  <p className="text-stone-400 m-0">Query databases, run migrations, and analyze data without leaving the terminal.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-1" />
                <div>
                  <strong className="text-stone-200">Filesystem MCP</strong>
                  <p className="text-stone-400 m-0">Enhanced file operations with watch capabilities and batch processing.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-1" />
                <div>
                  <strong className="text-stone-200">Slack/Discord MCP</strong>
                  <p className="text-stone-400 m-0">Send messages, read channels, and integrate with team communication.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-stone-900 rounded-lg p-6 border border-stone-800 my-8">
            <h3 className="text-xl font-semibold text-stone-100 mb-4">Configure MCP in settings.json</h3>
            <pre className="bg-stone-950 rounded-lg p-4 overflow-x-auto text-sm">
              <code className="text-stone-300">{`{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "your-token-here"
      }
    }
  }
}`}</code>
            </pre>
            <p className="text-stone-400 text-sm mt-3 mb-0">
              Add this to ~/.claude/settings.json or run /mcp to configure interactively.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-stone-100 mb-6 flex items-center gap-3">
            <Bot className="w-8 h-8 text-orange-400" />
            Hooks: Customize Claude's Behavior
          </h2>

          <p className="text-stone-300 text-lg leading-relaxed mb-6">
            Hooks let you run custom scripts before or after Claude performs actions. They're powerful for
            enforcing coding standards, running tests automatically, or integrating with your workflow.
          </p>

          <div className="grid md:grid-cols-2 gap-6 my-8">
            <div className="bg-stone-900 p-6 rounded-lg border border-stone-800">
              <h3 className="text-orange-400 font-semibold text-lg mb-3">Pre-commit Hook</h3>
              <p className="text-stone-300 mb-4">
                Run linting and formatting before Claude commits code. Catches issues before they hit your repo.
              </p>
              <pre className="bg-stone-950 rounded-lg p-3 text-xs overflow-x-auto">
                <code className="text-stone-400">{`{
  "hooks": {
    "pre-commit": "npm run lint && npm run format"
  }
}`}</code>
              </pre>
            </div>

            <div className="bg-stone-900 p-6 rounded-lg border border-stone-800">
              <h3 className="text-orange-400 font-semibold text-lg mb-3">Post-edit Hook</h3>
              <p className="text-stone-300 mb-4">
                Automatically run tests after Claude modifies files. Ensures changes don't break existing functionality.
              </p>
              <pre className="bg-stone-950 rounded-lg p-3 text-xs overflow-x-auto">
                <code className="text-stone-400">{`{
  "hooks": {
    "post-edit": "npm test -- --related"
  }
}`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-stone-100 mb-6 flex items-center gap-3">
            <FileCode className="w-8 h-8 text-orange-400" />
            CLAUDE.md: Project Context File
          </h2>

          <p className="text-stone-300 text-lg leading-relaxed mb-6">
            The CLAUDE.md file is your project's instruction manual for Claude. It contains context, conventions,
            and guidelines that help Claude understand your codebase and write better code.
          </p>

          <div className="bg-stone-900 rounded-lg p-6 border border-stone-800 my-8">
            <h3 className="text-xl font-semibold text-stone-100 mb-4">Example CLAUDE.md</h3>
            <pre className="bg-stone-950 rounded-lg p-4 overflow-x-auto text-sm">
              <code className="text-stone-300">{`# Project: My SaaS App

## Tech Stack
- Next.js 14 with App Router
- TypeScript (strict mode)
- Tailwind CSS
- Prisma + PostgreSQL

## Conventions
- Use kebab-case for file names
- Components go in src/components/
- API routes in src/app/api/
- Always use async/await, never .then()

## Testing
- Jest for unit tests
- Playwright for E2E
- Run \`npm test\` before committing

## Important Notes
- Never commit .env files
- Always add loading states
- Use server components by default`}</code>
            </pre>
          </div>

          <p className="text-stone-300 text-lg leading-relaxed">
            Run <code className="bg-stone-800 px-2 py-1 rounded text-orange-400">/init</code> to generate a
            CLAUDE.md file automatically, or create one manually with your specific guidelines.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-stone-100 mb-6 flex items-center gap-3">
            <Lightbulb className="w-8 h-8 text-orange-400" />
            Pro Tips & Best Practices
          </h2>

          <div className="space-y-6 my-8">
            <div className="bg-stone-900 p-6 rounded-lg border border-stone-800">
              <h3 className="text-orange-400 font-semibold text-lg mb-2">1. Use Headless Mode for Automation</h3>
              <p className="text-stone-300 m-0">
                Run <code className="bg-stone-800 px-2 py-1 rounded text-orange-400">claude -p "your prompt"</code> for
                one-off commands in scripts and CI/CD pipelines. Great for automated code reviews and refactoring.
              </p>
            </div>

            <div className="bg-stone-900 p-6 rounded-lg border border-stone-800">
              <h3 className="text-orange-400 font-semibold text-lg mb-2">2. Leverage Context Files</h3>
              <p className="text-stone-300 m-0">
                Use <code className="bg-stone-800 px-2 py-1 rounded text-orange-400">@filename</code> to include
                specific files in your prompt. Claude automatically reads them and uses them as context.
              </p>
            </div>

            <div className="bg-stone-900 p-6 rounded-lg border border-stone-800">
              <h3 className="text-orange-400 font-semibold text-lg mb-2">3. Track Your Usage</h3>
              <p className="text-stone-300 m-0">
                Claude Code saves usage data in <code className="bg-stone-800 px-2 py-1 rounded text-orange-400">~/.claude/cc.json</code>.
                Upload it to <a href="https://viberank.com" className="text-orange-400 hover:underline">Viberank</a> to
                track your stats and see how you compare to other developers.
              </p>
            </div>

            <div className="bg-stone-900 p-6 rounded-lg border border-stone-800">
              <h3 className="text-orange-400 font-semibold text-lg mb-2">4. Use /compact Regularly</h3>
              <p className="text-stone-300 m-0">
                Long conversations eat tokens fast. Use <code className="bg-stone-800 px-2 py-1 rounded text-orange-400">/compact</code>
                periodically to compress history while keeping important context.
              </p>
            </div>

            <div className="bg-stone-900 p-6 rounded-lg border border-stone-800">
              <h3 className="text-orange-400 font-semibold text-lg mb-2">5. Combine with Conductor</h3>
              <p className="text-stone-300 m-0">
                For parallel development, use Conductor to run multiple Claude Code instances in isolated git worktrees.
                Build features simultaneously without conflicts.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-stone-100 mb-6">Track Your Claude Code Journey</h2>

          <p className="text-stone-300 text-lg leading-relaxed mb-6">
            Curious how your Claude Code usage compares to other developers? Viberank analyzes your
            <code className="bg-stone-800 px-2 py-1 rounded text-orange-400 mx-1">cc.json</code>
            file to show detailed analytics about your AI-assisted development workflow.
          </p>

          <div className="bg-stone-900 border border-stone-800 rounded-lg p-8 text-center">
            <p className="text-stone-400 mb-4">Upload your stats and join the leaderboard</p>
            <div className="bg-stone-950 rounded-lg px-6 py-4 inline-flex items-center gap-3 font-mono">
              <span className="text-stone-500">$</span>
              <span className="text-orange-400 text-lg">npx viberank</span>
            </div>
            <p className="text-stone-500 text-sm mt-4">
              See your token usage, session patterns, and how you stack up against the community
            </p>
          </div>
        </section>

        <footer className="mt-16 pt-8 border-t border-stone-800">
          <h3 className="text-xl font-semibold text-stone-100 mb-4">Start Building Today</h3>
          <p className="text-stone-300 mb-6">
            Claude Code is transforming how developers work. Whether you're debugging complex issues,
            refactoring legacy code, or building new features, having an AI agent in your terminal
            accelerates everything. Install it, configure your CLAUDE.md, and start experiencing
            the future of development.
          </p>
          <p className="text-stone-500 text-sm">
            Questions or tips? Join the community discussion and share your Claude Code workflows.
          </p>
        </footer>
      </article>
    </>
  );
}
