-- Owner-declared subscriptions: what a developer actually pays.
--
-- Every dollar on a profile is ccusage's API-equivalent value, and most people
-- pay a flat subscription that subsidises it many times over. This table lets
-- the owner say which plans they paid for and when, so the profile can put
-- real spend next to value (src/lib/money.ts does the arithmetic).
--
-- Public read on purpose: the profile is public and the owner chooses to
-- publish this. Writes are service-role only, through /api/profile/subscriptions,
-- which takes the username from the GitHub session.
--
-- Self-contained and idempotent, with no reference to its own number, so it
-- can be renumbered if another migration lands first.

CREATE TABLE IF NOT EXISTS profile_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Lowercased at write time. Handles are case-insensitive on GitHub, and a
  -- CHECK is cheaper than remembering to lower() in every query.
  username TEXT NOT NULL CHECK (username = lower(username)),
  -- Ids from TOOL_PLANS in src/lib/plans.ts. Validated by the app, not here:
  -- plans change with vendor pricing, and a CHECK would need a migration each
  -- time. A row naming a plan the app no longer lists is shown at $0.
  tool TEXT NOT NULL CHECK (length(tool) BETWEEN 1 AND 40),
  plan_id TEXT NOT NULL CHECK (length(plan_id) BETWEEN 1 AND 40),
  started_on DATE NOT NULL,
  -- NULL while the owner still pays.
  ended_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ended_on IS NULL OR ended_on >= started_on)
);

CREATE INDEX IF NOT EXISTS idx_profile_subscriptions_username
  ON profile_subscriptions (username);

ALTER TABLE profile_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profile_subscriptions' AND policyname = 'Public read profile_subscriptions'
  ) THEN
    CREATE POLICY "Public read profile_subscriptions" ON profile_subscriptions FOR SELECT USING (true);
  END IF;
  -- No INSERT/UPDATE/DELETE policy: only the service role writes.
END $$;

-- The /stats cohort: every declarer's subscriptions next to their profile's
-- API-equivalent total and recorded date range, so the page computes the
-- median subsidy multiple without downloading every submission. Flagged rows
-- are excluded, matching the board. Profile usernames keep their original
-- casing, hence the lower() join.
CREATE OR REPLACE FUNCTION get_declared_spend_cohort()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH declared AS (
    SELECT username,
           jsonb_agg(jsonb_build_object(
             'tool', tool,
             'planId', plan_id,
             'startedOn', started_on,
             'endedOn', ended_on
           ) ORDER BY started_on) AS subscriptions
    FROM profile_subscriptions
    GROUP BY username
  ),
  usage AS (
    SELECT lower(username) AS username,
           SUM(total_cost) AS value,
           MIN(date_range_start) AS first_date,
           MAX(date_range_end) AS last_date
    FROM submissions
    WHERE flagged_for_review IS NOT TRUE
    GROUP BY lower(username)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'username', d.username,
    'value', u.value,
    'firstDate', u.first_date,
    'lastDate', u.last_date,
    'subscriptions', d.subscriptions
  )), '[]'::jsonb)
  FROM declared d
  JOIN usage u ON u.username = d.username;
$$;

GRANT EXECUTE ON FUNCTION get_declared_spend_cohort() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
