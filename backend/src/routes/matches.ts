import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../db/client.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import { recalculateStandings } from './standings.js'

const UpdateMatchSchema = z.object({
  status:           z.enum(['scheduled','live','half_time','finished','postponed','cancelled']).optional(),
  minute:           z.number().int().min(0).max(200).optional(),
  home_score:       z.number().int().min(0).optional(),
  away_score:       z.number().int().min(0).optional(),
  timer_running:    z.boolean().optional(),
  timer_started_at: z.string().optional(),
  timer_offset:     z.number().int().optional(),
  current_half:     z.number().int().optional(),
  added_time_ht:    z.number().int().optional(),
  added_time_ft:    z.number().int().optional(),
  home_score_ht:    z.number().int().optional(),
  away_score_ht:    z.number().int().optional(),
})

const AddEventSchema = z.object({
  event_type:        z.enum(['goal','own_goal','penalty_goal','penalty_missed','yellow_card','red_card','yellow_red_card','substitution','var_decision']),
  minute:            z.number().int().min(0).max(200),
  extra_time:        z.number().int().optional(),
  team_id:           z.string().uuid(),
  player_id:         z.string().uuid().optional(),
  assist_player_id:  z.string().uuid().optional(),
  sub_player_out_id: z.string().uuid().optional(),
  notes:             z.string().optional(),
})

const SetLineupSchema = z.object({
  team_id:    z.string().uuid(),
  players:    z.array(z.object({
    player_id:     z.string().uuid(),
    jersey_number: z.number().int().optional(),
    position:      z.enum(['goalkeeper','defender','midfielder','forward']).optional(),
    is_starter:    z.boolean(),
    is_captain:    z.boolean().optional(),
  })),
  coach_name: z.string().optional(),
  confirmed:  z.boolean().optional(),
})

const SetStatsSchema = z.object({
  team_id:             z.string().uuid(),
  shots_total:         z.number().int().optional(),
  shots_on_target:     z.number().int().optional(),
  possession_pct:      z.number().optional(),
  passes_total:        z.number().int().optional(),
  passes_accuracy_pct: z.number().optional(),
  fouls:               z.number().int().optional(),
  corners:             z.number().int().optional(),
  offsides:            z.number().int().optional(),
})

