'use client'
import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'https://matchday.koraforge.com.ng/api'

let globalSocket: Socket | null = null

function getSocket(): Socket {
  if (!globalSocket) {
    globalSocket = io(WS_URL, { transports: ['websocket'], autoConnect: true })
  }
  return globalSocket
}

/** Subscribe to the live scores feed */
export function useLiveScores(onUpdate: (data: { matchId: string; homeScore: number; awayScore: number; status: string }) => void) {
  useEffect(() => {
    const s = getSocket()
    s.emit('subscribe:live')
    s.on('live:score', onUpdate)
    return () => { s.off('live:score', onUpdate) }
  }, [onUpdate])
}

/** Subscribe to a specific match room */
export function useMatchRoom(
  matchId: string | null,
  handlers: {
    onEvent?: (event: unknown) => void
    onUpdate?: (match: unknown) => void
  }
) {
  useEffect(() => {
    if (!matchId) return
    const s = getSocket()
    s.emit('subscribe:match', matchId)
    if (handlers.onEvent)  s.on('match:event',   handlers.onEvent)
    if (handlers.onUpdate) s.on('match:updated', handlers.onUpdate)
    return () => {
      s.emit('unsubscribe:match', matchId)
      if (handlers.onEvent)  s.off('match:event',   handlers.onEvent)
      if (handlers.onUpdate) s.off('match:updated', handlers.onUpdate)
    }
  }, [matchId])
}
