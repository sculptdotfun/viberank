-- Migration 024: v2 weekly boards (server-side window aggregation + frozen weeks).
--
-- The date-range board used to page every overlapping submission and all of
-- their days into the browser and sum them in JS. These functions aggregate
-- daily_breakdowns per developer for a window in the database and return one
-- JSONB value (a set-returning RPC would be cut at db-max-rows, silently, the
-- way the old .limit() calls were).
--
-- Identity and dedupe, matching the write path in src/lib/data/supabase/client.ts:
--   * Flagged rows (flagged_for_review) are left out, as on every board.
--   * One developer = lower(username): every submission from a user now lands
--     in one row (findTargetSubmission), so the key is the row's username.
--   * An unverified row is only a claim to a name. When a username has a
--     verified row, unverified rows under the same name are ignored here (the
--     owner can claim/merge them); otherwise the unverified rows count.
--   * Within one row a day is already deduplicated across machines (#43).
--     When a developer still has several kept rows for the same date (legacy
--     rows from before the one-row rule, not yet merged by a claim), the day
--     is combined the way combineContributionMaps does it: the same machine in
--     two rows is one machine (keep its larger observation), distinct
--     machines sum, the unattributed slice can hold a day up but never add to
--     it, and the result is never below the largest single row. The per-model
--     refinement of aggregateContributions is not mirrored; it only matters
--     for those legacy duplicates.
--
-- Frozen weeks (v2_weeks / v2_week_results): a closed week stops changing
-- WEEK_GRACE_HOURS (12) after it closes. daily_breakdowns has no per-day
-- receipt time (submissions.submitted_at moves on every merge, so it can't
-- date one day), so instead of filtering on receipt the server snapshots the
-- week's classified result the first time it is read after the grace period
-- (src/lib/v2/service.ts loadWeek) and serves the snapshot from then on. Days
-- that arrive later change the profile and lifetime board, never the week.

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_submissions_username_lower ON submissions (lower(username));
CREATE INDEX IF NOT EXISTS idx_daily_breakdowns_date_submission ON daily_breakdowns (date, submission_id);

-- ============================================================================
-- INTERNAL: the submission rows that count, one identity per lower(username)
-- ============================================================================

CREATE OR REPLACE FUNCTION v2_kept_submissions()
RETURNS TABLE (
  id UUID,
  user_key TEXT,
  username TEXT,
  github_username TEXT,
  github_avatar TEXT,
  verified BOOLEAN,
  source TEXT,
  tools TEXT[],
  review_reasons TEXT[],
  total_cost NUMERIC,
  submitted_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT x.id, x.user_key, x.username, x.github_username, x.github_avatar,
         x.verified, x.source, x.tools, x.review_reasons, x.total_cost, x.submitted_at
  FROM (
    SELECT s.id, lower(s.username) AS user_key, s.username, s.github_username, s.github_avatar,
           s.verified, s.source, s.tools, s.review_reasons, s.total_cost, s.submitted_at,
           bool_or(s.verified) OVER (PARTITION BY lower(s.username)) AS any_verified
    FROM submissions s
    WHERE s.flagged_for_review IS NOT TRUE
  ) x
  WHERE x.verified OR NOT x.any_verified;
$$;

-- ============================================================================
-- INTERNAL: one deduplicated row per (developer, date) in a window
-- ============================================================================
-- p_tool keeps days whose agents include the tool (and legacy days with no
-- agents from rows whose tools include it). A day's cost is not split by
-- agent in the public columns, so a tool board counts the whole day.
-- p_user_key NULL means everyone.

CREATE OR REPLACE FUNCTION v2_day_rows(
  p_from DATE,
  p_to DATE,
  p_tool TEXT DEFAULT NULL,
  p_user_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  user_key TEXT,
  date DATE,
  cost NUMERIC,
  tokens BIGINT,
  input_tokens BIGINT,
  output_tokens BIGINT,
  cache_creation_tokens BIGINT,
  cache_read_tokens BIGINT,
  agents TEXT[],
  model_breakdowns JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET plan_cache_mode = force_custom_plan
AS $$
#variable_conflict use_column
BEGIN
  -- plpgsql (not sql) on purpose: its plans are built for the actual
  -- arguments, so the window bounds pick the date index and a NULL user key
  -- folds away. A sql-language body is planned with unknown parameters, which
  -- made the planner start from every submission and read each one's whole
  -- history (nested loop on idx_daily_breakdowns_submission_id).
  -- force_custom_plan keeps it that way: after five calls in one session
  -- Postgres otherwise switches to a generic plan, which has the same flaw.
  RETURN QUERY
  WITH kept AS (
    SELECT k.id, k.user_key, k.tools
    FROM v2_kept_submissions() k
    WHERE p_user_key IS NULL OR k.user_key = p_user_key
  ),
  raw AS (
    SELECT k.user_key, d.date,
           d.total_cost::NUMERIC AS cost, d.total_tokens AS tokens,
           d.input_tokens, d.output_tokens, d.cache_creation_tokens, d.cache_read_tokens,
           COALESCE(d.agents, '{}') AS agents, d.model_breakdowns, d.machine_contributions,
           count(*) OVER (PARTITION BY k.user_key, d.date) AS n_rows
    FROM daily_breakdowns d
    JOIN kept k ON k.id = d.submission_id
    WHERE (p_from IS NULL OR d.date >= p_from)
      AND (p_to IS NULL OR d.date <= p_to)
      AND (
        p_tool IS NULL
        OR d.agents @> ARRAY[p_tool]
        OR (cardinality(COALESCE(d.agents, '{}')) = 0 AND k.tools @> ARRAY[p_tool])
      )
  ),
  -- The common case: one row holds the day, already merged across machines.
  single AS (
    SELECT r.user_key, r.date, r.cost, r.tokens, r.input_tokens, r.output_tokens,
           r.cache_creation_tokens, r.cache_read_tokens, r.agents, r.model_breakdowns
    FROM raw r
    WHERE r.n_rows = 1
  ),
  -- Legacy duplicates: open every row's per-machine map (a row with no map is
  -- one unattributed slice, as storedContributions treats it).
  slices AS (
    SELECT r.user_key, r.date, m.key AS machine,
           COALESCE((m.value->>'totalCost')::NUMERIC, 0) AS cost,
           COALESCE((m.value->>'totalTokens')::BIGINT, 0) AS tokens,
           COALESCE((m.value->>'inputTokens')::BIGINT, 0) AS input_tokens,
           COALESCE((m.value->>'outputTokens')::BIGINT, 0) AS output_tokens,
           COALESCE((m.value->>'cacheCreationTokens')::BIGINT, 0) AS cache_creation_tokens,
           COALESCE((m.value->>'cacheReadTokens')::BIGINT, 0) AS cache_read_tokens
    FROM raw r
    CROSS JOIN LATERAL jsonb_each(
      COALESCE(
        r.machine_contributions,
        jsonb_build_object('default', jsonb_build_object(
          'totalCost', r.cost, 'totalTokens', r.tokens,
          'inputTokens', r.input_tokens, 'outputTokens', r.output_tokens,
          'cacheCreationTokens', r.cache_creation_tokens, 'cacheReadTokens', r.cache_read_tokens
        ))
      )
    ) AS m(key, value)
    WHERE r.n_rows > 1
  ),
  -- The same machine seen in two rows is one machine: keep its larger observation.
  best AS (
    SELECT DISTINCT ON (s.user_key, s.date, s.machine) s.*
    FROM slices s
    ORDER BY s.user_key, s.date, s.machine, s.cost DESC, s.tokens DESC
  ),
  candidates AS (
    -- Distinct attributed machines sum.
    SELECT b.user_key, b.date, sum(b.cost) AS cost, sum(b.tokens)::BIGINT AS tokens,
           sum(b.input_tokens)::BIGINT AS input_tokens, sum(b.output_tokens)::BIGINT AS output_tokens,
           sum(b.cache_creation_tokens)::BIGINT AS cache_creation_tokens,
           sum(b.cache_read_tokens)::BIGINT AS cache_read_tokens
    FROM best b
    WHERE b.machine <> 'default'
    GROUP BY b.user_key, b.date
    UNION ALL
    -- The unattributed slice can hold the day up, never add to it.
    SELECT b.user_key, b.date, b.cost, b.tokens, b.input_tokens, b.output_tokens,
           b.cache_creation_tokens, b.cache_read_tokens
    FROM best b
    WHERE b.machine = 'default'
    UNION ALL
    -- A merge may raise a day above any stored row, never lower it.
    SELECT r.user_key, r.date, r.cost, r.tokens, r.input_tokens, r.output_tokens,
           r.cache_creation_tokens, r.cache_read_tokens
    FROM raw r
    WHERE r.n_rows > 1
  ),
  merged AS (
    SELECT DISTINCT ON (c.user_key, c.date) c.*
    FROM candidates c
    ORDER BY c.user_key, c.date, c.cost DESC, c.tokens DESC
  ),
  merged_agents AS (
    SELECT r.user_key, r.date, array_agg(DISTINCT a.agent) AS agents
    FROM raw r
    CROSS JOIN LATERAL unnest(r.agents) AS a(agent)
    WHERE r.n_rows > 1
    GROUP BY r.user_key, r.date
  ),
  merged_models AS (
    SELECT DISTINCT ON (r.user_key, r.date) r.user_key, r.date, r.model_breakdowns
    FROM raw r
    WHERE r.n_rows > 1
    ORDER BY r.user_key, r.date, r.cost DESC, r.tokens DESC
  )
  SELECT s.user_key, s.date, s.cost, s.tokens, s.input_tokens, s.output_tokens,
         s.cache_creation_tokens, s.cache_read_tokens, s.agents, s.model_breakdowns
  FROM single s
  UNION ALL
  SELECT m.user_key, m.date, m.cost, m.tokens, m.input_tokens, m.output_tokens,
         m.cache_creation_tokens, m.cache_read_tokens,
         COALESCE(a.agents, '{}'), mm.model_breakdowns
  FROM merged m
  LEFT JOIN merged_agents a ON a.user_key = m.user_key AND a.date = m.date
  LEFT JOIN merged_models mm ON mm.user_key = m.user_key AND mm.date = m.date;
END;
$$;

-- ============================================================================
-- PUBLIC: per-developer totals for a window
-- ============================================================================
-- Returns { total, developers, cost, tokens, rows: [...] }.
--   p_from / p_to   inclusive dates; NULL for an open end (lifetime).
--   p_tool          tool slug (ccusage agent name) or NULL.
--   p_sort          'cost' | 'tokens' | 'efficiency' (anything else = cost).
--                   Efficiency uses the volume-weighted score of migration 020
--                   and leaves out rows under the $100 floor, like the board.
--   p_with_days     include per-day [date, cost, tokens, input, output,
--                   cacheCreation, cacheRead] arrays.
--   p_history_from  include activeWeeks: Mondays of weeks with usage from this
--                   date to p_to (for streaks).
--   p_limit/offset  page of rows (NULL limit = all); total counts every row.
--   p_verified_only only developers with a verified row (the board's filter).
-- Each row: userKey, username (GitHub login when known), avatarUrl,
-- submissionId, verified, source, submittedAt, reviewReasons, tools (seen in the window),
-- cost, tokens, inputTokens, outputTokens, cacheCreationTokens,
-- cacheReadTokens, activeDays, firstDate, lastDate, days?, activeWeeks?.

CREATE OR REPLACE FUNCTION v2_window_totals(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_tool TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'cost',
  p_with_days BOOLEAN DEFAULT FALSE,
  p_history_from DATE DEFAULT NULL,
  p_limit INTEGER DEFAULT NULL,
  p_offset INTEGER DEFAULT 0,
  p_verified_only BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH days AS (
    SELECT * FROM v2_day_rows(p_from, p_to, NULLIF(lower(trim(p_tool)), ''), NULL)
  ),
  per_user AS (
    SELECT d.user_key,
           sum(d.cost) AS cost,
           sum(d.tokens)::BIGINT AS tokens,
           sum(d.input_tokens)::BIGINT AS input_tokens,
           sum(d.output_tokens)::BIGINT AS output_tokens,
           sum(d.cache_creation_tokens)::BIGINT AS cache_creation_tokens,
           sum(d.cache_read_tokens)::BIGINT AS cache_read_tokens,
           count(*) FILTER (WHERE d.cost > 0 OR d.tokens > 0) AS active_days,
           min(d.date) AS first_date,
           max(d.date) AS last_date
    FROM days d
    GROUP BY d.user_key
    HAVING sum(d.cost) > 0 OR sum(d.tokens) > 0
  ),
  window_tools AS (
    SELECT d.user_key, array_agg(DISTINCT a.agent ORDER BY a.agent) AS tools
    FROM days d
    CROSS JOIN LATERAL unnest(d.agents) AS a(agent)
    GROUP BY d.user_key
  ),
  kept AS (
    SELECT * FROM v2_kept_submissions()
  ),
  -- Display identity: the verified row first, then the most expensive.
  ident AS (
    SELECT DISTINCT ON (k.user_key)
           k.user_key, k.id AS submission_id,
           COALESCE(NULLIF(k.github_username, ''), k.username) AS username,
           k.github_avatar AS avatar_url, k.verified, k.source, k.tools AS lifetime_tools,
           k.submitted_at
    FROM kept k
    ORDER BY k.user_key, k.verified DESC, k.total_cost DESC
  ),
  reviews AS (
    SELECT k.user_key, array_agg(DISTINCT r.reason) AS reasons
    FROM kept k
    CROSS JOIN LATERAL unnest(k.review_reasons) AS r(reason)
    GROUP BY k.user_key
  ),
  history AS (
    SELECT w.user_key, array_agg(w.week ORDER BY w.week) AS weeks
    FROM (
      SELECT DISTINCT h.user_key, date_trunc('week', h.date::TIMESTAMP)::DATE AS week
      -- 'infinity' skips the scan entirely when no history was asked for.
      FROM v2_day_rows(COALESCE(p_history_from, 'infinity'::DATE), p_to, NULL, NULL) h
      WHERE h.cost > 0 OR h.tokens > 0
    ) w
    GROUP BY w.user_key
  ),
  day_series AS (
    SELECT d.user_key,
           jsonb_agg(jsonb_build_array(
             d.date, round(d.cost, 4), d.tokens, d.input_tokens, d.output_tokens,
             d.cache_creation_tokens, d.cache_read_tokens
           ) ORDER BY d.date) AS series
    FROM days d
    WHERE p_with_days
    GROUP BY d.user_key
  ),
  ordered AS (
    SELECT u.*, i.submission_id, i.username, i.avatar_url, i.verified, i.source, i.lifetime_tools,
           i.submitted_at,
           t.tools, rv.reasons, h.weeks, ds.series,
           CASE p_sort
             WHEN 'tokens' THEN u.tokens::NUMERIC
             WHEN 'efficiency' THEN (u.tokens + 1200000000)::NUMERIC / (u.cost + 1000)
             ELSE u.cost
           END AS sort_value
    FROM per_user u
    JOIN ident i ON i.user_key = u.user_key
    LEFT JOIN window_tools t ON t.user_key = u.user_key
    LEFT JOIN reviews rv ON rv.user_key = u.user_key
    LEFT JOIN history h ON h.user_key = u.user_key
    LEFT JOIN day_series ds ON ds.user_key = u.user_key
    WHERE (p_sort IS DISTINCT FROM 'efficiency' OR u.cost >= 100)
      AND (NOT COALESCE(p_verified_only, FALSE) OR i.verified)
  ),
  page AS (
    SELECT o.*
    FROM ordered o
    ORDER BY o.sort_value DESC, o.cost DESC, o.user_key
    LIMIT p_limit OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM ordered),
    'developers', (SELECT count(*) FROM per_user),
    'cost', COALESCE((SELECT round(sum(cost), 4) FROM per_user), 0),
    'tokens', COALESCE((SELECT sum(tokens) FROM per_user), 0),
    'rows', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'userKey', p.user_key,
        'username', p.username,
        'avatarUrl', p.avatar_url,
        'submissionId', p.submission_id,
        'verified', p.verified,
        'source', p.source,
        'submittedAt', p.submitted_at,
        'reviewReasons', COALESCE(to_jsonb(p.reasons), '[]'::JSONB),
        'tools', COALESCE(to_jsonb(p.tools), to_jsonb(p.lifetime_tools), '[]'::JSONB),
        'cost', round(p.cost, 4),
        'tokens', p.tokens,
        'inputTokens', p.input_tokens,
        'outputTokens', p.output_tokens,
        'cacheCreationTokens', p.cache_creation_tokens,
        'cacheReadTokens', p.cache_read_tokens,
        'activeDays', p.active_days,
        'firstDate', p.first_date,
        'lastDate', p.last_date,
        'days', p.series,
        'activeWeeks', to_jsonb(p.weeks)
      ) ORDER BY p.sort_value DESC, p.cost DESC, p.user_key)
      FROM page p
    ), '[]'::JSONB)
  );
