-- Migration: add is_friendly flag to matches
-- Run with: psql "$DATABASE_URL" -f migrations/001_add_is_friendly.sql

BEGIN;

-- 1. Add is_friendly column (default FALSE so existing competition matches stay as-is)
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS is_friendly BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Backfill: any existing match where round was set to "Friendly" (any case) becomes is_friendly = TRUE
UPDATE matches
SET    is_friendly = TRUE
WHERE  LOWER(TRIM(COALESCE(round, ''))) = 'friendly';

-- 3. Helpful index for standings queries
CREATE INDEX IF NOT EXISTS idx_matches_competition_friendly
  ON matches (competition_id, is_friendly, status);

COMMIT;

-- After running, verify with:
--   SELECT id, home_team_id, away_team_id, round, is_friendly, status FROM matches ORDER BY scheduled_at DESC LIMIT 20;
