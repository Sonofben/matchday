import type { FastifyInstance } from 'fastify'
import { db } from '../db/client.js'
import { cacheGet, cacheSet, CacheKeys } from '../db/redis.js'

export async function teamRoutes(app: FastifyInstance) {
  // GET /api/teams/:id — team profile + squad + upcoming matches
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const { id } = req.params

    const teamRes = await db.query('SELECT * FROM teams WHERE id = $1', [id])
    if (!teamRes.rows[0]) return reply.status(404).send({ error: 'Team not found' })

    const [playersRes, matchesRes] = await Promise.all([
      db.query(`
        SELECT p.*, ptc.jersey_number AS squad_number, ptc.start_date
        FROM player_team_contracts ptc
        JOIN players p ON p.id = ptc.player_id
        WHERE ptc.team_id = $1 AND ptc.is_current = TRUE
        ORDER BY p.position, ptc.jersey_number
      `, [id]),
      db.query(`
        SELECT m.*,
          ht.name AS home_team_name, ht.logo_url AS home_logo,
          at.name AS away_team_name, at.logo_url AS away_logo
        FROM matches m
        JOIN teams ht ON ht.id = m.home_team_id
        JOIN teams at ON at.id = m.away_team_id
        WHERE (m.home_team_id = $1 OR m.away_team_id = $1)
          AND m.status IN ('scheduled', 'live')
        ORDER BY m.scheduled_at
        LIMIT 10
      `, [id]),
    ])

    return {
      team: teamRes.rows[0],
      squad: playersRes.rows,
      upcoming: matchesRes.rows,
    }
  })

  // GET /api/teams — list all teams
  app.get('/', async (req) => {
    const q = req.query as Record<string, string>
    const isLocal = q.local === 'true' ? true : q.local === 'false' ? false : null
    const params: unknown[] = []
    let where = 'WHERE 1=1'
    if (isLocal !== null) { where += ` AND t.is_local = $1`; params.push(isLocal) }

    const { rows } = await db.query(`
      SELECT t.*, c.name AS country_name, c.flag_url
      FROM teams t
      LEFT JOIN countries c ON c.id = t.country_id
      ${where}
      ORDER BY t.name
    `, params)
    return { teams: rows }
  })
}