$$;

-- ============================================================================
-- PUBLIC: one developer's days (recap, Wrapped, standing)
-- ============================================================================
-- Matches the handle on username or GitHub login, case aside; NULL when no
-- kept submission carries it. Days carry agents and per-model costs (model
-- names and costs only; never machine ids).

CREATE OR REPLACE FUNCTION v2_user_history(
  p_username TEXT,
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH kept AS (
    SELECT * FROM v2_kept_submissions()
  ),
  target AS (
    SELECT k.user_key
    FROM kept k
    WHERE k.user_key = lower(p_username) OR lower(k.github_username) = lower(p_username)
    ORDER BY (k.user_key = lower(p_username)) DESC, k.verified DESC, k.total_cost DESC
    LIMIT 1
  ),
  ident AS (
    SELECT k.user_key,
           COALESCE(NULLIF(k.github_username, ''), k.username) AS username,
           k.github_avatar AS avatar_url, k.verified, k.source
    FROM kept k
    WHERE k.user_key = (SELECT user_key FROM target)
    ORDER BY k.verified DESC, k.total_cost DESC
    LIMIT 1
  ),
  reasons AS (
    SELECT array_agg(DISTINCT r.reason) AS reasons
    FROM kept k
    CROSS JOIN LATERAL unnest(k.review_reasons) AS r(reason)
    WHERE k.user_key = (SELECT user_key FROM target)
  ),
  -- '' matches no username, so an unknown handle can't widen to everyone.
  days AS (
    SELECT * FROM v2_day_rows(p_from, p_to, NULL, COALESCE((SELECT user_key FROM target), ''))
  )
  SELECT CASE WHEN i.user_key IS NULL THEN NULL ELSE jsonb_build_object(
    'userKey', i.user_key,
    'username', i.username,
    'avatarUrl', i.avatar_url,
    'verified', i.verified,
    'source', i.source,
    'reviewReasons', COALESCE((SELECT to_jsonb(reasons) FROM reasons), '[]'::JSONB),
    'days', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'date', d.date,
        'cost', round(d.cost, 4),
        'tokens', d.tokens,
        'agents', to_jsonb(d.agents),
        'models', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'model', mb->>'modelName',
            'cost', COALESCE((mb->>'cost')::NUMERIC, 0)
          ))
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(d.model_breakdowns) = 'array' THEN d.model_breakdowns ELSE '[]'::JSONB END
          ) mb
          WHERE mb->>'modelName' IS NOT NULL
        ), '[]'::JSONB)
      ) ORDER BY d.date)
      FROM days d
      WHERE d.cost > 0 OR d.tokens > 0
    ), '[]'::JSONB)
  ) END
  -- Always one row: NULL for an unknown handle.
  FROM (SELECT 1) AS one
  LEFT JOIN ident i ON TRUE;
