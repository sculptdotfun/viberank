// Smoke test: start the built server over stdio, the way an MCP client does,
// and call every read tool against the live site. It never calls
// submit_to_viberank, so it writes nothing anywhere.
//
//   npm run smoke            tools/list, get_stats, get_leaderboard, get_profile
//   npm run smoke -- --usage also get_usage, which runs ccusage locally (slow)

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const SERVER = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const withUsage = process.argv.includes('--usage');

/** First lines of a tool's JSON reply, enough to see its shape. */
const excerpt = (text, lines = 14) => text.split('\n').slice(0, lines).join('\n');

/**
 * stdout must carry nothing but JSON-RPC, or the client drops the connection.
 * The SDK client tolerates some noise, so check the raw stream directly.
 */
async function checkStdoutIsProtocolOnly() {
  const child = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  const request = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } } };
  child.stdin.write(`${JSON.stringify(request)}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`);
  // Wait for both replies (or give up after 10 seconds), then stop the child.
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 10000);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.split('\n').filter(Boolean).length >= 2) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  child.kill();
  const lines = stdout.split('\n').filter(Boolean);
  assert.ok(lines.length >= 2, 'got replies on stdout');
  for (const line of lines) assert.doesNotThrow(() => JSON.parse(line), `non-JSON on stdout: ${line.slice(0, 80)}`);
  console.log(`stdout check: ${lines.length} lines, all JSON-RPC`);
}

async function main() {
  await checkStdoutIsProtocolOnly();

  const transport = new StdioClientTransport({ command: process.execPath, args: [SERVER], stderr: 'pipe' });
  let stderr = '';
  transport.stderr?.on('data', (chunk) => (stderr += chunk));
  const client = new Client({ name: 'viberank-smoke', version: '0.0.0' });
  await client.connect(transport);

  const info = client.getServerVersion();
  console.log(`server: ${info?.name} ${info?.version}`);

  const { tools } = await client.listTools();
  console.log(`tools/list: ${tools.map((t) => t.name).join(', ')}`);
  assert.deepEqual(tools.map((t) => t.name).sort(), ['get_leaderboard', 'get_profile', 'get_stats', 'get_usage', 'submit_to_viberank']);

  const call = async (name, args) => {
    assert.notEqual(name, 'submit_to_viberank', 'the smoke test never submits');
    const result = await client.callTool({ name, arguments: args });
    const text = result.content?.[0]?.text ?? '';
    const body = JSON.parse(text);
    console.log(`\n--- ${name} ${JSON.stringify(args)} isError=${result.isError === true}`);
    console.log(excerpt(text));
    return body;
  };

  await call('get_stats', {});
  const board = await call('get_leaderboard', { limit: 3 });
  await call('get_leaderboard', { limit: 2, tool: 'codex' });
  // A profile that exists, once the leaderboard can name one.
  await call('get_profile', { username: board.entries?.[0]?.username ?? 'octocat' });
  await call('get_profile', { username: 'this-handle-does-not-exist-123' });
  await call('get_profile', { username: 'not a handle' });
  if (withUsage) await call('get_usage', {});

  await client.close();
  console.log(`\nstderr: ${stderr.trim().split('\n')[0] || '(empty)'}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
