import type { FastifyInstance } from 'fastify'
import { authRoutes } from './auth.js'
import { matchRoutes } from './matches.js'
import { competitionRoutes } from './competitions.js'
import { teamRoutes } from './teams.js'
import { playerRoutes, playerStatsRoutes } from './players.js'
import { standingsRoutes } from './standings.js'
import { adminRoutes } from './admin.js'

export async function registerRoutes(app: FastifyInstance) {
  await app.register(authRoutes,        { prefix: '/api/auth' })
  await app.register(matchRoutes,       { prefix: '/api/matches' })
  await app.register(competitionRoutes, { prefix: '/api/competitions' })
  await app.register(teamRoutes,        { prefix: '/api/teams' })
  await app.register(playerRoutes,      { prefix: '/api/players' })
  await app.register(playerStatsRoutes, { prefix: '/api/stats' })
  await app.register(standingsRoutes,   { prefix: '/api/standings' })
  await app.register(adminRoutes,       { prefix: '/api/admin' })
}
