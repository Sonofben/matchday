/**
 * Cleanup Script — wipes demo data, keeps Saturday's Baller Cup 2026
 * Run: npm run db:cleanup
 */
import pg from 'pg'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const { Pool } = pg
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && !key.startsWith('#') && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
}

const db = new Pool({ connectionString: process.env.DATABASE_URL })

async function cleanup() {
  console.log('🧹 Cleaning demo data...')
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // Teams to delete (demo/seed teams NOT in Saturday's Baller Cup)
    const demoTeams = [
      'Abuja City FC',
      'Kano Pillars SC',
      'Lagos United FC',
      'Port Harcourt Rovers',
    ]

    // Delete demo competitions (keep Saturday's Baller Cup 2026)
    const { rows: demoComps } = await client.query(`
      SELECT id, name FROM competitions
      WHERE name != $1
    `, ["Saturday's Baller Cup 2026"])

    for (const comp of demoComps) {
      // Delete all related data for this competition
      const { rows: matches } = await client.query(
        'SELECT id FROM matches WHERE competition_id = $1', [comp.id]
      )
      for (const m of matches) {
        await client.query('DELETE FROM match_events   WHERE match_id = $1', [m.id])
        await client.query('DELETE FROM match_lineups  WHERE match_id = $1', [m.id])
        await client.query('DELETE FROM match_coaches  WHERE match_id = $1', [m.id])
        await client.query('DELETE FROM match_stats    WHERE match_id = $1', [m.id])
      }
      await client.query('DELETE FROM matches                    WHERE competition_id = $1', [comp.id])
      await client.query('DELETE FROM standings                  WHERE competition_id = $1', [comp.id])
      await client.query('DELETE FROM player_competition_stats   WHERE competition_id = $1', [comp.id])
      await client.query('DELETE FROM competition_teams          WHERE competition_id = $1', [comp.id])
      const { rows: rounds } = await client.query(
        'SELECT id FROM bracket_rounds WHERE competition_id = $1', [comp.id]
      )
      for (const r of rounds) {
        await client.query('DELETE FROM bracket_slots WHERE round_id = $1', [r.id])
      }
      await client.query('DELETE FROM bracket_rounds WHERE competition_id = $1', [comp.id])
      await client.query('DELETE FROM competitions    WHERE id = $1', [comp.id])
      console.log(`   🗑  Deleted competition: ${comp.name}`)
    }

    // Delete demo teams
    for (const name of demoTeams) {
      const { rows } = await client.query('SELECT id FROM teams WHERE name = $1', [name])
      if (!rows[0]) continue
      const tid = rows[0].id
      // Clean up player contracts for this team
      await client.query('DELETE FROM player_team_contracts WHERE team_id = $1', [tid])
      await client.query('DELETE FROM competition_teams      WHERE team_id = $1', [tid])
      await client.query('DELETE FROM standings              WHERE team_id = $1', [tid])
      await client.query('DELETE FROM teams                  WHERE id = $1',      [tid])
      console.log(`   🗑  Deleted team: ${name}`)
    }

    // Delete orphan players (not attached to any team in Saturday's Baller Cup)
    const { rows: orphans } = await client.query(`
      SELECT p.id, p.first_name, p.last_name FROM players p
      WHERE NOT EXISTS (
        SELECT 1 FROM player_team_contracts ptc
        JOIN teams t ON t.id = ptc.team_id
        JOIN competition_teams ct ON ct.team_id = t.id
        JOIN competitions c ON c.id = ct.competition_id
        WHERE ptc.player_id = p.id AND c.name = $1
      )
    `, ["Saturday's Baller Cup 2026"])

    for (const p of orphans) {
      await client.query('DELETE FROM player_competition_stats WHERE player_id = $1', [p.id])
      await client.query('DELETE FROM player_team_contracts    WHERE player_id = $1', [p.id])
      await client.query('DELETE FROM players                  WHERE id = $1',        [p.id])
      console.log(`   🗑  Deleted player: ${p.first_name} ${p.last_name}`)
    }

    // Delete old seasons (keep 2026)
    await client.query(`DELETE FROM seasons WHERE name != '2026'`)
    console.log(`   🗑  Deleted old seasons`)

    await client.query('COMMIT')
    console.log('')
    console.log("✅ Cleanup complete! Only Saturday's Baller Cup 2026 data remains.")
  } catch (e: any) {
    await client.query('ROLLBACK')
    console.error('❌ Cleanup failed:', e.message)
    throw e
  } finally {
    client.release()
    await db.end()
  }
}

cleanup().catch(e => { console.error(e); process.exit(1) })
