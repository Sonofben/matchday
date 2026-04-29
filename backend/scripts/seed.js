/**
 * Seed script — run with: npm run db:seed
 * Creates: admin user, sample country, season, competition, teams, players, match
 * Safe to re-run (uses ON CONFLICT DO NOTHING throughout).
 */
import pg from 'pg';
import bcrypt from 'bcryptjs';
const { Pool } = pg;
// Load .env manually (tsx doesn't auto-load it)
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
        const [key, ...rest] = line.split('=');
        if (key && !key.startsWith('#') && rest.length) {
            process.env[key.trim()] = rest.join('=').trim();
        }
    }
}
const db = new Pool({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:password@localhost:5432/matchday',
});
async function seed() {
    console.log('🌱 Seeding MatchDay...');
    // Country
    const countryRes = await db.query(`
    INSERT INTO countries (name, code) VALUES ('Nigeria', 'NGA')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `);
    const countryId = countryRes.rows[0].id;
    // Season
    await db.query(`
    INSERT INTO seasons (name, start_date, end_date, is_current)
    VALUES ('2024/25', '2024-09-01', '2025-05-31', TRUE)
    ON CONFLICT DO NOTHING
  `);
    const seasonId = (await db.query(`SELECT id FROM seasons WHERE name = '2024/25'`)).rows[0].id;
    // Admin user
    const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@matchday.local';
    const adminPass = process.env.ADMIN_PASSWORD ?? 'changeme123';
    const hash = await bcrypt.hash(adminPass, 12);
    await db.query(`
    INSERT INTO users (email, full_name, password_hash, role)
    VALUES ($1, 'Admin', $2, 'admin')
    ON CONFLICT (email) DO NOTHING
  `, [adminEmail, hash]);
    // Competition
    const compCheck = await db.query(`SELECT id FROM competitions WHERE name = 'Local Premier League'`);
    let compId;
    if (compCheck.rows[0]) {
        compId = compCheck.rows[0].id;
    }
    else {
        const r = await db.query(`
      INSERT INTO competitions (name, short_name, format, country_id, season_id, is_local, is_active)
      VALUES ('Local Premier League', 'LPL', 'league', $1, $2, TRUE, TRUE)
      RETURNING id
    `, [countryId, seasonId]);
        compId = r.rows[0].id;
    }
    // Teams
    const teams = [
        { name: 'Lagos United FC', short: 'LAG', color: '#0057b7' },
        { name: 'Abuja City FC', short: 'ABJ', color: '#ff6600' },
        { name: 'Port Harcourt Rovers', short: 'PHR', color: '#008000' },
        { name: 'Kano Pillars SC', short: 'KAN', color: '#cc0000' },
    ];
    const teamIds = [];
    for (const t of teams) {
        const existing = await db.query(`SELECT id FROM teams WHERE name = $1`, [t.name]);
        let teamId;
        if (existing.rows[0]) {
            teamId = existing.rows[0].id;
        }
        else {
            const r = await db.query(`
        INSERT INTO teams (name, short_name, country_id, primary_color, is_local)
        VALUES ($1,$2,$3,$4,TRUE) RETURNING id
      `, [t.name, t.short, countryId, t.color]);
            teamId = r.rows[0].id;
        }
        teamIds.push(teamId);
        await db.query(`
      INSERT INTO competition_teams (competition_id, team_id) VALUES ($1,$2)
      ON CONFLICT DO NOTHING
    `, [compId, teamId]);
    }
    // Sample players for team[0]
    const samplePlayers = [
        { first: 'Chukwuemeka', last: 'Okafor', pos: 'goalkeeper', num: 1 },
        { first: 'Tunde', last: 'Adeyemi', pos: 'defender', num: 5 },
        { first: 'Segun', last: 'Balogun', pos: 'midfielder', num: 8 },
        { first: 'Emeka', last: 'Eze', pos: 'forward', num: 9 },
    ];
    for (const pl of samplePlayers) {
        const existing = await db.query(`SELECT id FROM players WHERE first_name=$1 AND last_name=$2`, [pl.first, pl.last]);
        let playerId;
        if (existing.rows[0]) {
            playerId = existing.rows[0].id;
        }
        else {
            const r = await db.query(`
        INSERT INTO players (first_name, last_name, position, jersey_number)
        VALUES ($1,$2,$3,$4) RETURNING id
      `, [pl.first, pl.last, pl.pos, pl.num]);
            playerId = r.rows[0].id;
        }
        await db.query(`
      INSERT INTO player_team_contracts (player_id, team_id, jersey_number, start_date, is_current)
      VALUES ($1,$2,$3,CURRENT_DATE,TRUE)
      ON CONFLICT DO NOTHING
    `, [playerId, teamIds[0], pl.num]);
    }
    // Sample live match
    const matchCheck = await db.query(`SELECT id FROM matches WHERE home_team_id=$1 AND away_team_id=$2`, [teamIds[0], teamIds[1]]);
    if (!matchCheck.rows[0]) {
        await db.query(`
      INSERT INTO matches (competition_id, home_team_id, away_team_id, scheduled_at, status, minute, home_score, away_score, round)
      VALUES ($1,$2,$3,NOW(),'live',67,2,1,'Matchday 1')
    `, [compId, teamIds[0], teamIds[1]]);
    }
    // Standings
    const standingsData = [
        { pts: 9, w: 3, d: 0, l: 0, gf: 7, ga: 2, form: 'WWW' },
        { pts: 7, w: 2, d: 1, l: 0, gf: 5, ga: 4, form: 'WWD' },
        { pts: 3, w: 1, d: 0, l: 2, gf: 3, ga: 5, form: 'LLD' },
        { pts: 0, w: 0, d: 0, l: 3, gf: 1, ga: 8, form: 'LLL' },
    ];
    for (const [i, teamId] of teamIds.entries()) {
        const s = standingsData[i];
        await db.query(`
      INSERT INTO standings
        (competition_id, season_id, team_id, position, played, won, drawn, lost, goals_for, goals_against, points, form)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (competition_id, season_id, team_id) DO NOTHING
    `, [compId, seasonId, teamId, i + 1, 3, s.w, s.d, s.l, s.gf, s.ga, s.pts, s.form]);
    }
    await db.end();
    console.log('✅ Seed complete!');
    console.log(`   Admin login → ${adminEmail} / ${adminPass}`);
    console.log(`   Competition: Local Premier League (4 teams, 1 live match)`);
}
seed().catch(e => { console.error('❌ Seed failed:', e.message); process.exit(1); });
//# sourceMappingURL=seed.js.map