# Contributing to viberank

Thanks for helping out. This document covers the dev setup, repo structure, and conventions.

## Reporting bugs

Before filing, check [existing issues](https://github.com/sculptdotfun/viberank/issues). A good bug report includes:

- A clear title
- Exact reproduction steps
- Expected vs. actual behavior
- Any error messages or screenshots
- Browser / Node version if relevant

## Suggesting enhancements

File a GitHub issue with the motivation, the proposed behavior, and any alternatives you considered.

## Pull requests

1. Fork and branch off `main`
2. Keep changes focused — atomic commits are easier to review
3. Update relevant documentation if you change behavior, env vars, or APIs
4. Make sure `pnpm build` succeeds and `pnpm exec tsc --noEmit` doesn't introduce new errors
5. Open the PR with a short description of what changed and why

## Development setup

### Prerequisites

- Node.js 18+ and pnpm 10+
- A Supabase project (free tier is fine) — the schema lives in `supabase/migrations/001_initial_schema.sql`
- A GitHub OAuth app for local sign-in (callback URL: `http://localhost:3001/api/auth/callback/github`)

### Install

```bash
git clone https://github.com/sculptdotfun/viberank.git
cd viberank
pnpm install
cp .env.example .env.local
```

Fill in `.env.local` with your Supabase project URL, anon key, service role key, GitHub OAuth credentials, and a generated `NEXTAUTH_SECRET`.

### Apply the database schema

Run the SQL in `supabase/migrations/001_initial_schema.sql` against your Supabase project, either via the SQL editor in the dashboard or the `supabase` CLI.

### Run the dev server

```bash
pnpm dev
```

Opens on <http://localhost:3001>.

## Project structure

```
viberank/
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── api/
│   │   │   ├── submit/       # POST /api/submit
│   │   │   ├── claim/        # POST /api/claim (authenticated merge)
│   │   │   ├── auth/         # NextAuth handlers
│   │   │   └── health/       # GET /api/health
│   │   ├── profile/[username]/
│   │   ├── admin/
│   │   └── page.tsx          # Home / leaderboard
│   ├── components/           # React components
│   ├── lib/
│   │   ├── auth.ts           # Shared NextAuth options
│   │   ├── env.ts            # Server env validation
│   │   ├── utils.ts
│   │   └── data/             # Backend-agnostic data layer
│   │       ├── index.ts      # Feature-flag selector
│   │       ├── types.ts
│   │       ├── hooks/        # React hooks (client)
│   │       ├── supabase/     # Active backend
│   │       └── convex/       # Dormant fallback
│   └── types/                # Shared TS types
├── supabase/
│   └── migrations/           # SQL migrations
├── convex/                   # Dormant Convex implementation
├── packages/
│   ├── viberank-cli/         # `npx viberank` CLI
│   └── viberank-mcp-server/  # MCP server (currently unmaintained)
└── public/                   # Static assets
```

The data layer (`src/lib/data/`) abstracts over Supabase and Convex via the `NEXT_PUBLIC_DATABASE_BACKEND` env var. Production runs on Supabase; the Convex code path is present but dormant.

## Conventions

### TypeScript

- No `any`. Use explicit types or `unknown` and narrow.
- `import type { ... }` for type-only imports.
- The build currently has `typescript.ignoreBuildErrors: true` in `next.config.ts` (because of pre-existing implicit-`any`s in admin pages). Don't introduce new errors — run `pnpm exec tsc --noEmit` locally before pushing.

### React

- Functional components with hooks
- Small, focused components — extract when a single component does too much
- Destructure props at the parameter level

### Styling

- Tailwind CSS 4. Use existing tokens / utilities; check `src/app/globals.css` and `tailwind.config` for theme overrides.
- Test mobile layouts when you touch anything in `src/components/`

### Git commits

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: add time-range filter to leaderboard`
- `fix: correct token math for merged submissions`
- `refactor: extract auth options to lib/auth.ts`
- `chore: update env example`
- `docs: refresh README`

Keep the subject under ~72 characters. Use the body for the *why*.

## Pre-PR checklist

```bash
pnpm exec tsc --noEmit   # type-check
pnpm lint                # next lint
pnpm build               # full production build
```

Manually verify in the browser:

- Sign-in flow works
- A web upload completes
- The leaderboard renders with and without date filters
- Mobile layout doesn't break

## Questions

Open an issue or reach out to a maintainer. Thanks for contributing 🧡.
