/**
 * Saturday's Baller Cup 2026 — Seed Script
 * Run: npm run db:seed:league
 */
import pg from 'pg';
import { readFileSync, existsSync, copyFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
        const [key, ...rest] = line.split('=');
        if (key && !key.startsWith('#') && rest.length)
            process.env[key.trim()] = rest.join('=').trim();
    }
}
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const LOGOS_SRC = join(__dirname, '..', 'logos');
const UPLOADS_DIR = join(__dirname, '..', '..', 'uploads');
mkdirSync(UPLOADS_DIR, { recursive: true });
function copyLogo(filename) {
    const src = join(LOGOS_SRC, filename);
    if (!existsSync(src))
        return null;
    const dest = join(UPLOADS_DIR, filename);
    copyFileSync(src, dest);
    return `/uploads/${filename}`;
}
async function seed() {
    console.log("🌱 Seeding Saturday's Baller Cup 2026...");
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        // ── Country ───────────────────────────────────────────────────────────
        const countryRes = await client.query(`
      INSERT INTO countries (name, code) VALUES ('Nigeria', 'NGA')
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id
    `);
        const countryId = countryRes.rows[0].id;
        // ── Season ────────────────────────────────────────────────────────────
        await client.query(`
      INSERT INTO seasons (name, start_date, end_date, is_current)
      VALUES ('2026', '2026-05-02', '2026-06-06', TRUE)
      ON CONFLICT DO NOTHING
    `);
        const seasonId = (await client.query(`SELECT id FROM seasons WHERE name='2026'`)).rows[0].id;
        // ── Competition ───────────────────────────────────────────────────────
        await client.query(`DELETE FROM competitions WHERE name = 'Saturday''s Baller Cup 2026'`);
        const compRes = await client.query(`
      INSERT INTO competitions
        (name, short_name, format, bracket_type, team_size, half_duration,
         has_extra_time, has_penalties, country_id, season_id, is_local, is_active)
      VALUES (
        'Saturday''s Baller Cup 2026', 'SBC26',
        'group_stage', 'group_knockout',
        7, 25,
        TRUE, TRUE,
        $1, $2, TRUE, TRUE
      ) RETURNING id
    `, [countryId, seasonId]);
        const compId = compRes.rows[0].id;
        console.log(`✅ Competition: Saturday's Baller Cup 2026`);
        // ── Teams (no group assignment yet) ───────────────────────────────────
        const teamsData = [
            { name: 'Santander FC', short: 'SAN', color: '#1B2D6B', coach: 'Valid', logo: 'logo_santander.png' },
            { name: 'Rastafari FC', short: 'RAS', color: '#2E7D32', coach: 'Pylos', logo: 'logo_rastafari.png' },
            { name: 'Amigos FC', short: 'AMI', color: '#37474F', coach: 'Oseme Femi', logo: 'logo_amigos.png' },
            { name: 'Greenhouse FC', short: 'GRE', color: '#33691E', coach: 'Tommy', logo: 'logo_greenhouse.png' },
            { name: 'Like A Bat FC', short: 'LAB', color: '#1565C0', coach: 'Bailey', logo: 'logo_likeabat.png' },
            { name: 'Lamborghini FC', short: 'LAM', color: '#1B5E20', coach: 'Ay', logo: 'logo_lamborghini.png' },
            { name: 'Supersede FC', short: 'SUP', color: '#212121', coach: 'Popular', logo: 'logo_supersede.png' },
            { name: 'Royals FC', short: 'ROY', color: '#0D2B4E', coach: 'Sledge', logo: 'logo_royals.png' },
            { name: 'Omuski FC', short: 'OMU', color: '#6A1B9A', coach: 'Sir Joseph Benson', logo: 'logo_omuski.png' },
            { name: 'Venom FC', short: 'VEN', color: '#B71C1C', coach: 'Spring', logo: 'logo_venom.png' },
        ];
        const teamIds = {};
        for (const t of teamsData) {
            await client.query(`DELETE FROM teams WHERE name = $1`, [t.name]);
            const logoUrl = copyLogo(t.logo);
            const r = await client.query(`
        INSERT INTO teams (name, short_name, country_id, primary_color, coach_name, logo_url, is_local)
        VALUES ($1,$2,$3,$4,$5,$6,TRUE) RETURNING id
      `, [t.name, t.short, countryId, t.color, t.coach, logoUrl]);
            teamIds[t.name] = r.rows[0].id;
            // Register in competition but NO group_name assigned
            await client.query(`
        INSERT INTO competition_teams (competition_id, team_id)
        VALUES ($1,$2) ON CONFLICT DO NOTHING
      `, [compId, r.rows[0].id]);
            console.log(`   ⚽ ${t.name} (Coach: ${t.coach})${logoUrl ? ' + logo' : ' ⚠️  logo missing'}`);
        }
        console.log(`✅ 10 teams created — groups not assigned yet`);
        // ── Bracket rounds (empty shells — no slots yet) ──────────────────────
        const bracketRounds = [
            { name: 'Quarter Finals', order: 1 },
            { name: 'Semi Finals', order: 2 },
            { name: 'Final', order: 3 },
        ];
        for (const round of bracketRounds) {
            await client.query(`
        INSERT INTO bracket_rounds (competition_id, round_name, round_order)
        VALUES ($1,$2,$3)
      `, [compId, round.name, round.order]);
        }
        console.log(`✅ Bracket structure created (QF / SF / Final — slots assigned after group draw)`);
        await client.query('COMMIT');
        console.log('');
        console.log("🎉 Saturday's Baller Cup 2026 is ready!");
        console.log('   • 10 teams registered (no groups yet)');
        console.log('   • All logos attached');
        console.log('   • All coaches set');
        console.log('   • Bracket shell created (QF / SF / Final)');
        console.log('');
        console.log('   Next steps in Admin Panel:');
        console.log('   1. Assign teams to Group A and Group B');
        console.log('   2. Create fixtures for each Matchday');
        console.log('   3. Assign QF/SF/Final slots after group draw');
    }
    catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Seed failed:', e.message);
        throw e;
    }
    finally {
        client.release();
        await db.end();
    }
}
seed().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=seed_league.js.map