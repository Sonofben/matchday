import type { FastifyInstance } from 'fastify'
import { db } from '../db/client.js'
import { cacheGet, cacheSet, CacheKeys } from '../db/redis.js'

export async function playerRoutes(app: FastifyInstance) {
  // GET /api/players?search=name&team_id=&competition_id=
  app.get('/', async (req) => {
    const q = req.query as Record<string, string>
    const search   = q.search ?? null
    const teamId   = q.team_id ?? null
    const limit    = Math.min(Number(q.limit ?? 250), 250)
    const offset   = Number(q.offset ?? 0)

    const conditions: string[] = []
    const params: unknown[] = []
    let p = 1

    if (search) {
      conditions.push(`(p.last_name ILIKE $${p} OR p.first_name ILIKE $${p} OR p.display_name ILIKE $${p})`)
      params.push(`%${search}%`); p++
    }
    if (teamId) {
      conditions.push(`ptc.team_id = $${p++} AND ptc.is_current = TRUE`)
      params.push(teamId)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await db.query(`
      SELECT DISTINCT p.*,
        t.name AS current_team, t.logo_url AS team_logo, t.id AS team_id,
        c.name AS nationality_name
      FROM players p
      LEFT JOIN player_team_contracts ptc ON ptc.player_id = p.id AND ptc.is_current = TRUE
      LEFT JOIN teams t ON t.id = ptc.team_id
      LEFT JOIN countries c ON c.id = p.nationality
      ${where}
      ORDER BY p.last_name
      LIMIT $${p++} OFFSET $${p++}
    `, [...params, limit, offset])

    return { players: rows }
  })

  // GET /api/players/:id
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const { id } = req.params
    const cached = await cacheGet(CacheKeys.player(id))
    if (cached) return cached

    const playerRes = await db.query(`
      SELECT p.*, c.name AS nationality_name, c.flag_url AS nationality_flag
      FROM players p
      LEFT JOIN countries c ON c.id = p.nationality
      WHERE p.id = $1
    `, [id])

    if (!playerRes.rows[0]) return reply.status(404).send({ error: 'Player not found' })

    // Career history + competition stats
    const [contractsRes, statsRes] = await Promise.all([
      db.query(`
        SELECT ptc.*, t.name AS team_name, t.logo_url
        FROM player_team_contracts ptc
        JOIN teams t ON t.id = ptc.team_id
        WHERE ptc.player_id = $1
        ORDER BY ptc.start_date DESC
      `, [id]),
      db.query(`
        SELECT pcs.*, comp.name AS competition_name, comp.logo_url AS competition_logo,
               t.name AS team_name, s.name AS season_name
        FROM player_competition_stats pcs
        JOIN competitions comp ON comp.id = pcs.competition_id
        LEFT JOIN teams t ON t.id = pcs.team_id
        LEFT JOIN seasons s ON s.id = pcs.season_id
        WHERE pcs.player_id = $1
        ORDER BY s.start_date DESC
      `, [id]),
    ])

    const result = {
      player: playerRes.rows[0],
      contracts: contractsRes.rows,
      stats: statsRes.rows,
    }
    await cacheSet(CacheKeys.player(id), result, 120)
    return result
  })
}

export async function playerStatsRoutes(app: FastifyInstance) {
  // GET /api/stats/top-scorers/:competitionId
  app.get<{ Params: { competitionId: string } }>('/top-scorers/:competitionId', async (req) => {
    const { competitionId } = req.params
    const q = req.query as Record<string, string>
    const limit = Math.min(Number(q.limit ?? 20), 50)

    const { rows } = await db.query(`
      SELECT pcs.*,
        p.first_name, p.last_name, p.display_name, p.photo_url, p.position,
        t.name AS team_name, t.short_name AS team_short, t.logo_url AS team_logo, t.primary_color,
        c.name AS competition_name
      FROM player_competition_stats pcs
      JOIN players p ON p.id = pcs.player_id
      LEFT JOIN teams t ON t.id = pcs.team_id
      JOIN competitions c ON c.id = pcs.competition_id
      WHERE pcs.competition_id = $1
      ORDER BY pcs.goals DESC, pcs.assists DESC, pcs.appearances DESC
      LIMIT $2
    `, [competitionId, limit])
    return { players: rows }
  })

  // GET /api/stats/top-assists/:competitionId
  app.get<{ Params: { competitionId: string } }>('/top-assists/:competitionId', async (req) => {
    const { competitionId } = req.params
    const { rows } = await db.query(`
      SELECT pcs.*,
        p.first_name, p.last_name, p.display_name, p.photo_url, p.position,
        t.name AS team_name, t.short_name AS team_short, t.logo_url AS team_logo
      FROM player_competition_stats pcs
      JOIN players p ON p.id = pcs.player_id
      LEFT JOIN teams t ON t.id = pcs.team_id
      WHERE pcs.competition_id = $1 AND pcs.assists > 0
      ORDER BY pcs.assists DESC, pcs.goals DESC
      LIMIT 20
    `, [competitionId])
    return { players: rows }
  })

  // GET /api/stats/head-to-head?team1=uuid&team2=uuid
  app.get('/head-to-head', async (req) => {
    const q = req.query as Record<string, string>
    const { team1, team2 } = q
    if (!team1 || !team2) return { error: 'team1 and team2 required' }

    const { rows } = await db.query(`
      SELECT m.*,
        ht.name AS home_team_name, ht.short_name AS home_short, ht.logo_url AS home_logo,
        at.name AS away_team_name, at.short_name AS away_short, at.logo_url AS away_logo,
        c.name AS competition_name
      FROM matches m
      JOIN teams ht ON ht.id = m.home_team_id
      JOIN teams at ON at.id = m.away_team_id
      JOIN competitions c ON c.id = m.competition_id
      WHERE m.status = 'finished'
        AND ((m.home_team_id = $1 AND m.away_team_id = $2)
          OR (m.home_team_id = $2 AND m.away_team_id = $1))
      ORDER BY m.scheduled_at DESC
      LIMIT 10
    `, [team1, team2])

    // Compute summary
    let team1Wins = 0, team2Wins = 0, draws = 0
    let team1Goals = 0, team2Goals = 0
    for (const m of rows) {
      const t1IsHome = m.home_team_id === team1
      const t1g = t1IsHome ? m.home_score : m.away_score
      const t2g = t1IsHome ? m.away_score : m.home_score
      team1Goals += t1g; team2Goals += t2g
      if (t1g > t2g) team1Wins++
      else if (t1g < t2g) team2Wins++
      else draws++
    }

    const t1 = await db.query('SELECT name, short_name, logo_url, primary_color FROM teams WHERE id=$1', [team1])
    const t2 = await db.query('SELECT name, short_name, logo_url, primary_color FROM teams WHERE id=$2', [team2])

    return {
      team1: { id: team1, ...t1.rows[0], wins: team1Wins, goals: team1Goals },
      team2: { id: team2, ...t2.rows[0], wins: team2Wins, goals: team2Goals },
      draws,
      matches: rows,
    }
  })
}
