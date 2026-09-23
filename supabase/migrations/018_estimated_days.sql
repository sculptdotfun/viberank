-- Migration 018: mark reconstructed days, and keep them out of the reports.
--
-- #138: Claude Code deletes transcripts after cleanupPeriodDays (30 by
-- default), so history older than that can't be re-read by ccusage. One user
-- rebuilt 2026-04-13 -> 2026-07-25 from ~/.claude/stats-cache.json: the window
-- totals are Claude Code's own counters, but the per-day split is an
-- allocation, not a measurement. That's fair on a profile and the board (the
-- tokens were really spent), but the monthly reports publish medians, p90s and
-- per-model splits as measured figures, and an allocated day would quietly
-- become part of them.
--
-- So days carry an `estimated` flag, get_month_stats skips them, and
-- everything else (board, profile, wrapped) keeps counting them. The flag is
-- not in the anon column grant from 017; nothing public reads it yet.

ALTER TABLE daily_breakdowns
  ADD COLUMN IF NOT EXISTS estimated BOOLEAN NOT NULL DEFAULT FALSE;

-- The reconstructed windows described in #138 (submission 4940e8c3). Days in
-- that range carry only the unattributed slice the cURL upload wrote.
UPDATE daily_breakdowns
SET estimated = TRUE
WHERE submission_id = '4940e8c3-7ad4-4185-a1d3-9ee9ab3910da'
  AND date BETWEEN '2026-04-13' AND '2026-07-25';

CREATE OR REPLACE FUNCTION get_month_stats(p_month TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH month_days AS (
    SELECT d.date,
           d.total_cost,
           d.total_tokens,
           d.input_tokens,
           d.output_tokens,
           d.cache_read_tokens,
           d.cache_creation_tokens,
           d.agents,
           d.model_breakdowns,
           s.username
    FROM daily_breakdowns d
    JOIN submissions s ON s.id = d.submission_id
    WHERE s.flagged_for_review IS NOT TRUE
      AND d.estimated IS NOT TRUE
      AND p_month ~ '^\d{4}-\d{2}$'
      AND to_char(d.date, 'YYYY-MM') = p_month
  ),
  per_user AS (
    SELECT username,
           SUM(total_cost) AS cost,
           SUM(total_tokens) AS tokens,
           COUNT(DISTINCT date) AS active_days
    FROM month_days
    GROUP BY username
  )
  SELECT jsonb_build_object(
    'month', p_month,
    'cost', COALESCE((SELECT SUM(total_cost) FROM month_days), 0),
    'tokens', COALESCE((SELECT SUM(total_tokens) FROM month_days), 0),
    'outputTokens', COALESCE((SELECT SUM(output_tokens) FROM month_days), 0),
    'cacheReadTokens', COALESCE((SELECT SUM(cache_read_tokens) FROM month_days), 0),
    'users', (SELECT COUNT(*) FROM per_user),
    'activeDays', (SELECT COUNT(DISTINCT date) FROM month_days),
    'medianUserCost', COALESCE((
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY cost) FROM per_user
    ), 0),
    'p90UserCost', COALESCE((
      SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY cost) FROM per_user
    ), 0),
    'topSpenders', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'username', username, 'cost', cost, 'tokens', tokens, 'activeDays', active_days))
      FROM (
        SELECT * FROM per_user ORDER BY cost DESC LIMIT 10
      ) t
    ), '[]'::jsonb),
    'perTool', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('tool', tool, 'cost', cost, 'users', users) ORDER BY cost DESC)
      FROM (
        SELECT a.tool, SUM(m.total_cost) AS cost, COUNT(DISTINCT m.username) AS users
        FROM month_days m, unnest(m.agents) AS a(tool)
        GROUP BY a.tool
      ) x
    ), '[]'::jsonb),
    'perModel', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('model', model, 'cost', cost) ORDER BY cost DESC)
      FROM (
        SELECT mb->>'modelName' AS model, SUM((mb->>'cost')::numeric) AS cost
        FROM month_days m,
        LATERAL jsonb_array_elements(m.model_breakdowns) mb
        WHERE m.model_breakdowns IS NOT NULL
          AND mb->>'modelName' IS NOT NULL
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 10
      ) x
    ), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION get_month_stats(TEXT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
