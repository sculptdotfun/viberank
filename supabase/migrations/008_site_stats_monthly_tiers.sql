-- Migration 008: monthly trend + tier distribution for /stats.
--
-- Extends get_site_stats() (007) with two aggregates the page can't derive
-- client-side: a 12-month site-wide spend/active-devs rollup and the count of
-- developers per spend tier (bucketed on each user's best submission, the
-- same rule the UI's tier badges use). Everything else is unchanged from 007.

CREATE OR REPLACE FUNCTION get_site_stats()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'totalUsers', (SELECT COUNT(*) FROM profiles),
    'totalSubmissions', (SELECT COUNT(*) FROM submissions WHERE flagged_for_review IS NOT TRUE),
    'totalCost', COALESCE((SELECT SUM(total_cost) FROM submissions WHERE flagged_for_review IS NOT TRUE), 0),
    'totalTokens', COALESCE((SELECT SUM(total_tokens) FROM submissions WHERE flagged_for_review IS NOT TRUE), 0),
    'inputTokens', COALESCE((SELECT SUM(input_tokens) FROM submissions WHERE flagged_for_review IS NOT TRUE), 0),
    'outputTokens', COALESCE((SELECT SUM(output_tokens) FROM submissions WHERE flagged_for_review IS NOT TRUE), 0),
    'cacheReadTokens', COALESCE((SELECT SUM(cache_read_tokens) FROM submissions WHERE flagged_for_review IS NOT TRUE), 0),
    'cacheCreationTokens', COALESCE((SELECT SUM(cache_creation_tokens) FROM submissions WHERE flagged_for_review IS NOT TRUE), 0),
    'firstDate', (SELECT MIN(date_range_start) FROM submissions WHERE flagged_for_review IS NOT TRUE),
    'lastDate', (SELECT MAX(date_range_end) FROM submissions WHERE flagged_for_review IS NOT TRUE),
    'activeDays', (
      SELECT COUNT(DISTINCT d.date)
      FROM daily_breakdowns d
      JOIN submissions s ON s.id = d.submission_id
      WHERE s.flagged_for_review IS NOT TRUE
    ),
    'monthly', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('month', month, 'cost', cost, 'users', users) ORDER BY month)
      FROM (
        SELECT to_char(d.date, 'YYYY-MM') AS month,
               SUM(d.total_cost) AS cost,
               COUNT(DISTINCT s.username) AS users
        FROM daily_breakdowns d
        JOIN submissions s ON s.id = d.submission_id
        WHERE s.flagged_for_review IS NOT TRUE
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 12
      ) x
    ), '[]'::jsonb),
    'tiers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('tier', tier, 'users', users))
      FROM (
        SELECT CASE
                 WHEN best >= 50000 THEN 'supernova'
                 WHEN best >= 15000 THEN 'inferno'
                 WHEN best >= 5000  THEN 'blaze'
                 WHEN best >= 1000  THEN 'flame'
                 WHEN best >= 100   THEN 'ember'
                 ELSE 'spark'
               END AS tier,
               COUNT(*) AS users
        FROM (
          SELECT username, MAX(total_cost) AS best
          FROM submissions
          WHERE flagged_for_review IS NOT TRUE
          GROUP BY 1
        ) u
        GROUP BY 1
      ) x
    ), '[]'::jsonb),
    'tools', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('tool', tool, 'users', users) ORDER BY users DESC)
      FROM (
        SELECT t.tool, COUNT(DISTINCT s.username) AS users
        FROM submissions s, unnest(s.tools) AS t(tool)
        WHERE s.flagged_for_review IS NOT TRUE
        GROUP BY t.tool
      ) x
    ), '[]'::jsonb),
    'models', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('model', model, 'users', users) ORDER BY users DESC)
      FROM (
        SELECT m.model, COUNT(DISTINCT s.username) AS users
        FROM submissions s, unnest(s.models_used) AS m(model)
        WHERE s.flagged_for_review IS NOT TRUE
          AND m.model IS NOT NULL AND m.model <> ''
        GROUP BY m.model
        ORDER BY COUNT(DISTINCT s.username) DESC
        LIMIT 20
      ) x
    ), '[]'::jsonb),
    'modelSpend', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('model', model, 'cost', cost) ORDER BY cost DESC)
      FROM (
        SELECT mb->>'modelName' AS model, SUM((mb->>'cost')::numeric) AS cost
        FROM daily_breakdowns d
        JOIN submissions s ON s.id = d.submission_id,
        LATERAL jsonb_array_elements(d.model_breakdowns) mb
        WHERE s.flagged_for_review IS NOT TRUE
          AND d.model_breakdowns IS NOT NULL
          AND mb->>'modelName' IS NOT NULL
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION get_site_stats() TO anon, authenticated, service_role;
