# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

- **Development server**: `pnpm dev` (runs on port 3000 with Turbopack)
- **Build**: `pnpm build`
- **Lint**: `pnpm lint`
- **Database schema generation**: `pnpm db:generate`
- **Database migrations**: `pnpm db:migrate`
- **Database studio**: `pnpm db:studio`

## Architecture Overview

viberank is a Next.js 15 application that tracks and ranks Claude Code usage statistics. The app has migrated from Convex to PostgreSQL with Drizzle ORM.

### Key Architecture Components

**Database Layer (PostgreSQL + Drizzle)**
- Schema defined in `src/lib/db/schema.ts` with two main tables:
  - `submissions`: Stores usage data submissions with daily breakdowns, validation flags, and metadata
  - `profiles`: User profiles linked to GitHub accounts
- Database operations centralized in `src/lib/db/operations.ts`
- Configuration in `drizzle.config.ts`

**Authentication**
- NextAuth.js with GitHub OAuth provider
- Configuration in `src/app/api/auth/[...nextauth]/route.ts`
- Environment variables managed through `src/lib/env.ts` with validation

**API Routes Structure**
- `/api/submit`: Main endpoint for usage data submission (supports CLI and OAuth)
- `/api/leaderboard`: Global rankings with filtering
- `/api/profile/[username]`: Individual user profiles
- `/api/stats`: Global statistics
- `/api/admin/flagged-submissions`: Admin moderation interface
- `/api/health`: Health check endpoint

**Data Validation & Integrity**
- Multi-level validation for submissions to prevent gaming
- Automatic flagging system for suspicious data
- Smart merging of overlapping date ranges in submissions
- Validation limits: max $5,000/day, 250M tokens/day, cost-per-token ratios

**Frontend Components**
- `Leaderboard.tsx`: Main ranking display with filtering
- `TokenChart.tsx`: Recharts-based usage visualization
- `FileUpload.tsx`: Drag-and-drop submission interface
- `ShareCard.tsx`: Social sharing functionality
- Profile pages at `/profile/[username]` with detailed analytics

### Environment Setup

Required environment variables (see `.env.example`):
- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_SECRET`: NextAuth session encryption key
- `NEXTAUTH_URL`: Application URL
- `GITHUB_ID`: GitHub OAuth app ID
- `GITHUB_SECRET`: GitHub OAuth app secret

### Data Flow

1. Users submit Claude Code usage data via CLI tool, web upload, or API
2. Data is validated and processed through `/api/submit`
3. Submissions are stored with daily breakdowns and flagging metadata
4. Leaderboards aggregate data with real-time filtering
5. Profile pages display individual user analytics and charts

### Technology Stack

- **Framework**: Next.js 15 with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: NextAuth.js
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Build**: Turbopack for development
- **Package Manager**: pnpm (required)