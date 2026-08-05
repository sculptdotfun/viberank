-- Migration 012: per-(machine, month) corpus size, for the drift
-- discriminator (#112).
--
-- #111 keeps a high-water mark so a rewritten transcript cannot silently lower
-- an already-observed day. But it applies that unconditionally, which is wrong
-- when the user deleted history on purpose: they keep a total they meant to
-- erase. Telling the two apart needs the size of the corpus the numbers came
-- from, recorded per month so a deletion in an old month is not masked by
-- ordinary work in the current one.
--
-- Keyed by machine as well as month because a drift record is one machine's
-- local view, while a viberank daily total is a merge across machines (#43).
-- Comparing an incoming corpus against a merged aggregate, or against another
-- machine's counts, would be meaningless. #111's high-water mark is already
-- keyed per (day, machine); this keys the same way.

CREATE TABLE IF NOT EXISTS corpus_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  machine_id TEXT NOT NULL,
  -- 'YYYY-MM'
  month TEXT NOT NULL,
  files INTEGER NOT NULL,
  bytes BIGINT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (username, machine_id, month)
);

CREATE INDEX IF NOT EXISTS idx_corpus_observations_lookup
  ON corpus_observations(lower(username), machine_id);

-- Service-role only, like api_tokens: this is submission metadata, not
-- anything the public board needs to read.
ALTER TABLE corpus_observations ENABLE ROW LEVEL SECURITY;
