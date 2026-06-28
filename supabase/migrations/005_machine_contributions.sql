-- Migration 005: per-machine daily contributions (issue #43).
--
-- ccusage has no machine identifier, so two machines submitting the same date
-- under one account used to overwrite each other (data loss), while we still
-- had to overwrite a re-submission from the *same* machine (no double-count).
-- The CLI now sends a stable `X-Machine-Id`; this column records each machine's
-- slice of a day keyed by that id. The row's aggregate columns stay the sum
-- across machines (what the UI reads); machine_contributions is merge-only
-- bookkeeping.
--
-- Shape: { "<machineId>": { inputTokens, outputTokens, cacheCreationTokens,
--          cacheReadTokens, totalTokens, totalCost, modelsUsed, agents,
--          modelBreakdowns } }
--
-- NULL means "submitted before this migration" (legacy row). The first id'd
-- submission for an overlapping date replaces such a row (today's behavior);
-- once each machine has re-submitted, distinct machines sum. Apply BEFORE
-- deploying the matching app code.

ALTER TABLE daily_breakdowns
  ADD COLUMN IF NOT EXISTS machine_contributions JSONB;