export async function matchRoutes(app: FastifyInstance) {

  // GET /api/matches
  app.get('/', async (req) => {
    const q      = req.query as Record<string, string>
    const status = q.status ?? null
    const date   = q.date   ?? null
    const compId = q.competition_id ?? null
    const teamId = q.team_id ?? null
    const limit  = Math.min(Number(q.limit ?? 50), 100)
    const offset = Number(q.offset ?? 0)

    const conditions: string[] = []
    const params: unknown[] = []
    let p = 1
    if (status) { conditions.push(`m.status = $${p++}`); params.push(status) }
    if (date)   { conditions.push(`DATE(m.scheduled_at) = $${p++}`); params.push(date) }
    if (compId) { conditions.push(`m.competition_id = $${p++}`); params.push(compId) }
    if (teamId) { conditions.push(`(m.home_team_id = $${p} OR m.away_team_id = $${p})`); params.push(teamId); p++ }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows } = await db.query(`
      SELECT m.*,
        ht.name AS home_team_name, ht.short_name AS home_short, ht.logo_url AS home_logo, ht.primary_color AS home_color,
        at.name AS away_team_name, at.short_name AS away_short, at.logo_url AS away_logo, at.primary_color AS away_color,
        c.name AS competition_name, c.logo_url AS competition_logo, c.half_duration, c.team_size
      FROM matches m
      JOIN teams ht ON ht.id = m.home_team_id
      JOIN teams at ON at.id = m.away_team_id
      JOIN competitions c ON c.id = m.competition_id
      ${where}
      ORDER BY m.scheduled_at DESC
      LIMIT $${p++} OFFSET $${p++}
    `, [...params, limit, offset])
    return { matches: rows }
  })

  // GET /api/matches/:id
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const { id } = req.params
    const matchRes = await db.query(`
      SELECT m.*,
        ht.name AS home_team_name, ht.short_name AS home_short, ht.logo_url AS home_logo, ht.primary_color AS home_color,
        at.name AS away_team_name, at.short_name AS away_short, at.logo_url AS away_logo, at.primary_color AS away_color,
        c.name AS competition_name, c.logo_url AS competition_logo, c.format AS competition_format,
        c.half_duration, c.team_size, c.has_extra_time, c.has_penalties
      FROM matches m
      JOIN teams ht ON ht.id = m.home_team_id
      JOIN teams at ON at.id = m.away_team_id
      JOIN competitions c ON c.id = m.competition_id
      WHERE m.id = $1
    `, [id])
    if (!matchRes.rows[0]) return reply.status(404).send({ error: 'Match not found' })

    const [eventsRes, lineupRes, statsRes, coachRes] = await Promise.all([
      db.query(`
        SELECT e.*,
          p.first_name, p.last_name, p.display_name, p.photo_url,
          ap.first_name AS assist_first, ap.last_name AS assist_last,
          sp.first_name AS sub_out_first, sp.last_name AS sub_out_last,
          t.short_name AS team_short, t.name AS team_name, t.primary_color AS team_color
        FROM match_events e
        LEFT JOIN players p  ON p.id = e.player_id
        LEFT JOIN players ap ON ap.id = e.assist_player_id
        LEFT JOIN players sp ON sp.id = e.sub_player_out_id
        JOIN teams t ON t.id = e.team_id
        WHERE e.match_id = $1
        ORDER BY e.minute, e.extra_time NULLS LAST, e.created_at
      `, [id]),
      db.query(`
        SELECT l.*, p.first_name, p.last_name, p.display_name, p.photo_url, p.position AS player_pos
        FROM match_lineups l
        JOIN players p ON p.id = l.player_id
        WHERE l.match_id = $1
        ORDER BY l.team_id, l.is_starter DESC, l.jersey_number NULLS LAST
      `, [id]),
      db.query(`SELECT * FROM match_stats WHERE match_id = $1`, [id]),
      db.query(`SELECT * FROM match_coaches WHERE match_id = $1`, [id]),
    ])

    return { match: matchRes.rows[0], events: eventsRes.rows, lineups: lineupRes.rows, stats: statsRes.rows, coaches: coachRes.rows }
  })

  // PATCH /api/matches/:id
  app.patch<{ Params: { id: string }; Body: unknown }>(
    '/:id',
    { preHandler: [authenticate, requireRole(['admin','scorer'])] },
    async (req, reply) => {
      const { id } = req.params
      const body   = UpdateMatchSchema.parse(req.body)
      const sets: string[] = []; const params: unknown[] = []; let p = 1

      const fields = ['status','minute','home_score','away_score','timer_running','timer_started_at',
        'timer_offset','current_half','added_time_ht','added_time_ft','home_score_ht','away_score_ht']
      for (const f of fields) {
        if ((body as any)[f] !== undefined) { sets.push(`${f} = $${p++}`); params.push((body as any)[f]) }
      }
      if (!sets.length) return reply.status(400).send({ error: 'Nothing to update' })
      params.push(id)

      const { rows } = await db.query(
        `UPDATE matches SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${p} RETURNING *`,
        params
      )
      if (!rows[0]) return reply.status(404).send({ error: 'Match not found' })

      // Auto-recalculate standings when match finishes
      if (body.status === 'finished') {
        try { await recalculateStandings(rows[0].competition_id) } catch (e) { console.error('Standings recalc failed:', e) }
      }

      const io = (app as any).io
      io?.to(`match:${id}`).emit('match:updated', rows[0])
      io?.to('live').emit('live:score', {
        matchId: id, homeScore: rows[0].home_score, awayScore: rows[0].away_score,
        status: rows[0].status, minute: rows[0].minute,
      })
      return rows[0]
    }
  )

  // POST /api/matches/:id/events
  app.post<{ Params: { id: string }; Body: unknown }>(
    '/:id/events',
    { preHandler: [authenticate, requireRole(['admin','scorer'])] },
    async (req, reply) => {
      const { id } = req.params
      const body   = AddEventSchema.parse(req.body)
      const user   = (req as any).user

      const { rows } = await db.query(`
        INSERT INTO match_events
          (match_id, event_type, minute, extra_time, team_id, player_id,
           assist_player_id, sub_player_out_id, notes, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
      `, [id, body.event_type, body.minute, body.extra_time ?? null,
          body.team_id, body.player_id ?? null, body.assist_player_id ?? null,
          body.sub_player_out_id ?? null, body.notes ?? null, user.id])

      if (['goal','own_goal','penalty_goal'].includes(body.event_type)) {
        await recalculateScore(id)
      }

      // Update player competition stats
      await updatePlayerStats(id, body)

      const enriched = await db.query(`
        SELECT e.*,
          p.first_name, p.last_name, p.display_name, p.photo_url,
          ap.first_name AS assist_first, ap.last_name AS assist_last,
          sp.first_name AS sub_out_first, sp.last_name AS sub_out_last,
          t.short_name AS team_short, t.name AS team_name, t.primary_color AS team_color
        FROM match_events e
        LEFT JOIN players p  ON p.id = e.player_id
        LEFT JOIN players ap ON ap.id = e.assist_player_id
        LEFT JOIN players sp ON sp.id = e.sub_player_out_id
        JOIN teams t ON t.id = e.team_id
        WHERE e.id = $1
      `, [rows[0].id])

      const io = (app as any).io
      io?.to(`match:${id}`).emit('match:event', enriched.rows[0])
      return reply.status(201).send(enriched.rows[0])
    }
  )

  // DELETE /api/matches/:id/events/:eventId
  app.delete<{ Params: { id: string; eventId: string } }>(
    '/:id/events/:eventId',
    { preHandler: [authenticate, requireRole(['admin','scorer'])] },
    async (req, reply) => {
      const { id, eventId } = req.params
      const evRes = await db.query('SELECT * FROM match_events WHERE id=$1 AND match_id=$2', [eventId, id])
      if (!evRes.rows[0]) return reply.status(404).send({ error: 'Event not found' })
      await db.query('DELETE FROM match_events WHERE id=$1', [eventId])
      if (['goal','own_goal','penalty_goal'].includes(evRes.rows[0].event_type)) await recalculateScore(id)
      const io = (app as any).io
      io?.to(`match:${id}`).emit('match:event_deleted', { eventId })
      return reply.status(204).send()
    }
  )

  // POST /api/matches/:id/lineups
  app.post<{ Params: { id: string }; Body: unknown }>(
    '/:id/lineups',
    { preHandler: [authenticate, requireRole(['admin','scorer'])] },
    async (req, reply) => {
      const { id } = req.params
      const body   = SetLineupSchema.parse(req.body)
      const client = await db.connect()
      try {
        await client.query('BEGIN')
        await client.query('DELETE FROM match_lineups WHERE match_id=$1 AND team_id=$2', [id, body.team_id])
        for (const pl of body.players) {
          await client.query(`
            INSERT INTO match_lineups (match_id, team_id, player_id, jersey_number, position, is_starter, is_captain, confirmed)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          `, [id, body.team_id, pl.player_id, pl.jersey_number ?? null,
              pl.position ?? null, pl.is_starter, pl.is_captain ?? false, body.confirmed ?? false])
        }
        if (body.coach_name) {
          await client.query(`
            INSERT INTO match_coaches (match_id, team_id, coach_name) VALUES ($1,$2,$3)
            ON CONFLICT (match_id, team_id) DO UPDATE SET coach_name = EXCLUDED.coach_name
          `, [id, body.team_id, body.coach_name])
        }
        await client.query('COMMIT')
        const io = (app as any).io
        io?.to(`match:${id}`).emit('match:lineup_updated', { teamId: body.team_id })
        return reply.status(201).send({ ok: true })
      } catch (e) { await client.query('ROLLBACK'); throw e }
      finally { client.release() }
    }
  )

  // POST /api/matches/:id/stats
  app.post<{ Params: { id: string }; Body: unknown }>(
    '/:id/stats',
    { preHandler: [authenticate, requireRole(['admin','scorer'])] },
    async (req, reply) => {
      const { id } = req.params
      const body   = SetStatsSchema.parse(req.body)
      const sets: string[] = []; const params: unknown[] = []; let p = 1
      for (const f of ['shots_total','shots_on_target','possession_pct','passes_total','passes_accuracy_pct','fouls','corners','offsides']) {
        if ((body as any)[f] !== undefined) { sets.push(`${f} = $${p++}`); params.push((body as any)[f]) }
      }
      params.push(id, body.team_id)
      await db.query(`
        INSERT INTO match_stats (match_id, team_id) VALUES ($${p}, $${p+1})
        ON CONFLICT (match_id, team_id) DO UPDATE SET ${sets.length ? sets.join(', ') : 'match_id = match_id'}
      `, params)
      return reply.status(200).send({ ok: true })
    }
  )
}