$$;

-- ============================================================================
-- FROZEN WEEKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS v2_weeks (
  week_start DATE PRIMARY KEY CHECK (extract(isodow FROM week_start) = 1),
  frozen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  developers INTEGER NOT NULL DEFAULT 0,
  tokens BIGINT NOT NULL DEFAULT 0,
  cost NUMERIC(14,4) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS v2_week_results (
  week_start DATE NOT NULL REFERENCES v2_weeks(week_start) ON DELETE CASCADE,
  user_key TEXT NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  cls TEXT NOT NULL CHECK (cls IN ('ranked', 'open', 'fleets')),
  -- Final rank in its class by cost; movement against the week before.
  rank INTEGER,
  movement INTEGER,
  cost NUMERIC(14,4) NOT NULL,
  tokens BIGINT NOT NULL,
  -- Cost per day, Monday first.
  days NUMERIC(14,4)[] NOT NULL,
  plan_eq DOUBLE PRECISION NOT NULL,
  trust TEXT NOT NULL CHECK (trust IN ('verified', 'claimed', 'unverified')),
  under_review BOOLEAN NOT NULL DEFAULT FALSE,
  held_reason TEXT,
  tools TEXT[] NOT NULL DEFAULT '{}',
  streak_weeks INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (week_start, user_key)
);

CREATE INDEX IF NOT EXISTS idx_v2_week_results_user ON v2_week_results (user_key, week_start DESC);

ALTER TABLE v2_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_week_results ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'v2_weeks' AND policyname = 'Public read v2_weeks') THEN
    CREATE POLICY "Public read v2_weeks" ON v2_weeks FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'v2_week_results' AND policyname = 'Public read v2_week_results') THEN
    CREATE POLICY "Public read v2_week_results" ON v2_week_results FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'v2_weeks' AND policyname = 'Service write v2_weeks') THEN
    CREATE POLICY "Service write v2_weeks" ON v2_weeks FOR ALL USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'v2_week_results' AND policyname = 'Service write v2_week_results') THEN
    CREATE POLICY "Service write v2_week_results" ON v2_week_results FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Store a frozen week in one transaction: the marker and its rows land
