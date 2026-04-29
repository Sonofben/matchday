import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '../db/client.js'

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Unauthorised' })
  }
}

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: unknown }>('/login', async (req, reply) => {
    try {
      const { email, password } = LoginSchema.parse(req.body)
      const { rows } = await db.query(
        'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
        [email]
      )
      const user = rows[0]
      if (!user) return reply.status(401).send({ error: 'Invalid credentials' })

      const match = await bcrypt.compare(password, user.password_hash)
      if (!match) return reply.status(401).send({ error: 'Invalid credentials' })

      // Token valid for 24 hours — no more expiry issues
      const token = app.jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        { expiresIn: '24h' }
      )

      await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id])

      return reply.send({
        token,
        user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
      })
    } catch (e: any) {
      return reply.status(400).send({ error: e.message })
    }
  })

  app.get('/me', { preHandler: authenticate }, async (req) => {
    return { user: (req as any).user }
  })
}
