import Link from "next/link";
import { ArrowLeft, Clock, Calendar, Plug, Database, Github, MessageSquare, FileText, Server, Settings, Lightbulb, CheckCircle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MCP Servers Guide: Connect Claude Code to GitHub, Databases & More",
  description: "Learn how to extend Claude Code with MCP (Model Context Protocol) servers. Connect to GitHub, PostgreSQL, Slack, and build custom integrations for AI-powered development.",
  keywords: ["mcp servers", "model context protocol", "claude code mcp", "claude code github", "claude code database", "anthropic mcp", "ai integrations", "claude code plugins"],
  openGraph: {
    title: "MCP Servers Guide: Connect Claude Code to GitHub, Databases & More",
    description: "Extend Claude Code with MCP servers. Connect to GitHub, databases, Slack, and more.",
    url: "https://viberank.com/blog/mcp-servers-guide",
    type: "article",
    publishedTime: "2025-12-15T00:00:00.000Z",
    authors: ["Viberank Team"],
    images: [
      {
        url: "/api/og?title=MCP%20Servers%20Guide&description=Connect%20Claude%20Code%20to%20Everything",
        width: 1200,
        height: 630,
        alt: "MCP Servers Guide for Claude Code",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MCP Servers Guide: Connect Claude Code to GitHub, Databases & More",
    description: "Learn how to extend Claude Code with MCP servers for powerful integrations.",
    images: ["/api/og?title=MCP%20Servers%20Guide&description=Connect%20Claude%20Code%20to%20Everything"],
  },
};

export default function MCPServersGuide() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "MCP Servers Guide: Connect Claude Code to GitHub, Databases & More",
    "description": "Learn how to extend Claude Code with MCP servers for powerful AI integrations.",
    "image": "https://viberank.com/api/og?title=MCP%20Servers%20Guide",
    "datePublished": "2025-12-15T00:00:00.000Z",
    "dateModified": "2025-12-15T00:00:00.000Z",
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

      <article className="prose prose-invert prose-neutral max-w-none">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-muted hover:text-accent transition-colors mb-8 no-underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>

        <header className="mb-12">
          <h1 className="text-5xl font-bold text-foreground mb-4 leading-tight">
            MCP Servers Guide: Connect Claude Code to GitHub, Databases & More
          </h1>

          <div className="flex items-center gap-6 text-sm text-muted mb-8">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              December 15, 2025
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              9 min read
            </span>
          </div>

          <div className="p-6 bg-card border border-border rounded-lg">
            <p className="text-lg text-foreground m-0">
              <span className="font-semibold text-accent">MCP (Model Context Protocol)</span> is what transforms
              Claude Code from a coding assistant into a powerful automation platform. This guide shows you how to
              connect Claude to GitHub, databases, messaging apps, and build your own custom integrations.
            </p>
          </div>
        </header>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Plug className="w-8 h-8 text-accent" />
            What is MCP?
          </h2>

          <p className="text-foreground text-lg leading-relaxed mb-6">
            Model Context Protocol (MCP) is an open standard created by Anthropic that allows AI models to
            interact with external tools and data sources. Think of MCP servers as plugins that give Claude
            new capabilities—reading from databases, creating GitHub issues, sending Slack messages, and more.
          </p>

          <div className="bg-gradient-to-r from-orange-900/20 to-stone-900/20 p-8 rounded-lg border border-accent/30 my-8">
            <h3 className="text-2xl font-semibold text-accent mb-4">How MCP Works</h3>
            <div className="space-y-4 text-foreground">
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold">1.</span>
                <div><strong>MCP Server</strong> — A small program that exposes tools (functions) and resources (data) to Claude.</div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold">2.</span>
                <div><strong>Claude Code</strong> — Discovers available tools from MCP servers and can invoke them during conversations.</div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold">3.</span>
                <div><strong>External Service</strong> — The actual API or database the MCP server connects to (GitHub, PostgreSQL, etc.).</div>
              </div>
            </div>
          </div>

          <p className="text-foreground text-lg leading-relaxed">
            The beauty of MCP is that Claude doesn't need to know the implementation details. It just sees
            available tools like "create_github_issue" or "query_database" and uses them naturally in conversation.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Settings className="w-8 h-8 text-accent" />
            Setting Up MCP Servers
          </h2>

          <p className="text-foreground text-lg leading-relaxed mb-6">
            MCP servers are configured in your Claude Code settings file at <code className="bg-stone-800 px-2 py-1 rounded text-accent">~/.claude/settings.json</code>.
            Here's how to add them:
          </p>

          <div className="bg-card rounded-lg p-6 border border-border my-8">
            <h3 className="text-xl font-semibold text-foreground mb-4">Basic Configuration Structure</h3>
            <pre className="bg-background rounded-lg p-4 overflow-x-auto text-sm">
              <code className="text-foreground">{`{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-name"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}`}</code>
            </pre>
            <p className="text-muted text-sm mt-3 mb-0">
              Each server has a command to run, arguments, and optional environment variables.
            </p>
          </div>

          <p className="text-foreground text-lg leading-relaxed">
            You can also configure MCP servers interactively by running <code className="bg-stone-800 px-2 py-1 rounded text-accent">/mcp</code>
            in Claude Code, which provides a guided setup experience.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Github className="w-8 h-8 text-accent" />
            GitHub MCP Server
          </h2>

          <p className="text-foreground text-lg leading-relaxed mb-6">
            The GitHub MCP server is essential for developers. It lets Claude create issues, open pull requests,
            review code, manage repos, and more—all through natural conversation.
          </p>

          <div className="bg-card rounded-lg p-6 border border-border my-8">
            <h3 className="text-xl font-semibold text-foreground mb-4">Configuration</h3>
            <pre className="bg-background rounded-lg p-4 overflow-x-auto text-sm">
              <code className="text-foreground">{`{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_personal_access_token"
      }
    }
  }
}`}</code>
            </pre>
            <p className="text-muted text-sm mt-3 mb-0">
              Create a GitHub Personal Access Token at github.com/settings/tokens with repo and issue permissions.
            </p>
          </div>

          <div className="bg-card p-6 rounded-lg border border-border my-8">
            <h3 className="text-xl font-semibold text-foreground mb-4">Available Tools</h3>
            <ul className="space-y-3 text-foreground m-0">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                <div><strong>create_issue</strong> — Open new issues with labels and assignees</div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                <div><strong>create_pull_request</strong> — Open PRs with title, body, and target branch</div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                <div><strong>list_issues</strong> — Query open issues by labels, state, or assignee</div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                <div><strong>get_file_contents</strong> — Read files directly from GitHub repos</div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                <div><strong>search_code</strong> — Search across repositories for code patterns</div>
              </li>
            </ul>
          </div>

          <div className="bg-stone-800 p-4 rounded-lg my-8">
            <p className="text-foreground m-0">
              <strong className="text-accent">Example prompt:</strong> "Create an issue titled 'Add dark mode support'
              in the frontend repo with the labels 'enhancement' and 'ui'"
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Database className="w-8 h-8 text-accent" />
            Database MCP Servers
          </h2>

          <p className="text-foreground text-lg leading-relaxed mb-6">
            Database MCP servers let Claude query and analyze your data directly. This is incredibly powerful
            for data exploration, generating reports, and building features that interact with your database.
          </p>

          <div className="grid md:grid-cols-2 gap-6 my-8">
            <div className="bg-card p-6 rounded-lg border border-border">
              <h3 className="text-accent font-semibold text-lg mb-3">PostgreSQL</h3>
              <pre className="bg-background rounded-lg p-3 text-xs overflow-x-auto">
                <code className="text-muted">{`{
  "postgres": {
    "command": "npx",
    "args": ["-y",
      "@modelcontextprotocol/server-postgres",
      "postgresql://user:pass@host/db"
    ]
  }
}`}</code>
              </pre>
            </div>

            <div className="bg-card p-6 rounded-lg border border-border">
              <h3 className="text-accent font-semibold text-lg mb-3">SQLite</h3>
              <pre className="bg-background rounded-lg p-3 text-xs overflow-x-auto">
                <code className="text-muted">{`{
  "sqlite": {
    "command": "npx",
    "args": ["-y",
      "@modelcontextprotocol/server-sqlite",
      "./database.db"
    ]
  }
}`}</code>
              </pre>
            </div>
          </div>

          <div className="bg-stone-800 p-4 rounded-lg my-8">
            <p className="text-foreground m-0">
              <strong className="text-accent">Example prompt:</strong> "Show me the top 10 users by total purchases
              this month, and create a summary report"
            </p>
          </div>

          <div className="bg-red-900/20 border border-red-400/30 rounded-lg p-6 my-8">
            <h3 className="text-red-400 font-semibold text-lg mb-2">Security Warning</h3>
            <p className="text-foreground m-0">
              Never use production database credentials in MCP servers. Create read-only users with limited
              permissions. MCP servers can execute any query Claude decides to run.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-accent" />
            Communication MCP Servers
          </h2>

          <p className="text-foreground text-lg leading-relaxed mb-6">
            Connect Claude to your team's communication tools to automate notifications, summaries, and updates.
          </p>

          <div className="space-y-6 my-8">
            <div className="bg-card p-6 rounded-lg border border-border">
              <h3 className="text-accent font-semibold text-lg mb-3">Slack MCP Server</h3>
              <p className="text-foreground mb-4">
                Send messages, read channels, and interact with Slack workspaces through Claude.
              </p>
              <pre className="bg-background rounded-lg p-3 text-xs overflow-x-auto">
                <code className="text-muted">{`{
  "slack": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-slack"],
    "env": {
      "SLACK_BOT_TOKEN": "xoxb-your-bot-token"
    }
  }
}`}</code>
              </pre>
            </div>

            <div className="bg-card p-6 rounded-lg border border-border">
              <h3 className="text-accent font-semibold text-lg mb-3">Use Cases</h3>
              <ul className="text-foreground space-y-2 m-0">
                <li>• Post deployment notifications to #releases channel</li>
                <li>• Summarize discussion threads for documentation</li>
                <li>• Create standup reports from channel activity</li>
                <li>• Send alerts when builds fail or tests break</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <FileText className="w-8 h-8 text-accent" />
            Filesystem & Web MCP Servers
          </h2>

          <p className="text-foreground text-lg leading-relaxed mb-6">
            Extend Claude's ability to work with files and fetch web content with these utility servers.
          </p>

          <div className="grid md:grid-cols-2 gap-6 my-8">
            <div className="bg-card p-6 rounded-lg border border-border">
              <h3 className="text-accent font-semibold text-lg mb-3">Filesystem</h3>
              <p className="text-foreground mb-4">
                Enhanced file operations with watch capabilities, glob patterns, and batch processing.
              </p>
              <ul className="text-muted text-sm space-y-1 m-0">
                <li>• Watch files for changes</li>
                <li>• Batch rename operations</li>
                <li>• Complex glob searches</li>
              </ul>
            </div>

            <div className="bg-card p-6 rounded-lg border border-border">
              <h3 className="text-accent font-semibold text-lg mb-3">Fetch</h3>
              <p className="text-foreground mb-4">
                Make HTTP requests and fetch web content for analysis and integration.
              </p>
              <ul className="text-muted text-sm space-y-1 m-0">
                <li>• Scrape documentation</li>
                <li>• Call external APIs</li>
                <li>• Download and analyze files</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Server className="w-8 h-8 text-accent" />
            Building Custom MCP Servers
          </h2>

          <p className="text-foreground text-lg leading-relaxed mb-6">
            Need an integration that doesn't exist? Building custom MCP servers is straightforward with the
            official SDKs available in Python, TypeScript, and other languages.
          </p>

          <div className="bg-card rounded-lg p-6 border border-border my-8">
            <h3 className="text-xl font-semibold text-foreground mb-4">Simple TypeScript MCP Server</h3>
            <pre className="bg-background rounded-lg p-4 overflow-x-auto text-sm">
              <code className="text-foreground">{`import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";

const server = new Server({
  name: "my-custom-server",
  version: "1.0.0"
});

server.setRequestHandler("tools/list", async () => ({
  tools: [{
    name: "my_custom_tool",
    description: "Does something useful",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string" }
      }
    }
  }]
}));

server.setRequestHandler("tools/call", async (request) => {
  // Implement your tool logic here
  return { content: [{ type: "text", text: "Result" }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);`}</code>
            </pre>
          </div>

          <div className="bg-gradient-to-r from-orange-900/20 to-stone-900/20 p-8 rounded-lg border border-accent/30 my-8">
            <h3 className="text-2xl font-semibold text-accent mb-4">Custom Server Ideas</h3>
            <ul className="space-y-3 text-foreground m-0">
              <li className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div><strong>Jira/Linear Integration</strong> — Create tickets, update status, link to PRs</div>
              </li>
              <li className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div><strong>CI/CD Server</strong> — Trigger builds, check pipeline status, deploy</div>
              </li>
              <li className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div><strong>Monitoring Server</strong> — Query Datadog, PagerDuty, or custom metrics</div>
              </li>
              <li className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div><strong>Cloud Provider</strong> — Manage AWS, GCP, or Azure resources</div>
              </li>
            </ul>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6">Track Your MCP-Enhanced Workflow</h2>

          <p className="text-foreground text-lg leading-relaxed mb-6">
            As you integrate more MCP servers, your Claude Code usage becomes increasingly powerful. Track how
            these integrations boost your productivity with Viberank's analytics.
          </p>

          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <p className="text-muted mb-4">See your Claude Code stats and join the leaderboard</p>
            <div className="bg-background rounded-lg px-6 py-4 inline-flex items-center gap-3 font-mono">
              <span className="text-stone-500">$</span>
              <span className="text-accent text-lg">npx viberank</span>
            </div>
            <p className="text-stone-500 text-sm mt-4">
              Upload your cc.json and compare your usage with other developers
            </p>
          </div>
        </section>

        <footer className="mt-16 pt-8 border-t border-border">
          <h3 className="text-xl font-semibold text-foreground mb-4">Unlock Claude's Full Potential</h3>
          <p className="text-foreground mb-6">
            MCP servers transform Claude Code from a coding assistant into an automation platform. Start with
            GitHub and database servers, then expand as you discover new workflows. The ability to connect
            AI to your entire development stack is what makes Claude Code uniquely powerful.
          </p>
          <p className="text-stone-500 text-sm">
            Explore more MCP servers at the official MCP repository and community collections.
          </p>
        </footer>
      </article>
    </>
  );
}
