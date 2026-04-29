import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import { registerRoutes } from './routes/index.js'

const app = Fastify({ logger: false })

await app.register(cors, { origin: '*', credentials: true })
await app.register(jwt, { secret: process.env.JWT_SECRET ?? 'dev_secret_32_chars_minimum_here' })
await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } }) // 5MB

// Serve uploaded files
app.get('/uploads/:filename', async (req: any, reply) => {
  const { createReadStream, existsSync } = await import('fs')
  const { join, dirname } = await import('path')
  const { fileURLToPath } = await import('url')
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const filePath = join(__dirname, '..', '..', 'uploads', req.params.filename)
  if (!existsSync(filePath)) return reply.status(404).send({ error: 'Not found' })
  return reply.send(createReadStream(filePath))
})

await registerRoutes(app)

app.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }))

try {
  await app.listen({ port: 4000, host: '0.0.0.0' })
  console.log('🚀 MatchDay API running on http://localhost:4000')
} catch (err) {
  console.error('Server failed to start:', err)
  process.exit(1)
}