-- together or not at all, and the first store wins (a concurrent second
-- store returns false and writes nothing). Refuses weeks still inside their
-- grace period; the 12 hours must match WEEK_GRACE_HOURS in src/lib/v2/contract.ts.
CREATE OR REPLACE FUNCTION v2_store_week(p_week JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start DATE := (p_week->>'weekStart')::DATE;
  v_inserted INTEGER;
BEGIN
  IF v_start IS NULL OR extract(isodow FROM v_start) <> 1 THEN
    RAISE EXCEPTION 'weekStart must be a Monday, got %', p_week->>'weekStart';
  END IF;
  IF now() < ((v_start + 7)::TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '12 hours' THEN
    RAISE EXCEPTION 'week of % is still inside its grace period', v_start;
  END IF;

  INSERT INTO v2_weeks (week_start, frozen_at, developers, tokens, cost)
  VALUES (
    v_start,
    now(),
    COALESCE((p_week->'totals'->>'developers')::INTEGER, 0),
    COALESCE((p_week->'totals'->>'tokens')::BIGINT, 0),
    COALESCE((p_week->'totals'->>'cost')::NUMERIC, 0)
  )
  ON CONFLICT (week_start) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO v2_week_results (
    week_start, user_key, username, avatar_url, cls, rank, movement, cost, tokens,
    days, plan_eq, trust, under_review, held_reason, tools, streak_weeks
  )
  SELECT v_start, e."userKey", e.username, e."avatarUrl", e.cls, e.rank, e.movement,
         e.cost, e.tokens, e.days, e."planEq", e.trust, COALESCE(e."underReview", FALSE),
         e."heldReason", COALESCE(e.tools, '{}'), COALESCE(e."streakWeeks", 0)
  FROM jsonb_to_recordset(COALESCE(p_week->'entries', '[]'::JSONB)) AS e(
    "userKey" TEXT, username TEXT, "avatarUrl" TEXT, cls TEXT, rank INTEGER, movement INTEGER,
    cost NUMERIC, tokens BIGINT, days NUMERIC[], "planEq" DOUBLE PRECISION, trust TEXT,
    "underReview" BOOLEAN, "heldReason" TEXT, tools TEXT[], "streakWeeks" INTEGER
  );
  RETURN TRUE;
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================
-- Functions are executable by PUBLIC by default. The internal helpers and the
-- writer are not part of the public API.

REVOKE EXECUTE ON FUNCTION v2_kept_submissions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION v2_day_rows(DATE, DATE, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION v2_store_week(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION v2_kept_submissions() TO service_role;
GRANT EXECUTE ON FUNCTION v2_day_rows(DATE, DATE, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION v2_store_week(JSONB) TO service_role;

GRANT EXECUTE ON FUNCTION v2_window_totals(DATE, DATE, TEXT, TEXT, BOOLEAN, DATE, INTEGER, INTEGER, BOOLEAN)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION v2_user_history(TEXT, DATE, DATE) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
