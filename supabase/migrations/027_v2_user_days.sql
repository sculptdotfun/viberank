-- Migration 027: deduplicate each developer's days once, at write time.
--
-- 024/026 merge every developer's daily_breakdowns on every board read. 027
-- stores the merged result in v2_user_days and keeps it current from
-- triggers on submissions and daily_breakdowns, so a board is a plain
-- indexed sum over one narrow table, cold, for any window and tool.
--
-- What a row holds. tool_key '' is the developer's merged day, exactly what
-- v2_day_rows(from, to, NULL, user) returns for it. A tool board filters
-- the raw rows before merging (024: a row counts for a tool when its agents
-- include it, or it has no agents and its submission's tools do), which
-- only changes the result on days held by more than one row ("multi"; 184
-- on production). For those days the tool-filtered merge is stored too,
-- one row per tool (tool_key = the tool). A tool board therefore reads:
--   tool_key = ''   AND NOT multi AND match_tools @> {tool}   (single-row days)
--   tool_key = tool                                         (multi-row days)
-- which is, row for row, what v2_day_rows(from, to, tool, NULL) computes.
-- match_tools is the row's agents, or its submission's tools when it has no
-- agents: the 024 tool rule, precomputed.
--
-- Freshness. Statement-level triggers collect the developer keys a write
-- touched (old and new lower(username), so renames, merges, claims, flags,
-- deletes and review changes are all covered) and recompute just those
-- developers in the same transaction. A submit that writes 300 days is one
-- statement and one refresh. Refreshes of one developer are serialised by
-- an advisory lock. Nothing in the app changes: the write paths stay as
-- they are, and the triggers see every path, including admin scripts.

-- ============================================================================
-- TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS v2_user_days (
  user_key TEXT NOT NULL,
  tool_key TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL,
  cost NUMERIC,
  tokens BIGINT,
  input_tokens BIGINT,
  output_tokens BIGINT,
  cache_creation_tokens BIGINT,
  cache_read_tokens BIGINT,
  agents TEXT[] NOT NULL DEFAULT '{}',
  match_tools TEXT[] NOT NULL DEFAULT '{}',
  multi BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_key, tool_key, date)
);

CREATE INDEX IF NOT EXISTS idx_v2_user_days_tool_date ON v2_user_days (tool_key, date);

-- Read only through the SECURITY DEFINER functions below.
ALTER TABLE v2_user_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON v2_user_days FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- COMPUTE: the merged days for a set of developers (NULL = everyone)
-- ============================================================================
-- The merge rules are 024's (v2_day_rows), applied per group: a group is
-- (developer, date, '') over all of the day's rows, or (developer, date,
-- tool) over the rows of a multi-row day that count for that tool.

