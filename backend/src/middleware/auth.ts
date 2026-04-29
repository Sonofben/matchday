import type { FastifyRequest, FastifyReply } from 'fastify'

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Unauthorised' })
  }
}

export function requireRole(roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user
    if (!user || !roles.includes(user.role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
  }
}
