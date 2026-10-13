-- 023: automatic "under review" marks (#183).
--
-- Validation rejects what can't be real; this records what is merely unusual
-- (a day over $25K and 20x the profile's median day, or one submission adding
-- over $100K) so the board can show an "under review" badge until a
-- maintainer clears it. It never hides a row or changes ranking, unlike
-- flagged_for_review. Readable like every other submissions column.
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS review_reasons TEXT[];

NOTIFY pgrst, 'reload schema';
