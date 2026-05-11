# viberank

A community-driven leaderboard for [Claude Code](https://claude.com/claude-code) usage. Submit your `ccusage` stats and see how you rank.

![viberank](https://img.shields.io/badge/viberank-Track%20Your%20Claude%20Code%20Usage-orange)
![License](https://img.shields.io/badge/license-MIT-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

Live at **[viberank.app](https://www.viberank.app)**.

## Features

- 🏆 **Global leaderboard** by cost or tokens, with 7d / 30d / custom date filters
- 📊 **Profile pages** at `viberank.app/profile/{username}` with daily charts and model breakdown
- 🚀 **Three ways to submit**: `npx viberank` CLI, plain `curl`, or signed-in web upload
- 🔐 **GitHub OAuth** — verified submissions show a blue check; unverified CLI submissions show a `cli` pill
- 🛡️ **Input validation** — token math, date sanity, daily-cost ceilings
- 🔄 **Merge flow** — re-submitting the same range overwrites prior daily entries; merging combines unverified CLI rows into your verified profile

## Submitting your usage data

### Option 1: `npx viberank` (recommended)

```bash
npx viberank
```

This generates a fresh `cc.json` via `ccusage` and POSTs it to `/api/submit`. It picks up your GitHub username from `git config user.name`.

### Option 2: curl

```bash
npx ccusage@latest --json > cc.json
curl -X POST https://www.viberank.app/api/submit \
  -H "Content-Type: application/json" \
  -H "X-GitHub-User: $(git config user.name)" \
  -d @cc.json
```

### Option 3: Web upload

1. Sign in to [viberank.app](https://www.viberank.app) with GitHub
2. Click **Submit Stats** → **Upload cc.json**
3. Drop your `cc.json` file

Web uploads come back with a verified badge automatically. CLI submissions show as unverified until you sign in and merge them via the prompt on the homepage.

### Option 4: MCP server

If you use a Claude Code MCP-compatible client, the [`viberank-mcp-server`](./packages/viberank-mcp-server) exposes submit and lookup tools. (Note: this package is currently unmaintained — see [issue tracker](https://github.com/sculptdotfun/viberank/issues) for status.)

## Data validation

Submissions are checked at the API level. Anything that fails these rules is rejected:

- **Token math** — `input + output + cache_creation + cache_read = total` (within 1 token of tolerance)
- **No negative values** anywhere in totals or daily breakdowns
- **Valid date format** — `YYYY-MM-DD`
- **Not too far in the future** — dates after tomorrow-UTC are rejected (covers users at any global timezone offset)
- **Realistic ranges** — total cost can't exceed `$5,000 × 365 days`

Submissions can also be flagged for review by an admin via `/admin`; flagged rows are hidden from the leaderboard by default.

See [VALIDATION.md](./VALIDATION.md) for the full ruleset.

## Merging multiple submissions

If you submit via the CLI before signing in, the row lands on the leaderboard as **unverified** (`cli` pill). Once you sign in with the matching GitHub account, the homepage shows a banner offering to verify or merge. That hits an authenticated `/api/claim` endpoint which:

1. Finds all submissions under your GitHub username
2. Picks a base submission (OAuth-verified row wins; else most recent)
3. Merges daily breakdowns — overlapping dates take the OAuth version
4. Recomputes totals, sets `verified: true`, deletes the duplicates

**Known limitation:** submitting from multiple machines with overlapping dates currently overwrites instead of summing daily data — see [#43](https://github.com/sculptdotfun/viberank/issues/43). Submit from one machine at a time until that's resolved.

## Development

### Prerequisites

- Node.js 18+ and pnpm 10+
- A [Supabase](https://supabase.com) project (free tier is fine)
- A GitHub OAuth app

### Setup

```bash
git clone https://github.com/sculptdotfun/viberank.git
cd viberank
pnpm install
cp .env.example .env.local
```

Fill in `.env.local` (see `.env.example` for the full list). The required keys are:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_DATABASE_BACKEND=supabase

NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=<openssl rand -base64 32>

GITHUB_ID=<github-oauth-client-id>
GITHUB_SECRET=<github-oauth-client-secret>
```

Apply the schema:

```bash
# Run the SQL in supabase/migrations/001_initial_schema.sql against your project,
# either via the Supabase SQL editor or the supabase CLI.
```

Run the dev server:

```bash
pnpm dev
```

Open <http://localhost:3001>.

### Useful scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start Next dev server (Turbopack) on port 3001 |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run `next lint` |
| `pnpm exec tsc --noEmit` | Type-check without emitting |

## Tech stack

- **Frontend**: Next.js 16, React 19, TypeScript 5, Tailwind CSS 4
- **Backend**: Next.js API routes + Supabase (Postgres)
- **Auth**: NextAuth.js v4 with GitHub OAuth
- **Charts**: Recharts
- **Animation**: Framer Motion
- **Hosting**: Vercel

The repo also contains a dormant Convex implementation behind a feature flag (`NEXT_PUBLIC_DATABASE_BACKEND=convex`); Supabase is the active backend in production.

## API

### `POST /api/submit`

Submit usage data. Authenticated submissions (with a NextAuth session cookie) are marked `verified: true`; otherwise the request must include an `X-GitHub-User` header.

**Body**: contents of `cc.json` (output of `npx ccusage --json`).

**Response**:

```json
{
  "success": true,
  "submissionId": "...",
  "message": "Successfully submitted data for username",
  "profileUrl": "https://viberank.app/profile/username"
}
```

### `POST /api/claim`

Authenticated — merges unverified CLI submissions into the caller's verified profile. Username is taken from the session, not the request body. Returns 401 without a session.

### `GET /api/health`

Returns backend status:

```json
{ "api": "ok", "backend": "supabase", "backendConnection": "ok", "timestamp": "..." }
```

## Deployment

Designed to run on Vercel. Push to `main` to trigger an auto-deploy. The required production env vars are the same as `.env.example`; make sure `SUPABASE_SERVICE_ROLE_KEY` and the `NEXT_PUBLIC_*` Supabase vars are also listed in `turbo.json`'s `build.env` allowlist so Turbo passes them through.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sculptdotfun/viberank)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE).

## Acknowledgments

- [Claude Code](https://claude.com/claude-code) by Anthropic
- [ccusage](https://github.com/ryoppippi/ccusage) — the usage tracker that produces `cc.json`

## Links

- [Website](https://www.viberank.app)
- [GitHub](https://github.com/sculptdotfun/viberank)
- [Report issues](https://github.com/sculptdotfun/viberank/issues)
- [`viberank` on npm](https://www.npmjs.com/package/viberank)
