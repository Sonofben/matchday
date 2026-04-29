'use client'
import { useRouter } from 'next/navigation'
import { useState, useCallback, useEffect, useRef } from 'react'
import useSWR from 'swr'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import { apiFetch } from '@/lib/api'
import { useMatchRoom } from '@/hooks/useSocket'
import { StatusBadge, TeamLogo, Card } from '@/components/ui'
import clsx from 'clsx'

const API = 'https://matchday.koraforge.com.ng/api'
const fetcher = (url: string) => apiFetch(url)
const TABS = ['Summary', 'Lineups', 'Stats', 'Timeline', 'Penalties']

export default function MatchPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [tab, setTab] = useState('Summary')
  const [liveMinute, setLiveMinute] = useState<number | null>(null)
  const timerRef = useRef<any>(null)

  const { data, mutate } = useSWR(id ? `/matches/${id}` : null, fetcher, { refreshInterval: 20000 })

  const m = (data as any)?.match
  const events  = (data as any)?.events  ?? []
  const lineups = (data as any)?.lineups ?? []
  const stats   = (data as any)?.stats   ?? []
  const coaches = (data as any)?.coaches ?? []

  // Auto-advance timer for live matches
  useEffect(() => {
    if (!m) return
    if (m.status === 'live' && m.timer_running && m.timer_started_at) {
      const startedAt = new Date(m.timer_started_at).getTime()
      const offset = m.timer_offset ?? 0
      const update = () => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000 / 60) + offset
        setLiveMinute(Math.min(elapsed, (m.half_duration ?? 45) * 2 + 30))
      }
      update()
      timerRef.current = setInterval(update, 15000)
      return () => clearInterval(timerRef.current)
    } else {
      setLiveMinute(m.minute ?? null)
    }
  }, [m?.status, m?.timer_running, m?.timer_started_at, m?.timer_offset])


  // Navigate to sub-pages for Timeline and Penalties
  function handleTab(t: string) {
    if (t === 'Timeline')  { router.push(`/matches/${id}/timeline`);  return }
    if (t === 'Penalties') { router.push(`/matches/${id}/penalties`); return }
    setTab(t)
  }

  const handleEvent  = useCallback((ev: any) => { mutate((prev: any) => prev ? { ...prev, events: [...prev.events, ev] } : prev, false) }, [mutate])
  const handleUpdate = useCallback((match: any) => { mutate((prev: any) => prev ? { ...prev, match } : prev, false) }, [mutate])
  useMatchRoom(id, { onEvent: handleEvent, onUpdate: handleUpdate })

  if (!data) return <div className="max-w-3xl mx-auto h-64 bg-slate-800/40 rounded-xl animate-pulse mt-6" />

  const homeLineup = lineups.filter((l: any) => l.team_id === m.home_team_id)
  const awayLineup = lineups.filter((l: any) => l.team_id === m.away_team_id)
  const homeCoach  = coaches.find((c: any) => c.team_id === m.home_team_id)
  const awayCoach  = coaches.find((c: any) => c.team_id === m.away_team_id)
  const homeStats  = stats.find((s: any) => s.team_id === m.home_team_id)
  const awayStats  = stats.find((s: any) => s.team_id === m.away_team_id)
  const displayMinute = liveMinute ?? m.minute

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Hero */}
      <Card className="p-6">
        <div className="text-center mb-2">
          <span className="text-xs text-slate-500">{m.competition_name}</span>
          {m.round && <span className="text-xs text-slate-600 ml-2">· {m.round}</span>}
          {m.team_size && m.team_size !== 11 && (
            <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">{m.team_size}-a-side</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 flex flex-col items-center gap-2">
            <TeamLogo name={m.home_team_name} logoUrl={m.home_logo} size={56} />
            <span className="font-bold text-base text-white text-center">{m.home_team_name}</span>
          </div>
          <div className="text-center">
            <div className="font-bold text-5xl text-white tracking-tight tabular-nums">
              {m.home_score} <span className="text-slate-600">-</span> {m.away_score}
            </div>
            <div className="mt-2"><StatusBadge status={m.status} minute={displayMinute} /></div>
            {m.home_score_ht != null && (
              <div className="text-xs text-slate-600 mt-1">HT {m.home_score_ht} - {m.away_score_ht}</div>
            )}
            {m.half_duration && (
              <div className="text-xs text-slate-700 mt-1">{m.half_duration}' halves</div>
            )}
          </div>
          <div className="flex-1 flex flex-col items-center gap-2">
            <TeamLogo name={m.away_team_name} logoUrl={m.away_logo} size={56} />
            <span className="font-bold text-base text-white text-center">{m.away_team_name}</span>
          </div>
        </div>
        {(m.venue || m.referee) && (
          <div className="mt-4 pt-4 border-t border-slate-800 flex justify-center gap-6 text-xs text-slate-500">
            {m.venue   && <span>📍 {m.venue}</span>}
            {m.referee && <span>👤 {m.referee}</span>}
            <span>🕐 {format(new Date(m.scheduled_at), 'EEE d MMM, HH:mm')}</span>
          </div>
        )}
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-800">
        {TABS.map(t => (
          <button key={t} onClick={() => handleTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t ? 'border-green-400 text-green-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* SUMMARY */}
      {tab === 'Summary' && (
        <Card>
          {events.length === 0
            ? <p className="py-10 text-center text-slate-600 text-sm">No events yet</p>
            : <div className="divide-y divide-slate-800">
                {events.map((ev: any) => {
                  const isHome = ev.team_id === m.home_team_id
                  const playerName = ev.display_name ?? (ev.first_name ? `${ev.first_name} ${ev.last_name}` : null)
                  const assistName = ev.assist_first ? `${ev.assist_first} ${ev.assist_last}` : null
                  const subOutName = ev.sub_out_first ? `${ev.sub_out_first} ${ev.sub_out_last}` : null

                  const icon = ev.event_type === 'goal' || ev.event_type === 'penalty_goal' ? '⚽'
                    : ev.event_type === 'own_goal'       ? '⚽'
                    : ev.event_type === 'yellow_card'    ? '🟨'
                    : ev.event_type === 'red_card'       ? '🟥'
                    : ev.event_type === 'yellow_red_card'? '🟨🟥'
                    : ev.event_type === 'substitution'   ? '🔄'
                    : ev.event_type === 'penalty_missed' ? '❌' : '•'

                  return (
                    <div key={ev.id} className={clsx('flex items-start gap-3 px-4 py-3', !isHome && 'flex-row-reverse')}>
                      <span className="font-mono text-xs text-slate-500 w-10 text-center flex-shrink-0 pt-0.5">
                        {ev.minute}{ev.extra_time ? `+${ev.extra_time}` : ''}'
                      </span>
                      <span className="text-base flex-shrink-0">{icon}</span>
                      <div className={clsx('flex-1 min-w-0', !isHome && 'text-right')}>
                        {ev.event_type === 'substitution' ? (
                          <div>
                            <span className="text-green-400 text-sm">↑ {playerName ?? '?'}</span>
                            {subOutName && <span className="text-red-400 text-sm ml-2">↓ {subOutName}</span>}
                            <div className="text-xs text-slate-500">{ev.team_name}</div>
                          </div>
                        ) : (
                          <div>
                            <span className="text-sm text-white font-medium">{playerName ?? ev.team_name}</span>
                            {ev.event_type === 'own_goal' && <span className="text-xs text-slate-400 ml-1">(OG)</span>}
                            {assistName && <div className="text-xs text-slate-400">Assist: {assistName}</div>}
                            <div className="text-xs text-slate-500">{ev.team_name}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
          }
        </Card>
      )}

      {/* LINEUPS */}
      {tab === 'Lineups' && (
        <div className="grid grid-cols-2 gap-4">
          {[
            { teamId: m.home_team_id, teamName: m.home_team_name, lineup: homeLineup, coach: homeCoach },
            { teamId: m.away_team_id, teamName: m.away_team_name, lineup: awayLineup, coach: awayCoach },
          ].map(({ teamId, teamName, lineup, coach }) => {
            const starters = lineup.filter((l: any) => l.is_starter)
            const bench    = lineup.filter((l: any) => !l.is_starter)
            const confirmed = lineup.some((l: any) => l.confirmed)
            return (
              <Card key={teamId} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm uppercase text-slate-300">{teamName}</h3>
                  {confirmed && <span className="text-xs text-green-400">✓ Confirmed</span>}
                </div>
                {lineup.length === 0
                  ? <p className="text-xs text-slate-600 py-4 text-center">Lineup not set</p>
                  : <>
                      {starters.map((p: any) => (
                        <div key={p.player_id} className="flex items-center gap-2 py-1.5 border-b border-slate-800/50">
                          <span className="font-mono text-xs text-slate-600 w-5 text-right">{p.jersey_number}</span>
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-700 flex-shrink-0">
                            {p.photo_url
                              ? <img src={`https://matchday.koraforge.com.ng${p.photo_url}`} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">{(p.last_name??'?')[0]}</div>
                            }
                          </div>
                          <span className="text-sm text-slate-200 flex-1 truncate">
                            {p.display_name ?? `${p.first_name} ${p.last_name}`}
                          </span>
                          {p.is_captain && <span className="text-xs text-yellow-400 font-bold">C</span>}
                          {p.player_pos && <span className="text-xs text-slate-600">{p.player_pos.slice(0,3).toUpperCase()}</span>}
                        </div>
                      ))}
                      {bench.length > 0 && (
                        <>
                          <div className="text-xs text-slate-600 pt-2 pb-1 mt-1">Substitutes</div>
                          {bench.map((p: any) => (
                            <div key={p.player_id} className="flex items-center gap-2 py-1 text-slate-500">
                              <span className="font-mono text-xs w-5 text-right">{p.jersey_number}</span>
                              <span className="text-xs truncate">{p.display_name ?? `${p.first_name} ${p.last_name}`}</span>
                            </div>
                          ))}
                        </>
                      )}
                      {coach && (
                        <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-500">
                          👤 Coach: <span className="text-slate-300">{coach.coach_name}</span>
                        </div>
                      )}
                    </>
                }
              </Card>
            )
          })}
        </div>
      )}

      {/* STATS */}
      {tab === 'Stats' && (
        <Card className="p-4">
          {!homeStats && !awayStats
            ? <p className="py-8 text-center text-slate-600 text-sm">No stats available</p>
            : <div className="space-y-4">
                {[
                  { label: 'Possession',  home: homeStats?.possession_pct,    away: awayStats?.possession_pct,    suffix: '%' },
                  { label: 'Shots',       home: homeStats?.shots_total,        away: awayStats?.shots_total },
                  { label: 'On Target',   home: homeStats?.shots_on_target,    away: awayStats?.shots_on_target },
                  { label: 'Corners',     home: homeStats?.corners,            away: awayStats?.corners },
                  { label: 'Fouls',       home: homeStats?.fouls,              away: awayStats?.fouls },
                  { label: 'Offsides',    home: homeStats?.offsides,           away: awayStats?.offsides },
                  { label: 'Yellow Cards',home: homeStats?.yellow_cards,       away: awayStats?.yellow_cards },
                ].map(s => <StatBar key={s.label} {...s} />)}
              </div>
          }
        </Card>
      )}
    </div>
  )
}

function StatBar({ label, home, away, suffix = '' }: any) {
  const h = home ?? 0; const a = away ?? 0; const total = h + a || 1
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span className="font-medium text-white">{h}{suffix}</span>
        <span className="text-slate-500">{label}</span>
        <span className="font-medium text-white">{a}{suffix}</span>
      </div>
      <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-slate-800">
        <div className="bg-blue-500 rounded-l-full transition-all" style={{ width: `${(h/total)*100}%` }} />
        <div className="bg-slate-500 rounded-r-full transition-all" style={{ width: `${(a/total)*100}%` }} />
      </div>
    </div>
  )
}
// Note: Timeline and Penalties tabs link to sub-pages