CREATE OR REPLACE FUNCTION v2_compute_user_days(p_keys TEXT[])
RETURNS TABLE (
  user_key TEXT,
  tool_key TEXT,
  date DATE,
  cost NUMERIC,
  tokens BIGINT,
  input_tokens BIGINT,
  output_tokens BIGINT,
  cache_creation_tokens BIGINT,
  cache_read_tokens BIGINT,
  agents TEXT[],
  match_tools TEXT[],
  multi BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET plan_cache_mode = force_custom_plan
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH kept AS (
    SELECT k.id, k.user_key, k.tools
    FROM v2_kept_submissions() k
    WHERE p_keys IS NULL OR k.user_key = ANY (p_keys)
  ),
  raw AS (
    SELECT d.id AS row_id, k.user_key, d.date,
           d.total_cost::NUMERIC AS cost, d.total_tokens AS tokens,
           d.input_tokens, d.output_tokens, d.cache_creation_tokens, d.cache_read_tokens,
           COALESCE(d.agents, '{}') AS agents,
           CASE WHEN cardinality(COALESCE(d.agents, '{}')) > 0 THEN d.agents ELSE COALESCE(k.tools, '{}') END AS match_tools,
           count(*) OVER (PARTITION BY k.user_key, d.date) AS n_rows
    FROM daily_breakdowns d
    JOIN kept k ON k.id = d.submission_id
  ),
  members AS (
    SELECT r.*, ''::TEXT AS tool_key FROM raw r
    UNION ALL
    SELECT r.*, t.tool
    FROM raw r
    CROSS JOIN LATERAL (SELECT DISTINCT u AS tool FROM unnest(r.match_tools) AS u WHERE u IS NOT NULL) t
    WHERE r.n_rows > 1
  ),
  grouped AS (
    SELECT m.*, count(*) OVER (PARTITION BY m.user_key, m.date, m.tool_key) AS g_rows
    FROM members m
  ),
  -- Groups of more than one row: open their per-machine maps by primary key.
  dup AS (
    SELECT g.*, d.machine_contributions
    FROM grouped g
    JOIN daily_breakdowns d ON d.id = g.row_id
    WHERE g.g_rows > 1
  ),
  slices AS (
    SELECT r.user_key, r.date, r.tool_key, m.key AS machine,
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
    SELECT DISTINCT ON (s.user_key, s.date, s.tool_key, s.machine) s.*
    FROM slices s
    ORDER BY s.user_key, s.date, s.tool_key, s.machine, s.cost DESC, s.tokens DESC
  ),
  candidates AS (
    SELECT b.user_key, b.date, b.tool_key, sum(b.cost) AS cost, sum(b.tokens)::BIGINT AS tokens,
           sum(b.input_tokens)::BIGINT AS input_tokens, sum(b.output_tokens)::BIGINT AS output_tokens,
           sum(b.cache_creation_tokens)::BIGINT AS cache_creation_tokens,
           sum(b.cache_read_tokens)::BIGINT AS cache_read_tokens
    FROM best b
    WHERE b.machine <> 'default'
    GROUP BY b.user_key, b.date, b.tool_key
    UNION ALL
    SELECT b.user_key, b.date, b.tool_key, b.cost, b.tokens, b.input_tokens, b.output_tokens,
           b.cache_creation_tokens, b.cache_read_tokens
    FROM best b
    WHERE b.machine = 'default'
    UNION ALL
    SELECT r.user_key, r.date, r.tool_key, r.cost, r.tokens, r.input_tokens, r.output_tokens,
           r.cache_creation_tokens, r.cache_read_tokens
    FROM dup r
  ),
  merged AS (
    SELECT DISTINCT ON (c.user_key, c.date, c.tool_key) c.*
    FROM candidates c
    ORDER BY c.user_key, c.date, c.tool_key, c.cost DESC, c.tokens DESC
  ),
  merged_agents AS (
    SELECT r.user_key, r.date, r.tool_key, array_agg(DISTINCT a.agent) AS agents
    FROM dup r
    CROSS JOIN LATERAL unnest(r.agents) AS a(agent)
    GROUP BY r.user_key, r.date, r.tool_key
  ),
  merged_tools AS (
    SELECT r.user_key, r.date, r.tool_key, array_agg(DISTINCT t.tool) AS tools
    FROM dup r
    CROSS JOIN LATERAL unnest(r.match_tools) AS t(tool)
    GROUP BY r.user_key, r.date, r.tool_key
  )
  SELECT g.user_key, g.tool_key, g.date, g.cost, g.tokens, g.input_tokens, g.output_tokens,
         g.cache_creation_tokens, g.cache_read_tokens, g.agents, g.match_tools, g.n_rows > 1
  FROM grouped g
  WHERE g.g_rows = 1
  UNION ALL
  SELECT m.user_key, m.tool_key, m.date, m.cost, m.tokens, m.input_tokens, m.output_tokens,
         m.cache_creation_tokens, m.cache_read_tokens, COALESCE(a.agents, '{}'), COALESCE(t.tools, '{}'), TRUE
  FROM merged m
  LEFT JOIN merged_agents a ON a.user_key = m.user_key AND a.date = m.date AND a.tool_key = m.tool_key
  LEFT JOIN merged_tools t ON t.user_key = m.user_key AND t.date = m.date AND t.tool_key = m.tool_key;
END;
$$;

-- ============================================================================
-- LIFETIME: per developer and tool, the all-time sums of the rows above
-- ============================================================================
-- An all-time board summed ~96k day rows on every read (~0.5 s even from
-- v2_user_days). These are those sums, kept by the same refresh: tool_key ''
-- is everything, tool_key t is the developer's tool-t board (the same row
-- selection v2_window_totals makes). weeks is every week with usage, for
-- streaks. Columns match v2_window_totals' per-developer aggregate exactly.