async function recalculateScore(matchId: string) {
  await db.query(`
    UPDATE matches SET
      home_score = (
        SELECT COUNT(*) FROM match_events e JOIN matches m ON m.id = e.match_id
        WHERE e.match_id = $1 AND (
          (e.event_type IN ('goal','penalty_goal') AND e.team_id = m.home_team_id) OR
          (e.event_type = 'own_goal' AND e.team_id = m.away_team_id)
        )
      ),
      away_score = (
        SELECT COUNT(*) FROM match_events e JOIN matches m ON m.id = e.match_id
        WHERE e.match_id = $1 AND (
          (e.event_type IN ('goal','penalty_goal') AND e.team_id = m.away_team_id) OR
          (e.event_type = 'own_goal' AND e.team_id = m.home_team_id)
        )
      )
    WHERE id = $1
  `, [matchId])
}

async function updatePlayerStats(matchId: string, event: any) {
  // Get match competition + season
  const matchRes = await db.query(`
    SELECT m.competition_id, s.id AS season_id, m.home_team_id, m.away_team_id
    FROM matches m
    LEFT JOIN seasons s ON s.is_current = TRUE
    WHERE m.id = $1
  `, [matchId])
  if (!matchRes.rows[0]) return
  const { competition_id, season_id } = matchRes.rows[0]

  const upsert = async (playerId: string, teamId: string, field: string, delta = 1) => {
    if (!playerId || !teamId) return
    await db.query(`
      INSERT INTO player_competition_stats (player_id, competition_id, season_id, team_id, ${field})
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (player_id, competition_id, season_id) DO UPDATE
      SET ${field} = player_competition_stats.${field} + $5, updated_at = NOW()
    `, [playerId, competition_id, season_id, teamId, delta])
  }

  if (['goal','penalty_goal'].includes(event.event_type) && event.player_id) {
    await upsert(event.player_id, event.team_id, 'goals')
    if (event.assist_player_id) await upsert(event.assist_player_id, event.team_id, 'assists')
  }
  if (event.event_type === 'yellow_card' && event.player_id)
    await upsert(event.player_id, event.team_id, 'yellow_cards')
  if (['red_card','yellow_red_card'].includes(event.event_type) && event.player_id)
    await upsert(event.player_id, event.team_id, 'red_cards')
}
