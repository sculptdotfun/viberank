#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import fetch from 'node-fetch';

interface CCUsageData {
  daily: Array<{
    date: string;
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    totalTokens: number;
    totalCost: number;
  }>;
  totals: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    totalTokens: number;
    totalCost: number;
  };
}

class ViberankMCPServer {
  private server: Server;
  private cachedUsageData: CCUsageData | null = null;
  private lastFetchTime: number = 0;
  private cacheDurationMs = 5 * 60 * 1000; // 5 minutes cache

  constructor() {
    this.server = new Server(
      {
        name: 'viberank-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_usage',
          description: 'Get current Claude Code usage statistics from ccusage',
          inputSchema: {
            type: 'object',
            properties: {
              force_refresh: {
                type: 'boolean',
                description: 'Force refresh the usage data (bypass cache)',
                default: false,
              },
            },
          },
        },
        {
          name: 'submit_to_viberank',
          description: 'Submit Claude Code usage statistics to Viberank leaderboard',
          inputSchema: {
            type: 'object',
            properties: {
              github_username: {
                type: 'string',
                description: 'GitHub username for the submission',
              },
              auto_detect_username: {
                type: 'boolean',
                description: 'Automatically detect GitHub username from git config',
                default: true,
              },
            },
            required: [],
          },
        },
        {
          name: 'get_leaderboard',
          description: 'Get current Viberank leaderboard rankings',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Number of top users to return',
                default: 10,
              },
            },
          },
        },
        {
          name: 'get_profile',
          description: 'Get Viberank profile for a specific user',
          inputSchema: {
            type: 'object',
            properties: {
              username: {
                type: 'string',
                description: 'GitHub username to get profile for',
              },
            },
            required: ['username'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'get_usage':
          return await this.getUsage(args?.force_refresh as boolean);

        case 'submit_to_viberank':
          return await this.submitToViberank(
            args?.github_username as string | undefined,
            args?.auto_detect_username as boolean
          );

        case 'get_leaderboard':
          return await this.getLeaderboard(args?.limit as number);

        case 'get_profile':
          return await this.getProfile(args?.username as string);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async getUsage(forceRefresh: boolean = false) {
    try {
      const now = Date.now();
      
      // Check cache
      if (!forceRefresh && this.cachedUsageData && (now - this.lastFetchTime) < this.cacheDurationMs) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                data: this.cachedUsageData,
                cached: true,
                summary: {
                  totalCost: `$${Math.round(this.cachedUsageData.totals.totalCost)}`,
                  totalTokens: this.cachedUsageData.totals.totalTokens.toLocaleString(),
                  daysTracked: this.cachedUsageData.daily.length,
                },
              }, null, 2),
            },
          ],
        };
      }

      // Generate fresh usage data
      const tempFile = path.join(os.tmpdir(), `cc-usage-${Date.now()}.json`);
      
      try {
        execSync(`npx ccusage@latest --json > ${tempFile}`, {
          encoding: 'utf8',
          stdio: 'pipe',
        });

        const data = JSON.parse(fs.readFileSync(tempFile, 'utf8')) as CCUsageData;
        
        // Update cache
        this.cachedUsageData = data;
        this.lastFetchTime = now;

        // Clean up temp file
        fs.unlinkSync(tempFile);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                data,
                cached: false,
                summary: {
                  totalCost: `$${Math.round(data.totals.totalCost)}`,
                  totalTokens: data.totals.totalTokens.toLocaleString(),
                  daysTracked: data.daily.length,
                },
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        // Clean up temp file if it exists
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        throw error;
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to get usage data: ${(error as Error).message}`,
              hint: 'Make sure you have run Claude Code at least once.',
            }, null, 2),
          },
        ],
      };
    }
  }

  private async submitToViberank(
    githubUsername?: string,
    autoDetectUsername: boolean = true
  ) {
    try {
      // Determine GitHub username
      let username = githubUsername;
      
      if (!username && autoDetectUsername) {
        try {
          username = execSync('git config user.name', { encoding: 'utf8' }).trim();
        } catch {
          // Ignore git config errors
        }
      }

      if (!username) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'GitHub username is required. Please provide it or ensure git config is set.',
              }, null, 2),
            },
          ],
        };
      }

      // Get fresh usage data
      const usageResult = await this.getUsage(true);
      const usageResponse = JSON.parse(
        (usageResult.content[0] as any).text
      );

      if (!usageResponse.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Failed to get usage data before submission.',
              }, null, 2),
            },
          ],
        };
      }

      // Submit to Viberank API
      const response = await fetch('https://viberank.app/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-User': username,
        },
        body: JSON.stringify(usageResponse.data),
      });

      const result = await response.json() as any;

      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Successfully submitted to Viberank for ${username}!`,
                profileUrl: result.profileUrl,
                submissionId: result.submissionId,
                summary: usageResponse.summary,
              }, null, 2),
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: result.error || 'Failed to submit to Viberank',
              }, null, 2),
            },
          ],
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Submission failed: ${(error as Error).message}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  private async getLeaderboard(limit: number = 10) {
    try {
      // For now, return a message about visiting the website
      // In a future version, we could add an API endpoint for this
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Leaderboard data is available at https://viberank.app',
              note: 'Direct API access to leaderboard coming soon!',
              limit,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to get leaderboard: ${(error as Error).message}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  private async getProfile(username: string) {
    try {
      const profileUrl = `https://viberank.app/profile/${encodeURIComponent(username)}`;
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              username,
              profileUrl,
              message: `View profile at: ${profileUrl}`,
              note: 'Direct API access to profile data coming soon!',
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to get profile: ${(error as Error).message}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Viberank MCP Server started');
  }
}

// Start the server
const server = new ViberankMCPServer();
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});