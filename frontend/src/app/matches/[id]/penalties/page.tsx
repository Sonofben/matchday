'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { Card, TeamLogo } from '@/components/ui'

const API = 'https://matchday.koraforge.com.ng/api'
const fetcher = (url: string) => apiFetch(url)

export default function PenaltiesPage() {
  const { id }    = useParams() as { id: string }
  const { data, mutate }  = useSWR(id ? `/matches/${id}` : null, fetcher)
  const [token]   = useState(() => typeof window !== 'undefined' ? (localStorage.getItem('matchday_admin_token') ?? localStorage.getItem('matchday_scorer_token') ?? '') : '')
  const [pens, setPens]   = useState<{ teamId: string; scored: boolean }[]>([])
  const [saving, setSaving] = useState(false)

  const m = (data as any)?.match
  if (!m) return <div className="h-64 bg-slate-800/40 rounded-xl animate-pulse" />

  const homeScored = pens.filter(p => p.teamId === m.home_team_id && p.scored).length
  const awayScored = pens.filter(p => p.teamId === m.away_team_id && p.scored).length
  const homeTotal  = pens.filter(p => p.teamId === m.home_team_id).length
  const awayTotal  = pens.filter(p => p.teamId === m.away_team_id).length

  function addPenalty(teamId: string, scored: boolean) {
    setPens(prev => [...prev, { teamId, scored }])
  }

  function undoLast(teamId: string) {
    const lastIdx = [...pens].map((p,i) => p.teamId === teamId ? i : -1).filter(i => i >= 0).pop()
    if (lastIdx !== undefined) setPens(prev => prev.filter((_, i) => i !== lastIdx))
  }

  async function savePenalties() {
    setSaving(true)
    try {
      await fetch(`/matches/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          home_score_pen: homeScored,
          away_score_pen: awayScored,
          status: 'finished',
        }),
      })
      mutate()
      alert(`✅ Penalties saved: ${m.home_short ?? m.home_team_name} ${homeScored} - ${awayScored} ${m.away_short ?? m.away_team_name}`)
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  function PenDots({ teamId }: { teamId: string }) {
    const teamPens = pens.filter(p => p.teamId === teamId)
    return (
      <div className="flex gap-1.5 flex-wrap justify-center mt-2">
        {teamPens.map((p, i) => (
          <div key={i} className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
            p.scored ? 'bg-green-600 border-green-400 text-white' : 'bg-red-900 border-red-600 text-red-300'
          }`}>
            {p.scored ? '✓' : '✗'}
          </div>
        ))}
        {teamPens.length < 5 && [...Array(5 - teamPens.length)].map((_, i) => (
          <div key={`empty-${i}`} className="w-7 h-7 rounded-full border-2 border-slate-700 border-dashed" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Link href={`/matches/${id}`} className="text-slate-400 hover:text-white text-sm">← Match</Link>
        <span className="text-slate-600">·</span>
        <span className="text-white font-medium">Penalty Shootout</span>
      </div>

      {/* Score */}
      <Card className="p-5 text-center">
        <div className="text-xs text-slate-500 mb-3">After extra time: {m.home_score_et ?? m.home_score} - {m.away_score_et ?? m.away_score}</div>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <TeamLogo name={m.home_team_name} logoUrl={m.home_logo} size={40} />
            <div className="text-white font-bold mt-1 text-sm">{m.home_short ?? m.home_team_name}</div>
          </div>
          <div className="text-5xl font-bold text-white tabular-nums px-4">
            {homeScored}<span className="text-slate-600 mx-2">-</span>{awayScored}
          </div>
          <div className="flex-1">
            <TeamLogo name={m.away_team_name} logoUrl={m.away_logo} size={40} />
            <div className="text-white font-bold mt-1 text-sm">{m.away_short ?? m.away_team_name}</div>
          </div>
        </div>
      </Card>

      {/* Penalty entry */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { teamId: m.home_team_id, name: m.home_short ?? m.home_team_name },
          { teamId: m.away_team_id, name: m.away_short ?? m.away_team_name },
        ].map(({ teamId, name }) => (
          <Card key={teamId} className="p-4 text-center">
            <div className="font-bold text-white text-sm mb-1">{name}</div>
            <div className="text-slate-500 text-xs mb-3">{pens.filter(p=>p.teamId===teamId&&p.scored).length}/{pens.filter(p=>p.teamId===teamId).length} scored</div>
            <PenDots teamId={teamId} />
            <div className="flex gap-2 mt-3">
              <button onClick={() => addPenalty(teamId, true)}
                className="flex-1 bg-green-700 hover:bg-green-600 active:scale-95 text-white py-2 rounded-xl text-sm font-bold transition-all">
                ✓ Scored
              </button>
              <button onClick={() => addPenalty(teamId, false)}
                className="flex-1 bg-red-900 hover:bg-red-800 active:scale-95 text-white py-2 rounded-xl text-sm font-bold transition-all">
                ✗ Missed
              </button>
            </div>
            {pens.some(p => p.teamId === teamId) && (
              <button onClick={() => undoLast(teamId)}
                className="mt-2 text-xs text-slate-500 hover:text-white transition-colors">
                Undo last
              </button>
            )}
          </Card>
        ))}
      </div>

      <button onClick={savePenalties} disabled={saving || pens.length === 0}
        className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-base transition-colors">
        {saving ? 'Saving...' : `Save Result — ${m.home_short} ${homeScored}-${awayScored} ${m.away_short} (pens)`}
      </button>
    </div>
  )
}
