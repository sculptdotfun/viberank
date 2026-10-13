-- Migration 020: rank the efficiency board on a volume-weighted score.
--
-- tokens_per_dollar (011) rewards having spent little: 1B tokens for $120
-- is 8.3M/$ and topped the board over heavy users at 3-4M/$. The score
-- shrinks each ratio toward the site median by a prior worth $1,000 of
-- spend, so short histories report roughly the median and long ones their
-- own ratio. See src/lib/efficiency.ts; the constants below
-- (EFFICIENCY_PRIOR_RATE = 1.2M tokens/$, EFFICIENCY_PRIOR_COST = $1,000,
-- so the prior adds 1.2e9 tokens) must match it, which a test checks.
-- The raw ratio stays; the board still displays it.

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS efficiency_score DOUBLE PRECISION
  GENERATED ALWAYS AS (
    CASE WHEN total_cost > 0
      THEN (total_tokens::DOUBLE PRECISION + 1200000000) / (total_cost + 1000)
      ELSE NULL
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_submissions_efficiency_score
  ON submissions(efficiency_score DESC NULLS LAST)
  WHERE total_cost >= 100;

NOTIFY pgrst, 'reload schema';
