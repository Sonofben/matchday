'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { apiFetch } from '@/lib/api'
import { Card } from '@/components/ui'

const API = 'https://matchday.koraforge.com.ng/api'
const fetcher = (url: string) => apiFetch(url)

interface Props { matchId: string; homeTeamId: string; awayTeamId: string; token: string }

export function AdminLineups({ matchId, homeTeamId, awayTeamId, token }: Props) {
  const headers = { Authorization: `Bearer ${token}` }
  const { data: matchData } = useSWR(`/matches/${matchId}`, fetcher)
  const { data: homeSquad }  = useSWR(`/teams/${homeTeamId}`, fetcher)
  const { data: awaySquad }  = useSWR(`/teams/${awayTeamId}`, fetcher)
  const [saving, setSaving]  = useState(false)
  const [activeTeam, setActiveTeam] = useState<'home'|'away'>('home')

  const matchDetail = matchData as any
  const existingLineups = matchDetail?.lineups ?? []
  const coaches = matchDetail?.coaches ?? []

  const homePlayers = (homeSquad as any)?.squad ?? []
  const awayPlayers = (awaySquad as any)?.squad ?? []
  const allPlayers  = activeTeam === 'home' ? homePlayers : awayPlayers
  const teamId      = activeTeam === 'home' ? homeTeamId : awayTeamId

  const [selections, setSelections] = useState<Record<string, { is_starter: boolean; is_captain: boolean }>>({})
  const [coachName, setCoachName]   = useState('')

  function toggle(playerId: string, field: 'is_starter' | 'is_captain') {
    setSelections(prev => ({
      ...prev,
      [playerId]: { is_starter: true, is_captain: false, ...prev[playerId], [field]: !(prev[playerId]?.[field]) }
    }))
  }

  function include(playerId: string) {
    setSelections(prev => {
      if (prev[playerId]) {
        const next = { ...prev }; delete next[playerId]; return next
      }
      return { ...prev, [playerId]: { is_starter: false, is_captain: false } }
    })
  }

  async function saveLineup() {
    setSaving(true)
    try {
      const players = Object.entries(selections).map(([player_id, sel]) => ({
        player_id, is_starter: sel.is_starter, is_captain: sel.is_captain,
      }))
      await apiFetch(`/matches/${matchId}/lineups`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: teamId, players, coach_name: coachName || undefined, confirmed: true }),
      })
      alert('Lineup saved!')
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  const starters = Object.entries(selections).filter(([,s]) => s.is_starter).length
  const bench    = Object.entries(selections).filter(([,s]) => !s.is_starter).length

  return (
    <Card className="p-4 mt-4">
      <h3 className="text-sm font-medium text-white mb-3">Set Lineups</h3>

      <div className="flex gap-2 mb-4">
        {(['home','away'] as const).map(side => (
          <button key={side} onClick={() => setActiveTeam(side)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTeam === side ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {side === 'home' ? (matchDetail?.match?.home_team_name ?? 'Home') : (matchDetail?.match?.away_team_name ?? 'Away')}
          </button>
        ))}
      </div>

      <div className="mb-3">
        <label className="text-xs text-slate-400 block mb-1">Coach Name</label>
        <input value={coachName} onChange={e => setCoachName(e.target.value)}
          placeholder="Coach full name"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
      </div>

      <div className="text-xs text-slate-500 mb-2">
        {starters} starters · {bench} bench — Click to include, S = starter, C = captain
      </div>

      {allPlayers.length === 0
        ? <p className="text-slate-600 text-sm py-4 text-center">No squad registered for this team</p>
        : <div className="space-y-1 max-h-64 overflow-y-auto">
            {allPlayers.map((p: any) => {
              const sel = selections[p.id]
              return (
                <div key={p.id} onClick={() => include(p.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${sel ? 'bg-slate-700' : 'bg-slate-800/50 hover:bg-slate-800'}`}>
                  <span className="font-mono text-xs text-slate-500 w-5">{p.squad_number ?? p.jersey_number}</span>
                  <span className="text-sm text-white flex-1 truncate">
                    {p.display_name ?? `${p.first_name} ${p.last_name}`}
                  </span>
                  {sel && (
                    <div className="flex gap-1">
                      <button onClick={e => { e.stopPropagation(); toggle(p.id, 'is_starter') }}
                        className={`px-2 py-0.5 rounded text-xs font-bold ${sel.is_starter ? 'bg-green-500/30 text-green-400' : 'bg-slate-600 text-slate-400'}`}>
                        S
                      </button>
                      <button onClick={e => { e.stopPropagation(); toggle(p.id, 'is_captain') }}
                        className={`px-2 py-0.5 rounded text-xs font-bold ${sel.is_captain ? 'bg-yellow-500/30 text-yellow-400' : 'bg-slate-600 text-slate-400'}`}>
                        C
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
      }

      <button onClick={saveLineup} disabled={saving || Object.keys(selections).length === 0}
        className="mt-3 w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors">
        {saving ? 'Saving...' : `Save ${activeTeam === 'home' ? 'Home' : 'Away'} Lineup (${Object.keys(selections).length} players)`}
      </button>
    </Card>
  )
}
