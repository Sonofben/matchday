-- Recompute player_competition_stats from scratch, excluding friendly matches.
-- This wipes the cached stats and rebuilds them from match_events for non-friendly,
-- finished matches only.
--
-- Run with: sudo -u postgres psql -d matchday -f migrations/003_cleanup_friendly_player_stats.sql

BEGIN;

-- 1. Clear all cached stats. They're a derived/cached projection so this is safe.
DELETE FROM player_competition_stats;

-- 2. Rebuild from match_events, excluding friendlies.
-- Goals (goal + penalty_goal both count as goals)
INSERT INTO player_competition_stats (player_id, competition_id, season_id, team_id, goals)
SELECT
  e.player_id,
  m.competition_id,
  COALESCE((SELECT id FROM seasons WHERE is_current LIMIT 1), 1) AS season_id,
  e.team_id,
  COUNT(*) AS goals
FROM match_events e
JOIN matches m ON m.id = e.match_id
WHERE e.event_type IN ('goal','penalty_goal')
  AND e.player_id IS NOT NULL
  AND m.is_friendly = FALSE
  AND m.status = 'finished'
GROUP BY e.player_id, m.competition_id, e.team_id
ON CONFLICT (player_id, competition_id, season_id) DO UPDATE
  SET goals = EXCLUDED.goals;

-- Assists
INSERT INTO player_competition_stats (player_id, competition_id, season_id, team_id, assists)
SELECT
  e.assist_player_id AS player_id,
  m.competition_id,
  COALESCE((SELECT id FROM seasons WHERE is_current LIMIT 1), 1) AS season_id,
  e.team_id,
  COUNT(*) AS assists
FROM match_events e
JOIN matches m ON m.id = e.match_id
WHERE e.event_type IN ('goal','penalty_goal')
  AND e.assist_player_id IS NOT NULL
  AND m.is_friendly = FALSE
  AND m.status = 'finished'
GROUP BY e.assist_player_id, m.competition_id, e.team_id
ON CONFLICT (player_id, competition_id, season_id) DO UPDATE
  SET assists = EXCLUDED.assists;

-- Yellow cards
INSERT INTO player_competition_stats (player_id, competition_id, season_id, team_id, yellow_cards)
SELECT
  e.player_id,
  m.competition_id,
  COALESCE((SELECT id FROM seasons WHERE is_current LIMIT 1), 1) AS season_id,
  e.team_id,
  COUNT(*) AS yellow_cards
FROM match_events e
JOIN matches m ON m.id = e.match_id
WHERE e.event_type = 'yellow_card'
  AND e.player_id IS NOT NULL
  AND m.is_friendly = FALSE
  AND m.status = 'finished'
GROUP BY e.player_id, m.competition_id, e.team_id
ON CONFLICT (player_id, competition_id, season_id) DO UPDATE
  SET yellow_cards = EXCLUDED.yellow_cards;

-- Red cards (red_card + yellow_red_card both count)
INSERT INTO player_competition_stats (player_id, competition_id, season_id, team_id, red_cards)
SELECT
  e.player_id,
  m.competition_id,
  COALESCE((SELECT id FROM seasons WHERE is_current LIMIT 1), 1) AS season_id,
  e.team_id,
  COUNT(*) AS red_cards
FROM match_events e
JOIN matches m ON m.id = e.match_id
WHERE e.event_type IN ('red_card','yellow_red_card')
  AND e.player_id IS NOT NULL
  AND m.is_friendly = FALSE
  AND m.status = 'finished'
GROUP BY e.player_id, m.competition_id, e.team_id
ON CONFLICT (player_id, competition_id, season_id) DO UPDATE
  SET red_cards = EXCLUDED.red_cards;

COMMIT;

-- Verify: should show only stats from non-friendly competition matches.
-- Right now your finished competition matches = 0, so this should return zero rows.
SELECT COUNT(*) AS rows_in_player_stats FROM player_competition_stats;
