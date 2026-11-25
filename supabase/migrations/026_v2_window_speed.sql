-- Migration 026: make v2_window_totals fast enough to serve a page.
--
-- On production (96k daily rows) the week board's call took 4-5 s and the
-- lifetime board's 6-7 s, so a few concurrent renders (a deploy prerendering
-- /, /week, /fleets and every /tool page at once) pushed calls past
-- PostgREST's 8 s statement_timeout and the home showed "Could not load this
-- board". Two causes, both in how 024 reads days, not in what it returns:
--
--   1. v2_day_rows carries model_breakdowns and machine_contributions (JSONB,
--      ~1 KB a row, mostly TOASTed) through its window sort and its result
--      set, for every day in range. The window totals never read either: the
--      lifetime scan spilled ~80 MB to disk to sort columns it threw away.
--   2. The streak history (activeWeeks) re-ran that full v2_day_rows over two
--      years for every developer, even when the window held 150 of them.
--
-- v2_day_totals is v2_day_rows without the JSONB: it carries the row id and
-- opens machine_contributions only for the few (developer, date) pairs held
-- by more than one row (184 on production). Its results are the same as
-- v2_day_rows' for every column it returns; the dedupe rules of 024 are
-- unchanged. activeWeeks is read straight from daily_breakdowns for the
-- window's developers only: a week counts when any kept row has a day with
-- cost or tokens in it, which is exactly when 024's merged day does (a merge
-- is never below its largest row).
--
-- v2_user_history keeps v2_day_rows: it needs model_breakdowns and reads one
-- developer.

CREATE OR REPLACE FUNCTION v2_day_totals(
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
  agents TEXT[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET plan_cache_mode = force_custom_plan
AS $$
#variable_conflict use_column
BEGIN
  -- plpgsql with custom plans for the same reason as v2_day_rows (024).
  RETURN QUERY
  WITH kept AS (
    SELECT k.id, k.user_key, k.tools
    FROM v2_kept_submissions() k
    WHERE p_user_key IS NULL OR k.user_key = p_user_key
  ),
  raw AS (
    SELECT d.id AS row_id, k.user_key, d.date,
           d.total_cost::NUMERIC AS cost, d.total_tokens AS tokens,
           d.input_tokens, d.output_tokens, d.cache_creation_tokens, d.cache_read_tokens,
           COALESCE(d.agents, '{}') AS agents,
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
  -- Legacy duplicates only: fetch their per-machine maps by primary key.
  dup AS (
    SELECT r.*, d.machine_contributions
    FROM raw r
    JOIN daily_breakdowns d ON d.id = r.row_id
    WHERE r.n_rows > 1
  ),
  slices AS (
    SELECT r.user_key, r.date, m.key AS machine,
           COALESCE((m.value->>'totalCost')::NUMERIC, 0) AS cost,
           COALESCE((m.value->>'totalTokens')::BIGINT, 0) AS tokens,
           COALESCE((m.value->>'inputTokens')::BIGINT, 0) AS input_tokens,
           COALESCE((m.value->>'outputTokens')::BIGINT, 0) AS output_tokens,
           COALESCE((m.value->>'cacheCreationTokens')::BIGINT, 0) AS cache_creation_tokens,
           COALESCE((m.value->>'cacheReadTokens')::BIGINT, 0) AS cache_read_tokens
    FROM dup r
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
  ),
  best AS (
    SELECT DISTINCT ON (s.user_key, s.date, s.machine) s.*
    FROM slices s
    ORDER BY s.user_key, s.date, s.machine, s.cost DESC, s.tokens DESC
  ),
  candidates AS (
    SELECT b.user_key, b.date, sum(b.cost) AS cost, sum(b.tokens)::BIGINT AS tokens,
           sum(b.input_tokens)::BIGINT AS input_tokens, sum(b.output_tokens)::BIGINT AS output_tokens,
           sum(b.cache_creation_tokens)::BIGINT AS cache_creation_tokens,
           sum(b.cache_read_tokens)::BIGINT AS cache_read_tokens
    FROM best b
    WHERE b.machine <> 'default'
    GROUP BY b.user_key, b.date
    UNION ALL
    SELECT b.user_key, b.date, b.cost, b.tokens, b.input_tokens, b.output_tokens,
           b.cache_creation_tokens, b.cache_read_tokens
    FROM best b
    WHERE b.machine = 'default'
    UNION ALL
    SELECT r.user_key, r.date, r.cost, r.tokens, r.input_tokens, r.output_tokens,
           r.cache_creation_tokens, r.cache_read_tokens
    FROM dup r
  ),
  merged AS (
    SELECT DISTINCT ON (c.user_key, c.date) c.*
    FROM candidates c
    ORDER BY c.user_key, c.date, c.cost DESC, c.tokens DESC
  ),
  merged_agents AS (
    SELECT r.user_key, r.date, array_agg(DISTINCT a.agent) AS agents
    FROM dup r
    CROSS JOIN LATERAL unnest(r.agents) AS a(agent)
    GROUP BY r.user_key, r.date
  )
  SELECT r.user_key, r.date, r.cost, r.tokens, r.input_tokens, r.output_tokens,
         r.cache_creation_tokens, r.cache_read_tokens, r.agents
  FROM raw r
  WHERE r.n_rows = 1
  UNION ALL
  SELECT m.user_key, m.date, m.cost, m.tokens, m.input_tokens, m.output_tokens,
         m.cache_creation_tokens, m.cache_read_tokens, COALESCE(a.agents, '{}')
  FROM merged m
  LEFT JOIN merged_agents a ON a.user_key = m.user_key AND a.date = m.date;
END;
$$;

-- Same signature, arguments and result shape as 024; only the reads change.
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
    SELECT * FROM v2_day_totals(p_from, p_to, NULLIF(lower(trim(p_tool)), ''), NULL)
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
  -- Weeks with usage, for the window's developers only, from the narrow
  -- columns. A merged day has usage exactly when one of its rows does.
  history AS (
    SELECT w.user_key, array_agg(w.week ORDER BY w.week) AS weeks
    FROM (
      SELECT DISTINCT k.user_key, date_trunc('week', d.date::TIMESTAMP)::DATE AS week
      FROM per_user u
      JOIN kept k ON k.user_key = u.user_key
      JOIN daily_breakdowns d ON d.submission_id = k.id
      WHERE p_history_from IS NOT NULL
        AND d.date >= p_history_from
        AND (p_to IS NULL OR d.date <= p_to)
        AND (d.total_cost > 0 OR d.total_tokens > 0)
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

REVOKE EXECUTE ON FUNCTION v2_day_totals(DATE, DATE, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION v2_day_totals(DATE, DATE, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION v2_window_totals(DATE, DATE, TEXT, TEXT, BOOLEAN, DATE, INTEGER, INTEGER, BOOLEAN)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