CREATE TABLE IF NOT EXISTS v2_user_totals (
  user_key TEXT NOT NULL,
  tool_key TEXT NOT NULL DEFAULT '',
  cost NUMERIC,
  tokens BIGINT,
  input_tokens BIGINT,
  output_tokens BIGINT,
  cache_creation_tokens BIGINT,
  cache_read_tokens BIGINT,
  active_days BIGINT NOT NULL,
  first_date DATE,
  last_date DATE,
  tools TEXT[],
  weeks DATE[],
  PRIMARY KEY (tool_key, user_key)
);

ALTER TABLE v2_user_totals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON v2_user_totals FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION v2_compute_user_totals(p_keys TEXT[])
RETURNS SETOF v2_user_totals
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH rows_by_tool AS (
    SELECT u.*, ''::TEXT AS tk
    FROM v2_user_days u
    WHERE u.tool_key = '' AND (p_keys IS NULL OR u.user_key = ANY (p_keys))
    UNION ALL
    SELECT u.*, t.tool
    FROM v2_user_days u
    CROSS JOIN LATERAL (SELECT DISTINCT x AS tool FROM unnest(u.match_tools) AS x WHERE x IS NOT NULL) t
    WHERE u.tool_key = '' AND NOT u.multi AND (p_keys IS NULL OR u.user_key = ANY (p_keys))
    UNION ALL
    SELECT u.*, u.tool_key
    FROM v2_user_days u
    WHERE u.tool_key <> '' AND (p_keys IS NULL OR u.user_key = ANY (p_keys))
  ),
  sums AS (
    SELECT r.user_key, r.tk,
           sum(r.cost) AS cost,
           sum(r.tokens)::BIGINT AS tokens,
           sum(r.input_tokens)::BIGINT AS input_tokens,
           sum(r.output_tokens)::BIGINT AS output_tokens,
           sum(r.cache_creation_tokens)::BIGINT AS cache_creation_tokens,
           sum(r.cache_read_tokens)::BIGINT AS cache_read_tokens,
           count(*) FILTER (WHERE r.cost > 0 OR r.tokens > 0) AS active_days,
           min(r.date) AS first_date,
           max(r.date) AS last_date
    FROM rows_by_tool r
    GROUP BY r.user_key, r.tk
  ),
  tools AS (
    SELECT r.user_key, r.tk, array_agg(DISTINCT a.agent ORDER BY a.agent) AS tools
    FROM rows_by_tool r
    CROSS JOIN LATERAL unnest(r.agents) AS a(agent)
    GROUP BY r.user_key, r.tk
  ),
  weeks AS (
    SELECT w.user_key, array_agg(w.week ORDER BY w.week) AS weeks
    FROM (
      SELECT DISTINCT r.user_key, date_trunc('week', r.date::TIMESTAMP)::DATE AS week
      FROM rows_by_tool r
      WHERE r.tk = '' AND (r.cost > 0 OR r.tokens > 0)
    ) w
    GROUP BY w.user_key
  )
  SELECT s.user_key, s.tk, s.cost, s.tokens, s.input_tokens, s.output_tokens, s.cache_creation_tokens,
         s.cache_read_tokens, s.active_days, s.first_date, s.last_date, t.tools,
         CASE WHEN s.tk = '' THEN w.weeks END
  FROM sums s
  LEFT JOIN tools t ON t.user_key = s.user_key AND t.tk = s.tk
  LEFT JOIN weeks w ON w.user_key = s.user_key;
$$;

-- ============================================================================
-- REFRESH: recompute some developers' rows (NULL keys are ignored)
-- ============================================================================

CREATE OR REPLACE FUNCTION v2_refresh_users(p_keys TEXT[])
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keys TEXT[];
  v_key TEXT;
BEGIN
  SELECT array_agg(DISTINCT x ORDER BY x) INTO v_keys FROM unnest(p_keys) AS x WHERE x IS NOT NULL;
  IF v_keys IS NULL THEN
    RETURN;
  END IF;
  -- One refresh per developer at a time; sorted, so two writers never deadlock.
  FOREACH v_key IN ARRAY v_keys LOOP
    PERFORM pg_advisory_xact_lock(hashtext('v2_user_days'), hashtext(v_key));
  END LOOP;
  DELETE FROM v2_user_days u WHERE u.user_key = ANY (v_keys);
  INSERT INTO v2_user_days (user_key, tool_key, date, cost, tokens, input_tokens, output_tokens,
                            cache_creation_tokens, cache_read_tokens, agents, match_tools, multi)
  SELECT c.user_key, c.tool_key, c.date, c.cost, c.tokens, c.input_tokens, c.output_tokens,
         c.cache_creation_tokens, c.cache_read_tokens, c.agents, c.match_tools, c.multi
  FROM v2_compute_user_days(v_keys) c;
  DELETE FROM v2_user_totals t WHERE t.user_key = ANY (v_keys);
  INSERT INTO v2_user_totals SELECT * FROM v2_compute_user_totals(v_keys);
