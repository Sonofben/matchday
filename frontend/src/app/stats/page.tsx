'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { apiFetch } from '@/lib/api'
import { Card, TeamLogo } from '@/components/ui'
import clsx from 'clsx'

const API = 'https://matchday.koraforge.com.ng/api'
const fetcher = (url: string) => apiFetch(url)
const TABS = ['Top Scorers', 'Top Assists', 'Head to Head']

export default function StatsPage() {
  const [tab, setTab]       = useState('Top Scorers')
  const [compId, setCompId] = useState<string>('')
  const [team1, setTeam1]   = useState('')
  const [team2, setTeam2]   = useState('')
  const [h2hQuery, setH2hQuery] = useState<string | null>(null)

  const { data: compsData } = useSWR(`/competitions`, fetcher)
  const { data: teamsData } = useSWR(`/teams`, fetcher)
  const competitions = compsData?.competitions ?? []
  const teams        = teamsData?.teams ?? []
  const activeComp   = compId || competitions[0]?.id || ''

  const { data: scorersData } = useSWR(
    tab === 'Top Scorers' && activeComp ? `/stats/top-scorers/${activeComp}` : null, fetcher
  )
  const { data: assistsData } = useSWR(
    tab === 'Top Assists' && activeComp ? `/stats/top-assists/${activeComp}` : null, fetcher
  )
  const { data: h2hData } = useSWR(
    h2hQuery ? `/stats/head-to-head?${h2hQuery}` : null, fetcher
  )

  const scorers = (scorersData as any)?.players ?? []
  const assists = (assistsData as any)?.players ?? []
  const h2h     = h2hData as any

  const posLabel: Record<string,string> = { goalkeeper:'GK', defender:'DEF', midfielder:'MID', forward:'FWD' }

  function PlayerRow({ p, rank, stat, statLabel }: any) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20 transition-colors">
        <span className={clsx('w-7 text-center font-bold text-sm flex-shrink-0',
          rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-slate-400' : rank === 3 ? 'text-amber-600' : 'text-slate-600'
        )}>
          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
        </span>
        <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden flex-shrink-0">
          {p.photo_url
            ? <img src={`https://matchday.koraforge.com.ng${p.photo_url}`} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                {(p.last_name ?? '?')[0]}
              </div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-medium truncate">
            {p.display_name ?? `${p.first_name} ${p.last_name}`}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {p.team_logo
              ? <img src={`https://matchday.koraforge.com.ng${p.team_logo}`} alt="" className="w-4 h-4 object-contain" />
              : <div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ background: p.primary_color ?? '#334155' }} />
            }
            <span className="text-xs text-slate-500 truncate">{p.team_name ?? '—'}</span>
            {p.position && <span className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">{posLabel[p.position] ?? p.position}</span>}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-2xl font-bold text-white tabular-nums">{stat}</div>
          <div className="text-xs text-slate-500">{statLabel}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="font-bold text-2xl text-white uppercase tracking-wide" style={{ fontFamily:'Arial Black' }}>
        Statistics
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-800">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t ? 'border-green-400 text-green-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Competition selector (for scorers/assists) */}
      {tab !== 'Head to Head' && (
        <div className="flex flex-wrap gap-2">
          {competitions.map((c: any) => (
            <button key={c.id} onClick={() => setCompId(c.id)}
              className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                (compId || competitions[0]?.id) === c.id
                  ? 'bg-green-500/10 border-green-500/40 text-green-400'
                  : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white'
              )}>
              {c.is_local && <span className="mr-1 text-green-400">★</span>}
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* TOP SCORERS */}
      {tab === 'Top Scorers' && (
        <Card>
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-sm font-medium text-white">Top Goal Scorers</span>
            <span className="text-xs text-slate-500">{scorers.length} players</span>
          </div>
          {scorers.length === 0
            ? <p className="py-10 text-center text-slate-500 text-sm">No goals recorded yet</p>
            : scorers.map((p: any, i: number) => (
                <PlayerRow key={p.player_id ?? p.id} p={p} rank={i+1} stat={p.goals} statLabel="goals" />
              ))
          }
        </Card>
      )}

      {/* TOP ASSISTS */}
      {tab === 'Top Assists' && (
        <Card>
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-sm font-medium text-white">Top Assist Providers</span>
            <span className="text-xs text-slate-500">{assists.length} players</span>
          </div>
          {assists.length === 0
            ? <p className="py-10 text-center text-slate-500 text-sm">No assists recorded yet</p>
            : assists.map((p: any, i: number) => (
                <PlayerRow key={p.player_id ?? p.id} p={p} rank={i+1} stat={p.assists} statLabel="assists" />
              ))
          }
        </Card>
      )}

      {/* HEAD TO HEAD */}
      {tab === 'Head to Head' && (
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-medium text-white mb-3">Select two teams</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Team 1</label>
                <select value={team1} onChange={e => setTeam1(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500">
                  <option value="">Select team...</option>
                  {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Team 2</label>
                <select value={team2} onChange={e => setTeam2(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500">
                  <option value="">Select team...</option>
                  {teams.filter((t: any) => t.id !== team1).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <button
              onClick={() => team1 && team2 && setH2hQuery(`team1=${team1}&team2=${team2}`)}
              disabled={!team1 || !team2}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Compare
            </button>
          </Card>

          {h2h && (
            <>
              {/* H2H Summary */}
              <Card className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 text-center">
                    <TeamLogo name={h2h.team1.name} logoUrl={h2h.team1.logo_url} size={48} />
                    <div className="font-bold text-white mt-2">{h2h.team1.short_name ?? h2h.team1.name}</div>
                    <div className="text-3xl font-bold text-green-400 mt-1">{h2h.team1.wins}</div>
                    <div className="text-xs text-slate-500">wins</div>
                  </div>
                  <div className="text-center px-4">
                    <div className="text-2xl font-bold text-slate-500">{h2h.draws}</div>
                    <div className="text-xs text-slate-500">draws</div>
                    <div className="text-xs text-slate-600 mt-2">{h2h.matches.length} matches</div>
                  </div>
                  <div className="flex-1 text-center">
                    <TeamLogo name={h2h.team2.name} logoUrl={h2h.team2.logo_url} size={48} />
                    <div className="font-bold text-white mt-2">{h2h.team2.short_name ?? h2h.team2.name}</div>
                    <div className="text-3xl font-bold text-blue-400 mt-1">{h2h.team2.wins}</div>
                    <div className="text-xs text-slate-500">wins</div>
                  </div>
                </div>
                {/* Goals bar */}
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span className="text-green-400 font-medium">{h2h.team1.goals} goals</span>
                    <span className="text-slate-500">Goals scored</span>
                    <span className="text-blue-400 font-medium">{h2h.team2.goals} goals</span>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden bg-slate-800 gap-0.5">
                    {h2h.team1.goals + h2h.team2.goals > 0 && <>
                      <div className="bg-green-500 transition-all" style={{ width: `${(h2h.team1.goals / (h2h.team1.goals + h2h.team2.goals)) * 100}%` }} />
                      <div className="bg-blue-500 transition-all" style={{ width: `${(h2h.team2.goals / (h2h.team1.goals + h2h.team2.goals)) * 100}%` }} />
                    </>}
                  </div>
                </div>
              </Card>

              {/* Match history */}
              {h2h.matches.length > 0 && (
                <Card>
                  <div className="px-4 py-3 border-b border-slate-800">
                    <span className="text-sm font-medium text-white">Recent meetings</span>
                  </div>
                  {h2h.matches.map((m: any) => (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/50 last:border-0 text-sm">
                      <span className="text-xs text-slate-600 w-20 flex-shrink-0">{new Date(m.scheduled_at).toLocaleDateString()}</span>
                      <span className="flex-1 text-right text-slate-300">{m.home_short ?? m.home_team_name}</span>
                      <span className="font-bold text-white bg-slate-800 px-3 py-1 rounded tabular-nums">{m.home_score} - {m.away_score}</span>
                      <span className="flex-1 text-slate-300">{m.away_short ?? m.away_team_name}</span>
                      <span className="text-xs text-slate-600 w-24 text-right flex-shrink-0 truncate">{m.competition_name}</span>
                    </div>
                  ))}
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
