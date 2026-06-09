-- Supabase Migration 002: multi-tool support
--
-- ccusage v20 aggregates usage across many coding agents (claude, codex,
-- gemini, copilot, opencode, …). We record which tools contributed so the
-- leaderboard can be filtered by tool. Columns are additive and default to an
-- empty array, so existing rows and any code deployed before this migration
-- keep working.
--
-- Apply BEFORE deploying the matching app code (the write path sets these
-- columns). Run via the Supabase SQL editor or `supabase db push`.

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS tools TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE daily_breakdowns
  ADD COLUMN IF NOT EXISTS agents TEXT[] NOT NULL DEFAULT '{}';

-- GIN index supports "leaderboard filtered to users who used tool X"
-- (tools @> ARRAY['codex']).
CREATE INDEX IF NOT EXISTS idx_submissions_tools ON submissions USING GIN (tools);
