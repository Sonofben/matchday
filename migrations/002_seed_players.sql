-- Seed: bulk-insert players for Saturday Ballers and link them to teams.
-- Idempotent: safe to re-run; uses NOT EXISTS guards.
-- Run with: sudo -u postgres psql -d matchday -f migrations/002_seed_players.sql

BEGIN;

-- Helper: define a temp table of incoming roster
CREATE TEMP TABLE incoming_roster (
  team_name      TEXT,
  first_name     TEXT,
  last_name      TEXT,
  display_name   TEXT,
  jersey_number  INTEGER,
  position       position_type
) ON COMMIT DROP;

-- ─── SUPERSEDE FC ─────────────────────────────────────────────
INSERT INTO incoming_roster (team_name, first_name, last_name, display_name, jersey_number, position) VALUES
  ('Supersede FC', 'Beejay',  'Beejay',  'BEEJAY',  NULL, NULL),
  ('Supersede FC', 'Seun',    'Seun',    'SEUN',    NULL, NULL),
  ('Supersede FC', 'Isijola', 'Isijola', 'ISIJOLA', NULL, NULL),
  ('Supersede FC', 'Yinka',   'Yinka',   'YINKA',   NULL, NULL),
  ('Supersede FC', 'Simon',   'Simon',   'SIMON',   NULL, NULL),
  ('Supersede FC', 'Burna',   'Burna',   'BURNA',   NULL, NULL),
  ('Supersede FC', 'Ibrahim', 'Ibrahim', 'IBRAHIM', NULL, NULL),
  ('Supersede FC', 'Wahab',   'Wahab',   'WAHAB',   NULL, NULL),
  ('Supersede FC', 'Charger', 'Charger', 'CHARGER', NULL, NULL),
  ('Supersede FC', 'Bamz',    'Bamz',    'BAMZ',    NULL, NULL),
  ('Supersede FC', 'Savior',  'Savior',  'SAVIOR',  NULL, NULL),
  ('Supersede FC', 'Adeola',  'Adeola',  'ADEOLA',  NULL, NULL);

-- ─── AMIGOS FC ────────────────────────────────────────────────
INSERT INTO incoming_roster (team_name, first_name, last_name, display_name, jersey_number, position) VALUES
  ('Amigos FC', 'Omotayo', 'Omotayo', 'Omotayo', 19, 'defender'),
  ('Amigos FC', 'Khedira', 'Khedira', 'Khedira',  6, 'midfielder');

-- ─── LIKE A BAT FC ────────────────────────────────────────────
INSERT INTO incoming_roster (team_name, first_name, last_name, display_name, jersey_number, position) VALUES
  ('Like A Bat FC', 'Big',         'Nass',       'Big Nass',         10, 'midfielder'),
  ('Like A Bat FC', 'Aloma',       'Para Para',  'Aloma Para Para',   2, 'defender'),
  ('Like A Bat FC', 'Dorada',      'Dorada',     'Dorada',            8, 'forward'),
  ('Like A Bat FC', 'Easie',       'Monie',      'Easie Monie',      22, 'midfielder'),
  ('Like A Bat FC', 'Joe',         'Blue',       'Joe Blue',         14, 'midfielder'),
  ('Like A Bat FC', 'Mendez',      'Mendez',     'Mendez',           11, 'forward'),
  ('Like A Bat FC', 'Roteski',     'Roteski',    'Roteski',           4, 'defender'),
  ('Like A Bat FC', 'Muri',        'Muri',       'Muri',              7, 'forward'),
  ('Like A Bat FC', 'Damilare',    'Damilare',   'Damilare',         23, 'defender'),
  ('Like A Bat FC', 'Dimeji',      'Dimeji',     'Dimeji',           20, 'defender'),
  ('Like A Bat FC', 'Adewale',     'Adewale',    'Adewale',          12, 'defender'),
  ('Like A Bat FC', 'Stephen',     'Stephen',    'Stephen',          13, 'midfielder'),
  ('Like A Bat FC', 'Solomon',     'Solomon',    'Solomon',           1, 'goalkeeper');

-- ─── ROYALS FC ────────────────────────────────────────────────
INSERT INTO incoming_roster (team_name, first_name, last_name, display_name, jersey_number, position) VALUES
  ('Royals FC', 'Wahab',   'Wahab',   'Wahab',    3, 'defender'),
  ('Royals FC', 'Lanre',   'Lanre',   'Lanre',   18, 'midfielder'),
  ('Royals FC', 'Tillesh', 'Tillesh', 'Tillesh',  5, 'defender'),
  ('Royals FC', 'Lhozy',   'Lhozy',   'Lhozy',    7, 'forward'),
  ('Royals FC', 'Mayana',  'Mayana',  'Mayana',  19, 'forward'),
  ('Royals FC', 'Lati',    'Lati',    'Lati',    10, 'midfielder'),
  ('Royals FC', 'Timmy',   'Timmy',   'Timmy',   16, 'midfielder'),
  ('Royals FC', 'Ayoola',  'Ayoola',  'Ayoola',   2, 'forward'),
  ('Royals FC', 'Chidon',  'Chidon',  'Chidon',   9, 'forward'),
  ('Royals FC', 'German',  'German',  'German',  13, 'forward'),
  ('Royals FC', 'Teslim',  'Teslim',  'Teslim',   8, 'midfielder'),
  ('Royals FC', 'Tunde',   'Tunde',   'Tunde',   20, 'defender'),
  ('Royals FC', 'Toheeb',  'Toheeb',  'Toheeb',   1, 'goalkeeper');

-- For every roster row that doesn't already match an existing player linked to that team, insert
WITH to_insert AS (
  SELECT r.first_name, r.last_name, r.display_name, r.jersey_number, r.position,
         t.id AS team_id
  FROM   incoming_roster r
  JOIN   teams t ON t.name = r.team_name
  WHERE  NOT EXISTS (
    SELECT 1
    FROM   player_team_contracts ptc
    JOIN   players p ON p.id = ptc.player_id
    WHERE  ptc.team_id    = t.id
      AND  ptc.is_current = TRUE
      AND  LOWER(p.display_name) = LOWER(r.display_name)
  )
), new_players AS (
  INSERT INTO players (first_name, last_name, display_name, position, jersey_number)
  SELECT first_name, last_name, display_name, position, jersey_number FROM to_insert
  RETURNING id, display_name
)
INSERT INTO player_team_contracts (player_id, team_id, jersey_number, start_date, is_current)
SELECT np.id, ti.team_id, ti.jersey_number, CURRENT_DATE, TRUE
FROM   new_players np
JOIN   to_insert  ti ON LOWER(ti.display_name) = LOWER(np.display_name);

COMMIT;

-- Verify
SELECT t.name AS team, p.display_name, p.jersey_number, p.position
FROM   players p
JOIN   player_team_contracts ptc ON ptc.player_id = p.id AND ptc.is_current = TRUE
JOIN   teams t ON t.id = ptc.team_id
WHERE  t.name IN ('Supersede FC','Amigos FC','Like A Bat FC','Royals FC')
ORDER  BY t.name, COALESCE(p.jersey_number, 999), p.display_name;
