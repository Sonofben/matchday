import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '../db/client.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = join(__dirname, '..', '..', '..', 'uploads')
mkdirSync(UPLOADS_DIR, { recursive: true })

const guard = { preHandler: [authenticate, requireRole(['admin'])] }

const CreateCompetitionSchema = z.object({
  name:           z.string().min(1),
  short_name:     z.string().optional(),
  format:         z.enum(['league','cup','group_stage','knockout','friendly']).default('league'),
  bracket_type:   z.enum(['league','cup','group_knockout','league_cup']).default('league'),
  team_size:      z.number().int().refine(v => [5,7,11].includes(v)).default(11),
  half_duration:  z.number().int().min(5).max(60).default(45),
  has_extra_time: z.boolean().default(true),
  has_penalties:  z.boolean().default(true),
  country_id:     z.number().int().optional(),
  season_id:      z.number().int().optional(),
  is_local:       z.boolean().default(false),
})

const CreateMatchSchema = z.object({
  competition_id: z.string().uuid(),
  home_team_id:   z.string().uuid(),
  away_team_id:   z.string().uuid(),
  scheduled_at:   z.string().datetime(),
  venue:          z.string().optional(),
  referee:        z.string().optional(),
  round:          z.string().optional(),
  is_friendly:    z.boolean().optional().default(false),
})

