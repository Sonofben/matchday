import type { FastifyInstance } from 'fastify'
import { db } from '../db/client.js'
import { authenticate, requireRole } from '../middleware/auth.js'

export async function standingsRoutes(app: FastifyInstance) {

  // GET /api/standings/:competitionId
  app.get<{ Params: { competitionId: string } }>('/:competitionId', async (req) => {
    const { competitionId } = req.params
    const q = req.query as Record<string, string>
    const group = q.group ?? null

    const { rows } = await db.query(`
      SELECT s.*, t.name AS team_name, t.short_name, t.logo_url, t.primary_color
      FROM standings s
      JOIN teams t ON t.id = s.team_id
      WHERE s.competition_id = $1
        ${group ? 'AND s.group_name = $2' : ''}
      ORDER BY s.group_name NULLS FIRST, s.points DESC,
               s.goal_difference DESC, s.goals_for DESC
    `, group ? [competitionId, group] : [competitionId])

    // Get distinct groups
    const groups = [...new Set(rows.map((r: any) => r.group_name).filter(Boolean))]
    return { standings: rows, groups }
  })

  // POST /api/standings/recalculate/:competitionId — admin only
  app.post<{ Params: { competitionId: string } }>(
    '/recalculate/:competitionId',
    { preHandler: [authenticate, requireRole(['admin'])] },
    async (req, reply) => {
      const { competitionId } = req.params
      await recalculateStandings(competitionId)
      return { ok: true }
    }
  )
}

// Called after every finished match
export async function recalculateStandings(competitionId: string) {
  // Get all finished matches for this competition
  const { rows: matches } = await db.query(`
    SELECT * FROM matches
    WHERE competition_id = $1 AND status = 'finished' AND (round IS NULL OR round != 'Friendly')
  `, [competitionId])

  // Get all teams in this competition
  const { rows: compTeams } = await db.query(`
    SELECT ct.team_id, ct.group_name FROM competition_teams ct
    WHERE ct.competition_id = $1
  `, [competitionId])

  // Get current season
  const { rows: seasons } = await db.query(`SELECT id FROM seasons WHERE is_current = TRUE LIMIT 1`)
  const seasonId = seasons[0]?.id ?? null

  // Calculate stats per team
  const stats: Record<string, any> = {}
  for (const ct of compTeams) {
    stats[ct.team_id] = {
      team_id: ct.team_id,
      group_name: ct.group_name,
      played: 0, won: 0, drawn: 0, lost: 0,
      goals_for: 0, goals_against: 0, points: 0, form: [],
    }
  }

  for (const m of matches) {
    const home = stats[m.home_team_id]
    const away = stats[m.away_team_id]
    if (!home || !away) continue

    const hg = m.home_score ?? 0
    const ag = m.away_score ?? 0

    home.played++; away.played++
    home.goals_for     += hg; home.goals_against += ag
    away.goals_for     += ag; away.goals_against += hg

    if (hg > ag) {
      home.won++; home.points += 3; away.lost++
      home.form.push('W'); away.form.push('L')
    } else if (hg < ag) {
      away.won++; away.points += 3; home.lost++
      away.form.push('W'); home.form.push('L')
    } else {
      home.drawn++; home.points++
      away.drawn++; away.points++
      home.form.push('D'); away.form.push('D')
    }
  }

  // Upsert standings
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    for (const [teamId, s] of Object.entries(stats) as any) {
      const form = s.form.slice(-5).join('')
      await client.query(`
        INSERT INTO standings
          (competition_id, season_id, team_id, group_name, played, won, drawn, lost,
           goals_for, goals_against, points, form)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (competition_id, season_id, team_id) DO UPDATE SET
          group_name = EXCLUDED.group_name,
          played = EXCLUDED.played, won = EXCLUDED.won,
          drawn = EXCLUDED.drawn, lost = EXCLUDED.lost,
          goals_for = EXCLUDED.goals_for, goals_against = EXCLUDED.goals_against,
          points = EXCLUDED.points, form = EXCLUDED.form,
          updated_at = NOW()
      `, [competitionId, seasonId, teamId, s.group_name,
          s.played, s.won, s.drawn, s.lost,
          s.goals_for, s.goals_against, s.points, form])
    }
    // Re-rank positions within each group
    await client.query(`
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY competition_id, COALESCE(group_name, 'default')
          ORDER BY points DESC, goal_difference DESC, goals_for DESC
        ) AS pos
        FROM standings WHERE competition_id = $1
      )
      UPDATE standings s SET position = r.pos
      FROM ranked r WHERE s.id = r.id
    `, [competitionId])
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK'); throw e
  } finally { client.release() }
}
