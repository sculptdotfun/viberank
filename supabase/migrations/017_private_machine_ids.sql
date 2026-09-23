-- Migration 017: keep CLI machine IDs off the public API.
--
-- daily_breakdowns.machine_contributions is keyed by the CLI's machine ID
-- (#43). The table has a public-read policy, so every machine ID was readable
-- with the anon key — while /privacy lists the machine ID as server-only.
--
-- RLS is row-level, so the column has to be withheld with column privileges:
-- revoke table-wide SELECT from the public roles and grant it back on every
-- other column. The service role (server merges, claims, admin deletes) keeps
-- full access. The app's browser-reachable reads name their columns
-- (DAILY_PUBLIC_COLUMNS) and must ship before this runs, since a select("*")
-- by anon fails once the column is revoked.

REVOKE SELECT ON daily_breakdowns FROM anon, authenticated;

GRANT SELECT (
  id,
  submission_id,
  date,
  input_tokens,
  output_tokens,
  cache_creation_tokens,
  cache_read_tokens,
  total_tokens,
  total_cost,
  models_used,
  agents,
  model_breakdowns
) ON daily_breakdowns TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
