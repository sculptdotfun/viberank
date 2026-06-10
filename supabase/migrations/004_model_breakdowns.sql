-- Migration 004: per-model token/cost splits on daily rows.
--
-- ccusage emits modelBreakdowns per day (tokens + cost per model); until now
-- we dropped them at ingest. NULL means "submitted before this migration" —
-- the UI falls back to models_used day counts. Re-submitting backfills.
-- Apply BEFORE deploying the matching app code.

ALTER TABLE daily_breakdowns
  ADD COLUMN IF NOT EXISTS model_breakdowns JSONB;