const CreateTeamSchema = z.object({
  name:          z.string().min(1),
  short_name:    z.string().optional(),
  country_id:    z.number().int().optional(),
  home_stadium:  z.string().optional(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  coach_name:    z.string().optional(),
  is_local:      z.boolean().optional(),
})

const CreatePlayerSchema = z.object({
  first_name:    z.string().min(1),
  last_name:     z.string().min(1),
  display_name:  z.string().optional(),
  date_of_birth: z.string().optional(),
  nationality:   z.number().int().optional(),
  position:      z.enum(['goalkeeper','defender','midfielder','forward']).optional(),
  jersey_number: z.number().int().optional(),
  team_id:       z.string().uuid().optional(),
})

const CreateBracketSchema = z.object({
  competition_id: z.string().uuid(),
  rounds: z.array(z.object({
    round_name:  z.string(),
    round_order: z.number().int(),
    slots: z.array(z.object({
      slot_number:  z.number().int(),
      home_team_id: z.string().uuid().optional(),
      away_team_id: z.string().uuid().optional(),
    }))
  }))
})

export async function adminRoutes(app: FastifyInstance) {

  // ── Dashboard ─────────────────────────────────────────────────────────────
  app.get('/stats', guard, async () => {
    const { rows } = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM matches WHERE status='live')::int           AS live_matches,
        (SELECT COUNT(*) FROM matches WHERE status='scheduled' AND DATE(scheduled_at)=CURRENT_DATE)::int AS today_matches,
        (SELECT COUNT(*) FROM teams)::int                                 AS total_teams,
        (SELECT COUNT(*) FROM players)::int                               AS total_players,
        (SELECT COUNT(*) FROM competitions WHERE is_active=TRUE)::int     AS active_competitions
    `)
    return rows[0]
  })

  // ── Competitions ──────────────────────────────────────────────────────────
  app.post<{ Body: unknown }>('/competitions', guard, async (req, reply) => {
    const body = CreateCompetitionSchema.parse(req.body)
    const { rows } = await db.query(`
      INSERT INTO competitions
        (name,short_name,format,bracket_type,team_size,half_duration,has_extra_time,has_penalties,country_id,season_id,is_local,is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE) RETURNING *
    `, [body.name,body.short_name??null,body.format,body.bracket_type,body.team_size,body.half_duration,
        body.has_extra_time,body.has_penalties,body.country_id??null,body.season_id??null,body.is_local])
    return reply.status(201).send(rows[0])
  })

  // Edit competition
  app.patch<{ Params: { id: string }; Body: unknown }>('/competitions/:id', guard, async (req, reply) => {
    const body = CreateCompetitionSchema.partial().parse(req.body)
    const sets: string[] = []; const params: unknown[] = []; let p = 1
    const fields = ['name','short_name','format','bracket_type','team_size','half_duration',
                    'has_extra_time','has_penalties','is_local','is_active']
    for (const f of fields) {
      if ((body as any)[f] !== undefined) { sets.push(`${f}=$${p++}`); params.push((body as any)[f]) }
    }
    if (!sets.length) return reply.status(400).send({ error: 'Nothing to update' })
    params.push(req.params.id)
    const { rows } = await db.query(
      `UPDATE competitions SET ${sets.join(',')} WHERE id=$${p} RETURNING *`, params
    )
    return rows[0]
  })

  // Delete competition (cascades all related data)
  app.delete<{ Params: { id: string } }>('/competitions/:id', guard, async (req, reply) => {
    const { id } = req.params
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      const matches = await client.query('SELECT id FROM matches WHERE competition_id=$1', [id])
      for (const m of matches.rows) {
        await client.query('DELETE FROM match_events  WHERE match_id=$1', [m.id])
        await client.query('DELETE FROM match_lineups WHERE match_id=$1', [m.id])
        await client.query('DELETE FROM match_coaches WHERE match_id=$1', [m.id])
        await client.query('DELETE FROM match_stats   WHERE match_id=$1', [m.id])
      }
      await client.query('DELETE FROM matches                  WHERE competition_id=$1', [id])
      await client.query('DELETE FROM standings                WHERE competition_id=$1', [id])
      await client.query('DELETE FROM player_competition_stats WHERE competition_id=$1', [id])
      await client.query('DELETE FROM competition_teams        WHERE competition_id=$1', [id])
      const rounds = await client.query('SELECT id FROM bracket_rounds WHERE competition_id=$1', [id])
      for (const r of rounds.rows) await client.query('DELETE FROM bracket_slots WHERE round_id=$1', [r.id])
      await client.query('DELETE FROM bracket_rounds WHERE competition_id=$1', [id])
      await client.query('DELETE FROM competitions   WHERE id=$1', [id])
      await client.query('COMMIT')
      return reply.status(204).send()
    } catch (e) { await client.query('ROLLBACK'); throw e }
    finally { client.release() }
  })

  // ── Matches ───────────────────────────────────────────────────────────────
  app.post<{ Body: unknown }>('/matches', guard, async (req, reply) => {
    const body = CreateMatchSchema.parse(req.body)
    const compRes = await db.query('SELECT half_duration FROM competitions WHERE id=$1', [body.competition_id])
    const halfDuration = compRes.rows[0]?.half_duration ?? 45
    const { rows } = await db.query(`
      INSERT INTO matches (competition_id,home_team_id,away_team_id,scheduled_at,venue,referee,round,half_duration,is_friendly)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [body.competition_id,body.home_team_id,body.away_team_id,body.scheduled_at,
        body.venue??null,body.referee??null,body.round??null,halfDuration,body.is_friendly ?? false])
    return reply.status(201).send(rows[0])
  })

  app.delete<{ Params: { id: string } }>('/matches/:id', guard, async (req, reply) => {
    await db.query('DELETE FROM match_events  WHERE match_id=$1', [req.params.id])
    await db.query('DELETE FROM match_lineups WHERE match_id=$1', [req.params.id])
    await db.query('DELETE FROM match_coaches WHERE match_id=$1', [req.params.id])
    await db.query('DELETE FROM match_stats   WHERE match_id=$1', [req.params.id])
    await db.query('DELETE FROM matches       WHERE id=$1',       [req.params.id])
    return reply.status(204).send()
  })

  // PATCH /admin/matches/:id — admin can edit/reschedule/toggle friendly after creation
  app.patch<{ Params: { id: string }; Body: unknown }>('/matches/:id', guard, async (req, reply) => {
    const body = CreateMatchSchema.partial().parse(req.body)
    const sets: string[] = []; const params: unknown[] = []; let p = 1
    const fields = ['competition_id','home_team_id','away_team_id','scheduled_at','venue','referee','round','is_friendly']
    for (const f of fields) {
      if ((body as any)[f] !== undefined) { sets.push(`${f}=$${p++}`); params.push((body as any)[f]) }
    }
    if (!sets.length) return reply.status(400).send({ error: 'Nothing to update' })
    params.push(req.params.id)
    const { rows } = await db.query(
      `UPDATE matches SET ${sets.join(',')}, updated_at = NOW() WHERE id=$${p} RETURNING *`,
      params
    )
    if (!rows[0]) return reply.status(404).send({ error: 'Match not found' })
    // If friendly status changed and match is finished, recalc standings for the competition
    if (body.is_friendly !== undefined && rows[0].status === 'finished') {
      try {
        const { recalculateStandings } = await import('./standings.js')
        await recalculateStandings(rows[0].competition_id)
      } catch (e) { console.error('Standings recalc after friendly-toggle failed:', e) }
    }
    return rows[0]
  })

  // ── Teams ─────────────────────────────────────────────────────────────────
  app.post<{ Body: unknown }>('/teams', guard, async (req, reply) => {
    const body = CreateTeamSchema.parse(req.body)
    const { rows } = await db.query(`
      INSERT INTO teams (name,short_name,country_id,home_stadium,primary_color,coach_name,is_local)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [body.name,body.short_name??null,body.country_id??null,body.home_stadium??null,
        body.primary_color??null,body.coach_name??null,body.is_local??false])
    return reply.status(201).send(rows[0])
  })

  app.patch<{ Params: { id: string }; Body: unknown }>('/teams/:id', guard, async (req, reply) => {
    const body = CreateTeamSchema.partial().parse(req.body)
    const sets: string[] = []; const params: unknown[] = []; let p = 1
    for (const f of ['name','short_name','home_stadium','primary_color','coach_name','logo_url']) {
      if ((body as any)[f] !== undefined) { sets.push(`${f}=$${p++}`); params.push((body as any)[f]) }
    }
    if (!sets.length) return reply.status(400).send({ error: 'Nothing to update' })
    params.push(req.params.id)
    const { rows } = await db.query(`UPDATE teams SET ${sets.join(',')} WHERE id=$${p} RETURNING *`, params)
    return rows[0]
  })

  app.delete<{ Params: { id: string } }>('/teams/:id', guard, async (req, reply) => {
    const { id } = req.params
    await db.query('DELETE FROM player_team_contracts WHERE team_id=$1', [id])
    await db.query('DELETE FROM competition_teams     WHERE team_id=$1', [id])
    await db.query('DELETE FROM standings             WHERE team_id=$1', [id])
    await db.query('DELETE FROM teams                 WHERE id=$1',      [id])
    return reply.status(204).send()
  })

  // ── Players ───────────────────────────────────────────────────────────────
  app.post<{ Body: unknown }>('/players', guard, async (req, reply) => {
    const body = CreatePlayerSchema.parse(req.body)
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query(`
        INSERT INTO players (first_name,last_name,display_name,date_of_birth,nationality,position,jersey_number)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
      `, [body.first_name,body.last_name,body.display_name??null,body.date_of_birth??null,
          body.nationality??null,body.position??null,body.jersey_number??null])
      if (body.team_id) {
        await client.query(`
          INSERT INTO player_team_contracts (player_id,team_id,jersey_number,start_date,is_current)
          VALUES ($1,$2,$3,CURRENT_DATE,TRUE) ON CONFLICT DO NOTHING
        `, [rows[0].id,body.team_id,body.jersey_number??null])
      }
      await client.query('COMMIT')
      return reply.status(201).send(rows[0])
    } catch (e) { await client.query('ROLLBACK'); throw e }
    finally { client.release() }
  })

  app.delete<{ Params: { id: string } }>('/players/:id', guard, async (req, reply) => {
    const { id } = req.params
    await db.query('DELETE FROM player_competition_stats WHERE player_id=$1', [id])
    await db.query('DELETE FROM player_team_contracts    WHERE player_id=$1', [id])
    await db.query('DELETE FROM match_lineups            WHERE player_id=$1', [id])
    await db.query('DELETE FROM players                  WHERE id=$1',        [id])
    return reply.status(204).send()
  })

  // ── Scorers ───────────────────────────────────────────────────────────────
  app.post<{ Body: unknown }>('/scorers', guard, async (req, reply) => {
    const body = z.object({ email:z.string().email(), full_name:z.string(), password:z.string().min(8) }).parse(req.body)
    const hash = await bcrypt.hash(body.password, 12)
    const { rows } = await db.query(`
      INSERT INTO users (email,full_name,password_hash,role)
      VALUES ($1,$2,$3,'scorer') RETURNING id,email,full_name,role,created_at
    `, [body.email,body.full_name,hash])
    return reply.status(201).send(rows[0])
  })

  // ── Competition-team assignment ───────────────────────────────────────────
  app.post<{ Body: unknown }>('/competition-teams', guard, async (req, reply) => {
    const body = z.object({
      competition_id: z.string().uuid(),
      team_id:        z.string().uuid(),
      group_name:     z.string().optional()
    }).parse(req.body)
    await db.query(`
      INSERT INTO competition_teams (competition_id,team_id,group_name)
      VALUES ($1,$2,$3) ON CONFLICT DO NOTHING
    `, [body.competition_id,body.team_id,body.group_name??null])
    return reply.status(201).send({ ok: true })
  })

  // ── Brackets ──────────────────────────────────────────────────────────────
  app.post<{ Body: unknown }>('/brackets', guard, async (req, reply) => {
    const body = CreateBracketSchema.parse(req.body)
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      const existingRounds = await client.query('SELECT id FROM bracket_rounds WHERE competition_id=$1', [body.competition_id])
      for (const r of existingRounds.rows) await client.query('DELETE FROM bracket_slots WHERE round_id=$1', [r.id])
      await client.query('DELETE FROM bracket_rounds WHERE competition_id=$1', [body.competition_id])
      for (const round of body.rounds) {
        const rr = await client.query(`
          INSERT INTO bracket_rounds (competition_id,round_name,round_order) VALUES ($1,$2,$3) RETURNING id
        `, [body.competition_id,round.round_name,round.round_order])
        for (const slot of round.slots) {
          await client.query(`
            INSERT INTO bracket_slots (round_id,slot_number,home_team_id,away_team_id)
            VALUES ($1,$2,$3,$4)
          `, [rr.rows[0].id,slot.slot_number,slot.home_team_id??null,slot.away_team_id??null])
        }
      }
      await client.query('COMMIT')
      return reply.status(201).send({ ok: true })
    } catch (e) { await client.query('ROLLBACK'); throw e }
    finally { client.release() }
  })

  app.get<{ Params: { competitionId: string } }>('/brackets/:competitionId', guard, async (req) => {
    const { competitionId } = req.params
    const rounds = await db.query(`
      SELECT r.*, json_agg(s.* ORDER BY s.slot_number) AS slots
      FROM bracket_rounds r
      LEFT JOIN bracket_slots s ON s.round_id = r.id
      WHERE r.competition_id=$1
      GROUP BY r.id ORDER BY r.round_order
    `, [competitionId])
    return { rounds: rounds.rows }
  })

  // ── File upload ───────────────────────────────────────────────────────────
  app.post('/upload', { ...guard, config: { rawBody: true } }, async (req: any, reply) => {
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'No file' })
    const { entity_type, entity_id, field_name } = data.fields
    const ext      = data.filename.split('.').pop()
    const filename = `${randomUUID()}.${ext}`
    const filePath = join(UPLOADS_DIR, filename)
    const chunks: Buffer[] = []
    for await (const chunk of data.file) chunks.push(chunk)
    writeFileSync(filePath, Buffer.concat(chunks))
    const url        = `/uploads/${filename}`
    const entityType = entity_type?.value
    const entityId   = entity_id?.value
    const fieldName  = field_name?.value ?? 'photo_url'
    if (entityType === 'team')   await db.query(`UPDATE teams   SET ${fieldName}=$1 WHERE id=$2`, [url, entityId])
    if (entityType === 'player') await db.query(`UPDATE players SET photo_url=$1    WHERE id=$2`, [url, entityId])
    await db.query(`
      INSERT INTO uploads (entity_type,entity_id,field_name,filename,file_path,mime_type)
      VALUES ($1,$2,$3,$4,$5,$6)
    `, [entityType,entityId,fieldName,filename,filePath,data.mimetype])
    return reply.send({ url })
  })
}
