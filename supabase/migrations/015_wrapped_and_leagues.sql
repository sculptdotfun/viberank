-- Migration 015: per-user monthly stats (Wrapped) + friend leagues.
--
-- get_user_month_stats powers /wrapped/[month]/[username]: one user's month
-- sliced the way a shareable recap needs, including rank/percentile among
-- that month's active users — which is exactly the aggregation the client
-- can't do without downloading everyone's month.
--
-- Leagues are invite-code groups with their own board. Names and members are
-- public like everything else on the site; invite codes live in a separate
-- table with no public read policy, because RLS is row-level and a code on a
-- publicly readable leagues row would be a code anyone can read.

CREATE OR REPLACE FUNCTION get_user_month_stats(p_month TEXT, p_username TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH month_days AS (
    SELECT d.date, d.total_cost, d.total_tokens, d.agents, d.model_breakdowns, s.username
    FROM daily_breakdowns d
    JOIN submissions s ON s.id = d.submission_id
    WHERE s.flagged_for_review IS NOT TRUE
      AND p_month ~ '^\d{4}-\d{2}$'
      AND to_char(d.date, 'YYYY-MM') = p_month
  ),
  per_user AS (
    SELECT username, SUM(total_cost) AS cost
    FROM month_days
    GROUP BY username
  ),
  mine AS (
    SELECT date, SUM(total_cost) AS cost, SUM(total_tokens) AS tokens
    FROM month_days
    WHERE username = p_username
    GROUP BY date
  ),
  -- Longest consecutive-day run inside the month (gaps-and-islands).
  streaks AS (
    SELECT COUNT(*) AS len
    FROM (
      SELECT date, date - (ROW_NUMBER() OVER (ORDER BY date))::int AS grp
      FROM mine
    ) g
    GROUP BY grp
  )
  SELECT jsonb_build_object(
    'month', p_month,
    'username', p_username,
    'cost', COALESCE((SELECT SUM(cost) FROM mine), 0),
    'tokens', COALESCE((SELECT SUM(tokens) FROM mine), 0),
    'activeDays', (SELECT COUNT(*) FROM mine),
    'bestDayCost', COALESCE((SELECT MAX(cost) FROM mine), 0),
    'longestStreak', COALESCE((SELECT MAX(len) FROM streaks), 0),
    'rank', (
      SELECT COUNT(*) + 1 FROM per_user
      WHERE cost > COALESCE((SELECT cost FROM per_user WHERE username = p_username), 0)
    ),
    'totalActives', (SELECT COUNT(*) FROM per_user),
    'topModels', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('model', model, 'cost', cost) ORDER BY cost DESC)
      FROM (
        SELECT mb->>'modelName' AS model, SUM((mb->>'cost')::numeric) AS cost
        FROM month_days m, LATERAL jsonb_array_elements(m.model_breakdowns) mb
        WHERE m.username = p_username
          AND m.model_breakdowns IS NOT NULL AND mb->>'modelName' IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC LIMIT 3
      ) x
    ), '[]'::jsonb),
    'tools', COALESCE((
      SELECT jsonb_agg(DISTINCT a.tool)
      FROM month_days m, unnest(m.agents) AS a(tool)
      WHERE m.username = p_username
    ), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION get_user_month_stats(TEXT, TEXT) TO anon, authenticated, service_role;

-- ============================================================================
-- LEAGUES
-- ============================================================================

CREATE TABLE IF NOT EXISTS leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 60),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Codes are secrets; separate table so the public leagues read policy can
-- never expose them.
CREATE TABLE IF NOT EXISTS league_invites (
  league_id UUID PRIMARY KEY REFERENCES leagues(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS league_members (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, username)
);

CREATE INDEX IF NOT EXISTS idx_league_members_username ON league_members(username);

ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leagues' AND policyname = 'Public read leagues') THEN
    CREATE POLICY "Public read leagues" ON leagues FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'league_members' AND policyname = 'Public read league_members') THEN
    CREATE POLICY "Public read league_members" ON league_members FOR SELECT USING (true);
  END IF;
  -- league_invites: no public policy on purpose — service role only.
END $$;

NOTIFY pgrst, 'reload schema';
