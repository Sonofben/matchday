'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { apiFetch, type Match } from '@/lib/api'
import { Card, StatusBadge } from '@/components/ui'
import { AdminLineups } from './AdminLineups'
import { format } from 'date-fns'
import { Plus, Zap, X, Users, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

const API = 'https://matchday.koraforge.com.ng/api'
const fetcher = (url: string) => apiFetch(url)

export function AdminMatches({ token }: { token: string }) {
  const headers = { Authorization: `Bearer ${token}` }
  const { data: matchData, mutate } = useSWR(`/matches`, fetcher)
  const { data: compData  } = useSWR(`/competitions`, fetcher)
  const { data: teamData  } = useSWR(`/teams`, fetcher)

  const [showCreate,  setShowCreate]  = useState(false)
  const [liveMatch,   setLiveMatch]   = useState<Match | null>(null)
  const [lineupMatch, setLineupMatch] = useState<Match | null>(null)
  const [creating, setCreating] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState({ competition_id: '', home_team_id: '', away_team_id: '', scheduled_at: '', venue: '', referee: '', round: '' })

  async function createMatch() {
    setCreating(true)
    try {
      await apiFetch(`/admin/matches`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, scheduled_at: new Date(form.scheduled_at).toISOString() }),
      })
      mutate(); setShowCreate(false)
      setForm({ competition_id: '', home_team_id: '', away_team_id: '', scheduled_at: '', venue: '', referee: '', round: '' })
    } catch (e: any) { alert(e.message) }
    finally { setCreating(false) }
  }

  async function updateMatch(id: string, update: Record<string, any>) {
    await apiFetch(`/matches/${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
    mutate()
    if (liveMatch?.id === id) setLiveMatch((prev: any) => prev ? { ...prev, ...update } : prev)
  }

  async function deleteMatch(id: string) {
    if (!confirm('Delete this match?')) return
    await apiFetch(`/admin/matches/${id}`, { method: 'DELETE', headers })
    mutate()
  }

  const matches = matchData?.matches ?? []
  const comps   = compData?.competitions ?? []
  const teams   = teamData?.teams ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Matches</h2>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={15} /> New Match
        </button>
      </div>

      {showCreate && (
        <Card className="p-5">
          <h3 className="text-sm font-medium text-white mb-4">Create Match</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Competition', key: 'competition_id', type: 'select', options: comps.map(c => ({ value: c.id, label: c.name })) },
              { label: 'Round / Matchday', key: 'round', type: 'text', placeholder: 'e.g. Matchday 1' },
              { label: 'Home Team', key: 'home_team_id', type: 'select', options: teams.map(t => ({ value: t.id, label: t.name })) },
              { label: 'Away Team', key: 'away_team_id', type: 'select', options: teams.map(t => ({ value: t.id, label: t.name })) },
              { label: 'Kick-off', key: 'scheduled_at', type: 'datetime-local' },
              { label: 'Venue', key: 'venue', type: 'text', placeholder: 'Stadium name' },
              { label: 'Referee', key: 'referee', type: 'text', placeholder: 'Referee name' },
            ].map((f: any) => (
              <div key={f.key}>
                <label className="text-xs text-slate-400 mb-1 block">{f.label}</label>
                {f.type === 'select'
                  ? <select value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500">
                      <option value="">Select...</option>
                      {f.options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  : <input type={f.type} value={(form as any)[f.key]} placeholder={f.placeholder}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
                }
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={createMatch} disabled={creating || !form.competition_id || !form.home_team_id || !form.away_team_id || !form.scheduled_at}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
              {creating ? 'Creating...' : 'Create Match'}
            </button>
            <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white px-4 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </Card>
      )}

      {/* Live score panel */}
      {liveMatch && (
        <Card className="p-5 border-red-500/30 bg-red-500/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="live-dot" />
              <span className="text-sm font-medium text-red-400">Live Score Entry — {liveMatch.competition_name}</span>
            </div>
            <button onClick={() => setLiveMatch(null)} className="text-slate-500 hover:text-white"><X size={16} /></button>
          </div>
          <div className="flex items-center justify-center gap-6 mb-5">
            <div className="text-center">
              <div className="text-white font-medium mb-1">{liveMatch.home_short ?? liveMatch.home_team_name}</div>
              <div className="flex gap-1">
                <button onClick={() => updateMatch(liveMatch.id, { home_score: Math.max(0, liveMatch.home_score - 1) })}
                  className="w-8 h-8 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold">−</button>
                <span className="text-3xl font-bold text-white w-8 text-center tabular-nums">{liveMatch.home_score}</span>
                <button onClick={() => updateMatch(liveMatch.id, { home_score: liveMatch.home_score + 1 })}
                  className="w-8 h-8 bg-green-700 hover:bg-green-600 text-white rounded font-bold">+</button>
              </div>
            </div>
            <span className="text-slate-600 text-2xl font-bold">-</span>
            <div className="text-center">
              <div className="text-white font-medium mb-1">{liveMatch.away_short ?? liveMatch.away_team_name}</div>
              <div className="flex gap-1">
                <button onClick={() => updateMatch(liveMatch.id, { away_score: Math.max(0, liveMatch.away_score - 1) })}
                  className="w-8 h-8 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold">−</button>
                <span className="text-3xl font-bold text-white w-8 text-center tabular-nums">{liveMatch.away_score}</span>
                <button onClick={() => updateMatch(liveMatch.id, { away_score: liveMatch.away_score + 1 })}
                  className="w-8 h-8 bg-green-700 hover:bg-green-600 text-white rounded font-bold">+</button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              { label: '▶ Kick Off',  status: 'live',      minute: 1 },
              { label: '⏸ Half Time',status: 'half_time', minute: liveMatch.half_duration ?? 45 },
              { label: '▶ 2nd Half', status: 'live',      minute: (liveMatch.half_duration ?? 45) + 1 },
              { label: '✅ Full Time',status: 'finished',  minute: (liveMatch.half_duration ?? 45) * 2 },
              { label: 'Postpone',   status: 'postponed', minute: null },
            ].map(({ label, status, minute }) => (
              <button key={label} onClick={() => updateMatch(liveMatch.id, minute !== null ? { status, minute } : { status })}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                  liveMatch.status === status ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white')}>
                {label}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Lineup panel */}
      {lineupMatch && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white font-medium">
              Lineup: {lineupMatch.home_team_name} vs {lineupMatch.away_team_name}
            </span>
            <button onClick={() => setLineupMatch(null)} className="text-slate-500 hover:text-white"><X size={16} /></button>
          </div>
          <AdminLineups matchId={lineupMatch.id} homeTeamId={lineupMatch.home_team_id} awayTeamId={lineupMatch.away_team_id} token={token} />
        </div>
      )}

      {/* Match list */}
      <div className="space-y-1">
        {matches.length === 0 && (
          <Card className="p-10 text-center text-slate-500 text-sm">No matches yet</Card>
        )}
        {matches.map(m => (
          <Card key={m.id} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-20 flex-shrink-0 text-center">
                <StatusBadge status={m.status} minute={m.minute} />
                {m.status === 'scheduled' && (
                  <div className="text-xs text-slate-500 font-mono">{format(new Date(m.scheduled_at), 'dd/MM HH:mm')}</div>
                )}
              </div>
              <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                <span className="text-sm text-slate-200 truncate">{m.home_short ?? m.home_team_name}</span>
                <span className="bg-slate-800 rounded px-2 py-0.5 text-white font-bold text-sm tabular-nums flex-shrink-0">
                  {['live','half_time','finished'].includes(m.status) ? `${m.home_score}-${m.away_score}` : 'vs'}
                </span>
                <span className="text-sm text-slate-200 truncate">{m.away_short ?? m.away_team_name}</span>
              </div>
              {m.round && <span className="text-xs text-slate-600 hidden sm:block">{m.round}</span>}
              <div className="flex gap-1 ml-1 flex-shrink-0">
                <button onClick={() => setLiveMatch(liveMatch?.id === m.id ? null : m as Match)}
                  className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors" title="Live entry">
                  <Zap size={13} />
                </button>
                <button onClick={() => setLineupMatch(lineupMatch?.id === m.id ? null : m as Match)}
                  className="p-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors" title="Set lineup">
                  <Users size={13} />
                </button>
                <button onClick={() => deleteMatch(m.id)}
                  className="p-1.5 rounded bg-slate-800 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors" title="Delete">
                  <X size={13} />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
