import type { Server, Socket } from 'socket.io'
import { redis } from '../db/redis.js'

export function setupWebSocket(io: Server) {

  io.on('connection', (socket: Socket) => {
    console.log(`⚡ WS connected: ${socket.id}`)

    // Client subscribes to live feed (all live matches)
    socket.on('subscribe:live', () => {
      socket.join('live')
    })

    // Client subscribes to a specific match room
    socket.on('subscribe:match', (matchId: string) => {
      if (typeof matchId === 'string' && matchId.length < 64) {
        socket.join(`match:${matchId}`)
      }
    })

    socket.on('unsubscribe:match', (matchId: string) => {
      socket.leave(`match:${matchId}`)
    })

    // Scorer heartbeat — keeps "live" indicator green
    socket.on('scorer:ping', async (data: { matchId: string; minute: number }) => {
      if (!data?.matchId) return
      await redis.setex(`scorer:active:${data.matchId}`, 30, '1')
      io.to(`match:${data.matchId}`).emit('scorer:active', { matchId: data.matchId })
    })

    socket.on('disconnect', () => {
      console.log(`⚡ WS disconnected: ${socket.id}`)
    })
  })
}
