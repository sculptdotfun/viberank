-- Migration 019: scope corpus observations to the directory they counted.
--
-- A corpus observation (#112) records how many transcripts a machine saw per
-- month, so a smaller count next time can be read as history the user
-- deleted. One machine can have two submitters that count different folders
-- — a script over a folder merged from several hosts, and the CLI over
-- ~/.claude/projects — under the same machine id. Compared across those, the
-- CLI's smaller count read as a deletion and lowered the account's totals
-- until the wider submitter ran again, every day.
--
-- Clients now send a hash of the counted directory; observations are keyed
-- and compared per scope. Existing rows and older clients share scope '',
-- which behaves exactly as before.

ALTER TABLE corpus_observations ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT '';

DO $$
DECLARE
  old_key TEXT;
BEGIN
  -- 012 created the key inline, so its name is Postgres-generated; find it by
  -- definition rather than guessing.
  SELECT conname INTO old_key
  FROM pg_constraint
  WHERE conrelid = 'corpus_observations'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) = 'UNIQUE (username, machine_id, month)';

  IF old_key IS NOT NULL THEN
    EXECUTE format('ALTER TABLE corpus_observations DROP CONSTRAINT %I', old_key);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'corpus_observations'::regclass
      AND conname = 'corpus_observations_username_machine_scope_month_key'
  ) THEN
    ALTER TABLE corpus_observations
      ADD CONSTRAINT corpus_observations_username_machine_scope_month_key
      UNIQUE (username, machine_id, scope, month);
  END IF;
END $$;

DROP INDEX IF EXISTS idx_corpus_observations_lookup;
CREATE INDEX IF NOT EXISTS idx_corpus_observations_lookup
  ON corpus_observations(lower(username), machine_id, scope);

NOTIFY pgrst, 'reload schema';
