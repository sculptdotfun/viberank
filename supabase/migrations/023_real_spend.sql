-- Real spend: what developers actually paid OpenRouter.
--
-- The leaderboard ranks API-equivalent usage that ccusage computes from local
-- logs. Tools that route through OpenRouter (OpenClaw, OpenCode, Hermes, …)
-- are already in those logs, so OpenRouter's own billing figures can't be
-- added to submissions or daily_breakdowns without counting that usage twice.
-- They get their own ledger instead, shown beside the board and never summed
-- into it: nothing reads these tables when ranking or totalling submissions.
--
-- Written only by POST /api/spend/openrouter, which requires a CLI API token
-- (spend is published under a signed identity, never an X-GitHub-User claim).
-- The CLI reads OpenRouter with the user's key on their machine and sends only
-- daily totals and the all-time total; the key itself never reaches us.
--
-- Idempotent: safe to re-run.

-- One row per developer, source and UTC day. A sync replaces the days it
-- carries (OpenRouter is authoritative for its own 30-day window) and leaves
-- older days alone, so the history grows past OpenRouter's window over time.
CREATE TABLE IF NOT EXISTS real_spend_days (
  -- GitHub handles are case-insensitive; stored lowercased so the primary key
  -- can't hold the same person twice under two casings.
  username          TEXT NOT NULL CHECK (username = lower(username)),
  source            TEXT NOT NULL CHECK (source IN ('openrouter')),
  date              DATE NOT NULL,
  -- USD paid in OpenRouter credits.
  cost_usd          NUMERIC NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
  -- USD billed through the user's own provider keys (BYOK). Paid, but not to
  -- OpenRouter, so it is kept apart from cost_usd.
  byok_cost_usd     NUMERIC NOT NULL DEFAULT 0 CHECK (byok_cost_usd >= 0),
  requests          INT NOT NULL DEFAULT 0 CHECK (requests >= 0),
  prompt_tokens     BIGINT NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
  completion_tokens BIGINT NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
  -- [{model, usage, byok, requests, promptTokens, completionTokens}], endpoints
  -- of the same model already merged by the CLI.
  models            JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (username, source, date)
);

-- /stats sums the last 30 days across everyone.
CREATE INDEX IF NOT EXISTS idx_real_spend_days_source_date
  ON real_spend_days (source, date);

-- The all-time figure. A snapshot, replaced on every sync, because OpenRouter
-- reports it as a running total rather than something we could sum from days.
CREATE TABLE IF NOT EXISTS real_spend_totals (
  username          TEXT NOT NULL CHECK (username = lower(username)),
  source            TEXT NOT NULL CHECK (source IN ('openrouter')),
  -- 'account': a management key, the whole account's spend.
  -- 'key': a normal API key, that one key's spend only. Shown as such.
  scope             TEXT NOT NULL CHECK (scope IN ('account', 'key')),
  lifetime_usd      NUMERIC NOT NULL CHECK (lifetime_usd >= 0),
  -- NULL when the source doesn't report it (OpenRouter's /credits has no BYOK
  -- total), which is not the same as zero.
  lifetime_byok_usd NUMERIC NULL CHECK (lifetime_byok_usd IS NULL OR lifetime_byok_usd >= 0),
  observed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (username, source)
);

ALTER TABLE real_spend_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_spend_totals ENABLE ROW LEVEL SECURITY;

-- Public read, like every other figure on a profile. No write policy: with
-- RLS on, anon and authenticated can't write, and the service role (the API
-- route) bypasses RLS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'real_spend_days' AND policyname = 'Public read real_spend_days') THEN
    CREATE POLICY "Public read real_spend_days" ON real_spend_days FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'real_spend_totals' AND policyname = 'Public read real_spend_totals') THEN
    CREATE POLICY "Public read real_spend_totals" ON real_spend_totals FOR SELECT USING (true);
  END IF;
END $$;

-- Belt and braces: Supabase's default privileges grant the public roles write
-- access to new tables, and RLS is the only thing between them and a row.
-- Take the privilege away too, so a policy added carelessly later can't open
-- published money figures to the anon key.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON real_spend_days FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON real_spend_totals FROM anon, authenticated;

COMMENT ON TABLE real_spend_days IS
  'Real money paid per day (OpenRouter). Separate from the leaderboard; never added to submissions or daily_breakdowns.';
COMMENT ON TABLE real_spend_totals IS
  'All-time real spend snapshot per developer and source, replaced on every sync. scope=key means one API key only.';

NOTIFY pgrst, 'reload schema';
