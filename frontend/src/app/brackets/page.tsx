'use client'
import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { Card, TeamLogo } from '@/components/ui'

const API = 'https://matchday.koraforge.com.ng/api'
const fetcher = (url: string) => apiFetch(url)

export default function BracketsPage() {
  const [compId, setCompId] = useState('')
  const { data: compsData } = useSWR(`/competitions`, fetcher)
  const competitions = ((compsData as any)?.competitions ?? []).filter((c: any) =>
    ['cup','group_knockout','league_cup'].includes(c.bracket_type ?? c.format)
  )
  const activeComp = compId || competitions[0]?.id || ''
  const { data: bracketData } = useSWR(
    activeComp ? `/admin/brackets/${activeComp}` : null, fetcher
  )
  const { data: fixturesData } = useSWR(
    activeComp ? `/competitions/${activeComp}/fixtures` : null, fetcher
  )

  const rounds   = (bracketData as any)?.rounds ?? []
  const fixtures = (fixturesData as any)?.fixtures ?? []

  return (
    <div className="space-y-6">
      <h1 className="font-bold text-2xl text-white uppercase tracking-wide" style={{ fontFamily:'Arial Black' }}>
        Brackets
      </h1>

      {/* Competition selector */}
      <div className="flex flex-wrap gap-2">
        {competitions.length === 0 && (
          <p className="text-slate-500 text-sm">No cup/knockout competitions set up yet. Create one in the admin panel with bracket type "Cup" or "Group + Knockout".</p>
        )}
        {competitions.map((c: any) => (
          <button key={c.id} onClick={() => setCompId(c.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              activeComp === c.id ? 'bg-green-500/10 border-green-500/40 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}>
            {c.name}
          </button>
        ))}
      </div>

      {/* Bracket tree */}
      {rounds.length > 0 && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-6 min-w-max">
            {rounds.map((round: any, ri: number) => (
              <div key={round.id} className="flex flex-col justify-around gap-4" style={{ minWidth: 200 }}>
                <div className="text-xs text-slate-500 uppercase tracking-wider text-center mb-2 font-medium">
                  {round.round_name}
                </div>
                {(round.slots ?? []).map((slot: any, si: number) => {
                  const match = fixtures.find((f: any) =>
                    (f.home_team_id === slot.home_team_id && f.away_team_id === slot.away_team_id) ||
                    slot.match_id === f.id
                  )
                  const isWinner = (teamId: string) => slot.winner_team_id === teamId
                  return (
                    <Link key={slot.id} href={match ? `/matches/${match.id}` : '#'}>
                      <div className={`bg-[#141920] border rounded-xl overflow-hidden transition-colors ${match ? 'border-slate-700 hover:border-slate-500' : 'border-slate-800'}`}>
                        <TeamSlot
                          teamId={slot.home_team_id}
                          teamName={slot.home_team_name ?? 'TBD'}
                          logoUrl={slot.home_logo}
                          score={match?.home_score}
                          status={match?.status}
                          isWinner={isWinner(slot.home_team_id)}
                        />
                        <div className="h-px bg-slate-800" />
                        <TeamSlot
                          teamId={slot.away_team_id}
                          teamName={slot.away_team_name ?? 'TBD'}
                          logoUrl={slot.away_logo}
                          score={match?.away_score}
                          status={match?.status}
                          isWinner={isWinner(slot.away_team_id)}
                        />
                        {match?.status === 'live' && (
                          <div className="px-3 py-1 bg-red-500/10 text-center">
                            <span className="text-xs text-red-400">🔴 LIVE {match.minute}'</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback — show fixtures grouped by round */}
      {rounds.length === 0 && fixtures.length > 0 && (
        <FixturesByRound fixtures={fixtures} />
      )}

      {rounds.length === 0 && fixtures.length === 0 && activeComp && (
        <Card className="p-10 text-center text-slate-500 text-sm">
          No bracket configured yet. Set up the bracket in the Admin panel under Competitions.
        </Card>
      )}
    </div>
  )
}

function TeamSlot({ teamName, logoUrl, score, status, isWinner }: any) {
  const finished = status === 'finished'
  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 ${isWinner ? 'bg-green-500/10' : ''}`}>
      <TeamLogo name={teamName} logoUrl={logoUrl} size={20} />
      <span className={`text-sm flex-1 truncate ${isWinner ? 'text-green-400 font-medium' : teamName === 'TBD' ? 'text-slate-600' : 'text-slate-200'}`}>
        {teamName}
      </span>
      {(score !== undefined && score !== null) && (
        <span className={`font-bold tabular-nums text-sm ${isWinner ? 'text-green-400' : finished ? 'text-slate-400' : 'text-white'}`}>
          {score}
        </span>
      )}
    </div>
  )
}

function FixturesByRound({ fixtures }: { fixtures: any[] }) {
  const rounds = fixtures.reduce((acc: any, f: any) => {
    const key = f.round ?? 'Fixtures'
    if (!acc[key]) acc[key] = []
    acc[key].push(f)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {Object.entries(rounds).map(([round, matches]: any) => (
        <div key={round}>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{round}</h3>
          <div className="space-y-2">
            {matches.map((m: any) => (
              <Link key={m.id} href={`/matches/${m.id}`}>
                <Card className="px-4 py-3 flex items-center gap-3 hover:border-slate-600 transition-colors cursor-pointer">
                  <div className="flex-1 flex items-center justify-end gap-2">
                    <span className="text-sm text-slate-200">{m.home_short ?? m.home_team_name}</span>
                    <TeamLogo name={m.home_team_name} logoUrl={m.home_logo} size={20} />
                  </div>
                  <div className={`px-3 py-1 rounded text-sm font-bold tabular-nums min-w-[52px] text-center ${m.status === 'live' ? 'bg-red-500/10 text-white border border-red-500/20' : 'bg-slate-800 text-slate-200'}`}>
                    {['live','half_time','finished'].includes(m.status) ? `${m.home_score} - ${m.away_score}` : 'vs'}
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <TeamLogo name={m.away_team_name} logoUrl={m.away_logo} size={20} />
                    <span className="text-sm text-slate-200">{m.away_short ?? m.away_team_name}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
