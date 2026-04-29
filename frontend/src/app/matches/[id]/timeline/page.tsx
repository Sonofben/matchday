'use client'
import { useState, useEffect, useRef } from 'react'
import useSWR from 'swr'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

const API = 'https://matchday.koraforge.com.ng/api'
const fetcher = (url: string) => apiFetch(url)

export default function TimelinePage() {
  const { id }   = useParams() as { id: string }
  const { data } = useSWR(id ? `/matches/${id}` : null, fetcher)
  const [playhead, setPlayhead]     = useState(0)
  const [playing, setPlaying]       = useState(false)
  const [speed, setSpeed]           = useState(1)
  const intervalRef = useRef<any>(null)

  const m        = (data as any)?.match
  const events   = (data as any)?.events ?? []
  const halfDur  = m?.half_duration ?? 45
  const totalMin = halfDur * 2 + (m?.added_time_ht ?? 0) + (m?.added_time_ft ?? 0)

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setPlayhead(p => {
          if (p >= totalMin) { setPlaying(false); return p }
          return p + 1
        })
      }, 600 / speed)
    }
    return () => clearInterval(intervalRef.current)
  }, [playing, speed, totalMin])

  if (!data) return <div className="h-64 bg-slate-800/40 rounded-xl animate-pulse" />
  if (!m)    return <div className="text-slate-500 p-8 text-center">Match not found</div>

  const visibleEvents = events.filter((e: any) => e.minute <= playhead)
  const homeScore = visibleEvents.filter((e: any) =>
    (e.event_type === 'goal' || e.event_type === 'penalty_goal') && e.team_id === m.home_team_id ||
    e.event_type === 'own_goal' && e.team_id === m.away_team_id
  ).length
  const awayScore = visibleEvents.filter((e: any) =>
    (e.event_type === 'goal' || e.event_type === 'penalty_goal') && e.team_id === m.away_team_id ||
    e.event_type === 'own_goal' && e.team_id === m.home_team_id
  ).length

  const eventIcon: Record<string,string> = {
    goal:'⚽', own_goal:'⚽', penalty_goal:'⚽', penalty_missed:'❌',
    yellow_card:'🟨', red_card:'🟥', yellow_red_card:'🟨🟥', substitution:'🔄',
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Link href={`/matches/${id}`} className="text-slate-400 hover:text-white text-sm">← Match</Link>
        <span className="text-slate-600">·</span>
        <span className="text-white font-medium">Timeline Replay</span>
      </div>

      {/* Live score at playhead */}
      <div className="bg-[#141920] border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-slate-500">{m.competition_name}</span>
          <span className="text-sm font-bold text-white tabular-nums bg-slate-800 px-3 py-1 rounded-full">{playhead}'</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <div className="text-white font-bold">{m.home_short ?? m.home_team_name}</div>
          </div>
          <div className="text-5xl font-bold text-white tabular-nums px-6">
            {homeScore}<span className="text-slate-600 mx-2">-</span>{awayScore}
          </div>
          <div className="text-center flex-1">
            <div className="text-white font-bold">{m.away_short ?? m.away_team_name}</div>
          </div>
        </div>
      </div>

      {/* Playback controls */}
      <div className="bg-[#141920] border border-slate-800 rounded-2xl p-4">
        <input type="range" min={0} max={totalMin} value={playhead}
          onChange={e => { setPlaying(false); setPlayhead(Number(e.target.value)) }}
          className="w-full mb-3" />

        {/* Event markers on timeline */}
        <div className="relative h-4 mb-3">
          {events.map((e: any, i: number) => {
            const pct = (e.minute / totalMin) * 100
            const isGoal = e.event_type === 'goal' || e.event_type === 'penalty_goal' || e.event_type === 'own_goal'
            const isCard = e.event_type === 'yellow_card' || e.event_type === 'red_card'
            return (
              <div key={i} title={`${e.minute}' — ${e.event_type.replace('_',' ')}`}
                style={{ left: `${pct}%`, position:'absolute', top:0, transform:'translateX(-50%)' }}
                className={`w-2 h-4 rounded-sm cursor-pointer ${isGoal ? 'bg-green-500' : isCard ? (e.event_type === 'yellow_card' ? 'bg-yellow-400' : 'bg-red-500') : 'bg-slate-500'}`}
                onClick={() => { setPlaying(false); setPlayhead(e.minute) }}
              />
            )
          })}
          {/* HT marker */}
          <div style={{ left:`${(halfDur / totalMin) * 100}%`, position:'absolute', top:0 }}
            className="w-0.5 h-4 bg-slate-600" title="Half time" />
        </div>

        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setPlayhead(0)}
            className="text-slate-400 hover:text-white text-lg px-2">⏮</button>
          <button onClick={() => setPlayhead(p => Math.max(0, p - 5))}
            className="text-slate-400 hover:text-white text-lg px-2">⏪</button>
          <button onClick={() => setPlaying(p => !p)}
            className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-xl font-bold text-lg transition-colors">
            {playing ? '⏸' : '▶'}
          </button>
          <button onClick={() => setPlayhead(p => Math.min(totalMin, p + 5))}
            className="text-slate-400 hover:text-white text-lg px-2">⏩</button>
          <button onClick={() => setPlayhead(totalMin)}
            className="text-slate-400 hover:text-white text-lg px-2">⏭</button>
          <select value={speed} onChange={e => setSpeed(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none">
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={4}>4×</option>
          </select>
        </div>
      </div>

      {/* Events up to playhead */}
      <div className="bg-[#141920] border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 text-sm font-medium text-white">
          Events — {playhead === 0 ? 'Press play to replay' : `Up to ${playhead}'`}
        </div>
        {visibleEvents.length === 0
          ? <div className="py-8 text-center text-slate-600 text-sm">No events yet</div>
          : [...visibleEvents].reverse().map((ev: any, i: number) => {
              const isHome = ev.team_id === m.home_team_id
              const name   = ev.display_name ?? (ev.first_name ? `${ev.first_name} ${ev.last_name}` : null)
              const assist = ev.assist_first ? `${ev.assist_first} ${ev.assist_last}` : null
              return (
                <div key={`${ev.id}-${i}`} className={`flex items-start gap-3 px-4 py-3 border-b border-slate-800/50 last:border-0 ${i === 0 ? 'bg-green-500/5' : ''}`}>
                  <span className={`flex items-start gap-3 w-full ${!isHome ? 'flex-row-reverse' : ''}`}>
                    <span className="font-mono text-xs text-slate-500 w-10 text-center pt-0.5 flex-shrink-0">{ev.minute}'</span>
                    <span className="text-base flex-shrink-0">{eventIcon[ev.event_type] ?? '•'}</span>
                    <span className={`flex-1 min-w-0 ${!isHome ? 'text-right' : ''}`}>
                      <span className="text-sm text-white font-medium">{name ?? ev.team_name}</span>
                      {assist && <span className="text-xs text-slate-400 ml-1.5">Assist: {assist}</span>}
                      <span className="block text-xs text-slate-500">{ev.team_name}</span>
                    </span>
                  </span>
                </div>
              )
            })
        }
      </div>
    </div>
  )
}
