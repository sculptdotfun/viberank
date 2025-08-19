# Publishing Instructions for Viberank Packages

## Prerequisites
You need to be logged in as `sculptdotfun` on npm to publish these packages.

## Steps to Publish

1. **Login to npm as sculptdotfun:**
```bash
npm login
# Enter username: sculptdotfun
# Enter password: [your password]
# Enter email: hello@sculpt.fun
```

2. **Publish the CLI package:**
```bash
cd packages/viberank-cli
npm publish
```

3. **Build and publish the MCP server:**
```bash
cd ../viberank-mcp-server
npm run build
npm publish
```

## What was fixed
- Updated all API endpoints from `https://viberank.app` to `https://www.viberank.app`
- This fixes the "Failed to submit to Viberank" error users were experiencing
- Version bumped from 1.0.0 to 1.0.1 for both packages

## Files Updated
- packages/viberank-cli/cli.js
- packages/viberank-mcp-server/src/index.ts
- submit-to-viberank.sh
- README.md files

## After Publishing
Users will automatically get the fix when they run:
- `npx viberank`
- `npx viberank-mcp-server`