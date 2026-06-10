-- Migration 003: opt-in "open to work" flag for the /hire page.
--
-- Explicit opt-in only — never inferred from GitHub's hireable flag. The
-- column is additive with a default, so existing rows and deployed code keep
-- working. Apply BEFORE deploying the matching app code.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS open_to_work BOOLEAN NOT NULL DEFAULT FALSE;

-- The /hire page only ever reads the opted-in slice.
CREATE INDEX IF NOT EXISTS idx_profiles_open_to_work
  ON profiles(open_to_work) WHERE open_to_work;
