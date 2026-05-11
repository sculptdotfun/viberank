# Viberank data validation

How submissions are validated. Implemented in `src/lib/data/supabase/client.ts` (`validateSubmitData`) and called from `POST /api/submit`.

## Hard rejection

If any of these fail, the API responds with `400` and the submission is not stored.

### Token math

```
inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens = totalTokens
```

Tolerance: ±1 token (floating point). Mismatch is treated as evidence the JSON was hand-edited and rejected with a hint to regenerate via `ccusage`.

### No negative values

Rejected if any token count or cost is negative — applies to totals and to every entry in `daily`.

### Date format

Daily entries must use `YYYY-MM-DD`. Anything else is rejected with the offending value in the error message.

### Future-date cutoff

A daily entry is rejected if its date is later than **end-of-tomorrow UTC**.

The cutoff is intentionally one day past UTC midnight rather than today, because `cc.json` is emitted in the user's local timezone and `ccusage` groups by local day. Users at UTC+14 (e.g., New Zealand near midnight local time) can otherwise produce entries that look future-dated from the server's UTC perspective. See [#44](https://github.com/sculptdotfun/viberank/issues/44).

### Realistic total cost

`totalCost > $5,000 × 365` (~$1,825,000) is rejected as out of reasonable bounds.

## Soft flagging

The schema supports a `flagged_for_review` boolean per submission. Flagged rows are hidden from the leaderboard by default (`includeFlagged: true` reveals them via the admin endpoint).

Currently, flagging is **manual only** — admins can toggle the flag through the `/admin` UI. There is no automatic flagging in the submit path. (The original Convex implementation had heuristic auto-flagging for very high daily cost / sustained averages; that logic was not ported to the Supabase backend.)

## Multiple submissions

When a user submits an overlapping date range:

1. The API looks up existing submissions under the same `github_username` and `source`
2. If one overlaps the new range, it's merged: existing daily entries are kept for dates not in the new submission; entries that exist in both are replaced by the new entry; new entries are added
3. Totals are recalculated from the merged daily set
4. `date_range_start` / `date_range_end` are widened to cover everything
5. Non-overlapping submissions create a new row

### Known limitation

Submitting from **two different machines** with overlapping dates causes the second submission's daily entries to overwrite the first's for shared dates — see [#43](https://github.com/sculptdotfun/viberank/issues/43). Until that's resolved, submit from one machine at a time.

## Merge flow (claim and combine)

Separate from the per-submit merge above, signed-in users can consolidate any unverified `cli` submissions under their GitHub username into a single verified record via `POST /api/claim`. The flow:

1. Find every submission whose `github_username` matches the session user
2. Pick a base: prefer OAuth-verified rows, else the most recent
3. Merge daily breakdowns — OAuth entries win on conflict
4. Recompute totals, set `verified: true` on the base
5. Delete duplicate submissions
6. Recompute `profiles.total_submissions` from a fresh `COUNT(*)` and repoint `best_submission_id` at the surviving base

The username comes from the authenticated session, never the client request body — anyone can submit under any GitHub handle via the CLI, but only the actual GitHub owner can claim/merge it.

## Trust signals on the leaderboard

- **OAuth-submitted rows** (uploaded via a signed-in session, or claimed by their owner) display a blue verified check
- **Unverified CLI rows** (raw `curl` / `npx viberank` without OAuth claim) display a muted `cli` pill

The CLI submission path trusts the `X-GitHub-User` header as the username — by design, since the CLI doesn't authenticate. The badge difference exists so leaderboard viewers can tell the two apart.

## For tool authors

If you're building something that submits to viberank:

1. Use the official `ccusage` tool to generate the JSON
2. Don't reshape the data — the validator requires Claude-shaped token fields (`input`, `output`, `cache_creation`, `cache_read`)
3. Submit promptly rather than batching months
4. If you have legitimate usage that exceeds the cost cap, open an issue

Non-Claude tools (OpenAI Codex, etc.) are not yet supported — see [#45](https://github.com/sculptdotfun/viberank/issues/45) for the design discussion.

## Questions

If a legitimate submission is rejected or flagged, open an issue with:

- The exact error message
- The date range
- A general description of the usage pattern
