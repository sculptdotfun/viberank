-- Migration 011: tokens-per-dollar, for the efficiency leaderboard (#70).
--
-- Sorting has to happen in the database. Doing it in the browser over the ~25
-- rows already fetched would rank "most efficient developer" among the top 25
-- by *cost*, which is a different and much less interesting question — and it
-- would silently disagree with the number of pages the board offers.
--
-- A generated column keeps the expression in one place and lets PostgREST
-- order by it directly, since it can order by a column but not an arbitrary
-- expression.
--
-- NULL rather than a sentinel for zero-cost rows: division by zero has no
-- honest answer here, and NULLS LAST puts them at the bottom instead of
-- letting a $0 submission with any tokens sit at #1 forever.
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS tokens_per_dollar DOUBLE PRECISION
  GENERATED ALWAYS AS (
    CASE WHEN total_cost > 0 THEN total_tokens::DOUBLE PRECISION / total_cost ELSE NULL END
  ) STORED;

-- Partial index matching the query: the board only ever ranks rows above the
-- spend floor, so indexing the rest is dead weight.
CREATE INDEX IF NOT EXISTS idx_submissions_efficiency
  ON submissions(tokens_per_dollar DESC NULLS LAST)
  WHERE total_cost >= 100;
