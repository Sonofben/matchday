import type { FastifyInstance } from 'fastify'
import { db } from '../db/client.js'

export async function competitionRoutes(app: FastifyInstance) {
  // GET /api/competitions
  app.get('/', async (req) => {
    const q = req.query as Record<string, string>
    const isLocal = q.local === 'true' ? true : q.local === 'false' ? false : null
    const params: unknown[] = []
    let where = 'WHERE c.is_active = TRUE'
    if (isLocal !== null) { where += ` AND c.is_local = $1`; params.push(isLocal) }

    const { rows } = await db.query(`
      SELECT c.*, co.name AS country_name, co.flag_url, s.name AS season_name
      FROM competitions c
      LEFT JOIN countries co ON co.id = c.country_id
      LEFT JOIN seasons s ON s.id = c.season_id
      ${where}
      ORDER BY c.is_local DESC, c.name
    `, params)
    return { competitions: rows }
  })

  // GET /api/competitions/:id
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const { id } = req.params
    const { rows } = await db.query(`
      SELECT c.*, co.name AS country_name, co.flag_url, s.name AS season_name
      FROM competitions c
      LEFT JOIN countries co ON co.id = c.country_id
      LEFT JOIN seasons s ON s.id = c.season_id
      WHERE c.id = $1
    `, [id])
    if (!rows[0]) return reply.status(404).send({ error: 'Competition not found' })
    return rows[0]
  })

  // GET /api/competitions/:id/fixtures
  app.get<{ Params: { id: string } }>('/:id/fixtures', async (req) => {
    const { id } = req.params
    const q = req.query as Record<string, string>
    const round = q.round ?? null
    const params: unknown[] = [id]
    let extra = ''
    if (round) { extra = ' AND m.round = $2'; params.push(round) }

    const { rows } = await db.query(`
      SELECT m.*,
        ht.name AS home_team_name, ht.short_name AS home_short, ht.logo_url AS home_logo,
        at.name AS away_team_name, at.short_name AS away_short, at.logo_url AS away_logo
      FROM matches m
      JOIN teams ht ON ht.id = m.home_team_id
      JOIN teams at ON at.id = m.away_team_id
      WHERE m.competition_id = $1${extra}
      ORDER BY m.scheduled_at
    `, params)
    return { fixtures: rows }
  })
}