END;
$$;

-- ============================================================================
-- TRIGGERS: statement level, one per event (transition tables allow one)
-- ============================================================================

CREATE OR REPLACE FUNCTION v2_user_days_on_submissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keys TEXT[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT array_agg(lower(n.username)) INTO v_keys FROM new_rows n;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT array_agg(lower(o.username)) INTO v_keys FROM old_rows o;
  ELSE
    SELECT array_agg(k) INTO v_keys FROM (
      SELECT lower(n.username) AS k FROM new_rows n
      UNION SELECT lower(o.username) FROM old_rows o
    ) x;
  END IF;
  PERFORM v2_refresh_users(v_keys);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION v2_user_days_on_days()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keys TEXT[];
BEGIN
  -- A day row whose submission is gone (a cascading delete) is covered by
  -- the submissions trigger, which runs after the cascade.
  IF TG_OP = 'INSERT' THEN
    SELECT array_agg(DISTINCT lower(s.username)) INTO v_keys
    FROM new_rows n JOIN submissions s ON s.id = n.submission_id;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT array_agg(DISTINCT lower(s.username)) INTO v_keys
    FROM old_rows o JOIN submissions s ON s.id = o.submission_id;
  ELSE
    SELECT array_agg(DISTINCT lower(s.username)) INTO v_keys
    FROM (SELECT n.submission_id FROM new_rows n UNION SELECT o.submission_id FROM old_rows o) x
    JOIN submissions s ON s.id = x.submission_id;
  END IF;
  PERFORM v2_refresh_users(v_keys);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS v2_user_days_submissions_ins ON submissions;
DROP TRIGGER IF EXISTS v2_user_days_submissions_upd ON submissions;
DROP TRIGGER IF EXISTS v2_user_days_submissions_del ON submissions;
DROP TRIGGER IF EXISTS v2_user_days_days_ins ON daily_breakdowns;
DROP TRIGGER IF EXISTS v2_user_days_days_upd ON daily_breakdowns;
DROP TRIGGER IF EXISTS v2_user_days_days_del ON daily_breakdowns;

CREATE TRIGGER v2_user_days_submissions_ins AFTER INSERT ON submissions
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION v2_user_days_on_submissions();
CREATE TRIGGER v2_user_days_submissions_upd AFTER UPDATE ON submissions
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION v2_user_days_on_submissions();
CREATE TRIGGER v2_user_days_submissions_del AFTER DELETE ON submissions
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION v2_user_days_on_submissions();
CREATE TRIGGER v2_user_days_days_ins AFTER INSERT ON daily_breakdowns
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION v2_user_days_on_days();
CREATE TRIGGER v2_user_days_days_upd AFTER UPDATE ON daily_breakdowns
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION v2_user_days_on_days();
CREATE TRIGGER v2_user_days_days_del AFTER DELETE ON daily_breakdowns
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION v2_user_days_on_days();

-- ============================================================================
-- BACKFILL (everyone, once; re-running the migration rebuilds it)
-- ============================================================================

-- One block, so the rebuild is atomic even when the file runs outside a
-- transaction. Writes to submissions wait on their trigger's refresh, which
-- waits on this lock, so no refresh interleaves with the rebuild.
DO $$
BEGIN
  LOCK TABLE v2_user_days, v2_user_totals IN EXCLUSIVE MODE;
  DELETE FROM v2_user_days;
  INSERT INTO v2_user_days (user_key, tool_key, date, cost, tokens, input_tokens, output_tokens,
                            cache_creation_tokens, cache_read_tokens, agents, match_tools, multi)
  SELECT c.user_key, c.tool_key, c.date, c.cost, c.tokens, c.input_tokens, c.output_tokens,
         c.cache_creation_tokens, c.cache_read_tokens, c.agents, c.match_tools, c.multi
  FROM v2_compute_user_days(NULL) c;
  DELETE FROM v2_user_totals;
  INSERT INTO v2_user_totals SELECT * FROM v2_compute_user_totals(NULL);
END $$;
ANALYZE v2_user_days;
ANALYZE v2_user_totals;

-- ============================================================================
-- READ: the window totals over the rollup
-- ============================================================================
-- Same signature, arguments and output as 024/026.

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
  WITH args AS (
    SELECT NULLIF(lower(trim(p_tool)), '') AS tool,
           -- All-time reads the stored lifetime sums instead of the days.
           (p_from IS NULL AND p_to IS NULL) AS lifetime,
           -- Stored weeks answer the streak history exactly when the range
           -- is whole weeks: from a Monday, to a Sunday or open.
           (p_history_from IS NOT NULL AND extract(isodow FROM p_history_from) = 1
             AND (p_to IS NULL OR extract(isodow FROM p_to) = 7)) AS whole_weeks
  ),
  days AS (
    SELECT u.user_key, u.date, u.cost, u.tokens, u.input_tokens, u.output_tokens,
           u.cache_creation_tokens, u.cache_read_tokens, u.agents
    FROM v2_user_days u, args a
    WHERE (NOT a.lifetime OR p_with_days)
      AND (p_from IS NULL OR u.date >= p_from)
      AND (p_to IS NULL OR u.date <= p_to)
      AND (
        (a.tool IS NULL AND u.tool_key = '')
        OR (a.tool IS NOT NULL AND u.tool_key = '' AND NOT u.multi AND u.match_tools @> ARRAY[a.tool])
        OR (a.tool IS NOT NULL AND u.tool_key = a.tool)
      )
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
    FROM days d, args a
    WHERE NOT a.lifetime
    GROUP BY d.user_key
    HAVING sum(d.cost) > 0 OR sum(d.tokens) > 0
    UNION ALL
    SELECT t.user_key, t.cost, t.tokens, t.input_tokens, t.output_tokens, t.cache_creation_tokens,
           t.cache_read_tokens, t.active_days, t.first_date, t.last_date
    FROM v2_user_totals t, args a
    WHERE a.lifetime
      AND t.tool_key = COALESCE(a.tool, '')
      AND (t.cost > 0 OR t.tokens > 0)
  ),
  window_tools AS (
    SELECT d.user_key, array_agg(DISTINCT x.agent ORDER BY x.agent) AS tools
    FROM days d
    CROSS JOIN args a
    CROSS JOIN LATERAL unnest(d.agents) AS x(agent)
    WHERE NOT a.lifetime
    GROUP BY d.user_key
    UNION ALL
    SELECT t.user_key, t.tools
    FROM v2_user_totals t, args a
    WHERE a.lifetime AND t.tool_key = COALESCE(a.tool, '') AND t.tools IS NOT NULL
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
  -- Weeks with usage, from the merged days, for the window's developers.
  history AS (
    SELECT w.user_key, array_agg(w.week ORDER BY w.week) AS weeks
    FROM (
      SELECT DISTINCT u.user_key, date_trunc('week', u.date::TIMESTAMP)::DATE AS week
      FROM v2_user_days u
      JOIN per_user p ON p.user_key = u.user_key
      CROSS JOIN args a
      WHERE p_history_from IS NOT NULL
        AND NOT a.whole_weeks
        AND u.tool_key = ''
        AND u.date >= p_history_from
        AND (p_to IS NULL OR u.date <= p_to)
        AND (u.cost > 0 OR u.tokens > 0)
    ) w
    GROUP BY w.user_key
    UNION ALL
    SELECT t.user_key, x.weeks
    FROM per_user p
    JOIN v2_user_totals t ON t.tool_key = '' AND t.user_key = p.user_key
    CROSS JOIN args a
    CROSS JOIN LATERAL (
      SELECT array_agg(wk ORDER BY wk) AS weeks
      FROM unnest(t.weeks) AS wk
      WHERE wk >= p_history_from AND (p_to IS NULL OR wk <= p_to)
    ) x
    WHERE a.whole_weeks AND x.weeks IS NOT NULL
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
-- GRANTS
-- ============================================================================

REVOKE EXECUTE ON FUNCTION v2_compute_user_days(TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION v2_refresh_users(TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION v2_user_days_on_submissions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION v2_user_days_on_days() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION v2_compute_user_days(TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION v2_refresh_users(TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION v2_window_totals(DATE, DATE, TEXT, TEXT, BOOLEAN, DATE, INTEGER, INTEGER, BOOLEAN)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
