-- Migration 007: exact site-wide stats for the /stats page.
--
-- getGlobalStats() approximates from the top 500 submissions by cost, which
-- undercounts everyone below the cutoff. This function computes exact
-- aggregates in one round trip so the public /stats page can show real
-- totals, a token-type split, and per-model / per-tool adoption. The page is
-- ISR-cached (1h), so the full scans here run rarely.

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
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  );
$$;

-- Read-only aggregates over already-public data; callable by everyone.
GRANT EXECUTE ON FUNCTION get_site_stats() TO anon, authenticated, service_role;
