-- Migration 006: raw submission payload archive.
--
-- normalizeCcData collapses every ccusage report shape into one canonical
-- form at ingest time — and then the original payload is gone. Every ccusage
-- format change (e.g. the v20 period/agent rename, issue #49) is a one-way
-- door for data submitted before the parser learned about it.
--
-- This table keeps the pre-normalization payload (deduped by content hash)
-- together with the parser version that processed it, so history can be
-- re-parsed/backfilled when the normalizer improves. Service-role only:
-- RLS is enabled with no policies, so the anon browser key can neither read
-- nor write raw payloads.

CREATE TABLE IF NOT EXISTS raw_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- sha256 of the JSON payload; identical re-submits are dropped on conflict.
  payload_sha256 TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('cli', 'oauth')),
  machine_id TEXT,
  cli_version TEXT,
  -- Version of the normalizer that ingested this payload (see ccusage.ts).
  parser_version TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_submissions_username ON raw_submissions(username);
CREATE INDEX IF NOT EXISTS idx_raw_submissions_created_at ON raw_submissions(created_at DESC);

ALTER TABLE raw_submissions ENABLE ROW LEVEL SECURITY;
