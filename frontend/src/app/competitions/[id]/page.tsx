'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch, type Standing } from '@/lib/api'
import { Card, TeamLogo, FormDots, StatusBadge } from '@/components/ui'
import { format } from 'date-fns'
import clsx from 'clsx'

const API = 'https://matchday.koraforge.com.ng/api'
const fetcher = (url: string) => apiFetch(url)
const TABS = ['Fixtures', 'Standings', 'Teams']

export default function CompetitionPage() {
  const { id } = useParams() as { id: string }
  const [tab, setTab] = useState('Fixtures')

  const { data: comp }      = useSWR(id ? `/competitions/${id}` : null, fetcher)
  const { data: fixtures }  = useSWR(id ? `/competitions/${id}/fixtures` : null, fetcher)
  const { data: standings } = useSWR(id ? `/standings/${id}` : null, fetcher)
  const { data: compTeams } = useSWR(id ? `/teams?competition_id=${id}` : null, fetcher)

  const allFixtures = (fixtures as any)?.fixtures ?? []

  // Group fixtures by round
  const rounds = allFixtures.reduce((acc: any, m: any) => {
    const key = m.round ?? 'Fixtures'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-slate-700 flex items-center justify-center text-2xl flex-shrink-0">
            🏆
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{(comp as any)?.name ?? '...'}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
              {(comp as any)?.country_name && <span>🌍 {(comp as any).country_name}</span>}
              {(comp as any)?.season_name  && <span>📅 {(comp as any).season_name}</span>}
              {(comp as any)?.format       && <span className="capitalize">{(comp as any).format.replace('_',' ')}</span>}
              {(comp as any)?.is_local     && <span className="text-green-400">★ Local</span>}
            </div>
          </div>
        </div>
      </Card>

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

      {/* Fixtures / Brackets */}
      {tab === 'Fixtures' && (
        <div className="space-y-5">
          {Object.keys(rounds).length === 0 && (
            <Card className="p-10 text-center text-slate-500 text-sm">No fixtures yet</Card>
          )}
          {Object.entries(rounds).map(([round, matches]: any) => (
            <div key={round}>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">{round}</h3>
              <div className="space-y-1">
                {matches.map((m: any) => (
                  <Link key={m.id} href={`/matches/${m.id}`}>
                    <Card className="px-4 py-3 flex items-center gap-3 hover:border-slate-600 transition-colors cursor-pointer">
                      <div className="w-16 text-center flex-shrink-0">
                        <StatusBadge status={m.status} minute={m.minute} />
                        {m.status === 'scheduled' && (
                          <div className="text-xs text-slate-500">{format(new Date(m.scheduled_at), 'dd MMM')}</div>
                        )}
                      </div>
                      <div className="flex-1 flex items-center gap-2 justify-end">
                        <span className="text-sm text-slate-200">{m.home_short ?? m.home_team_name}</span>
                        <TeamLogo name={m.home_team_name} logoUrl={m.home_logo} size={20} />
                      </div>
                      <div className={clsx('px-3 py-1 rounded text-sm font-bold tabular-nums min-w-[52px] text-center',
                        m.status === 'live' ? 'bg-red-500/10 text-white border border-red-500/20' : 'bg-slate-800 text-slate-200'
                      )}>
                        {['live','half_time','finished'].includes(m.status) ? `${m.home_score} - ${m.away_score}` : 'vs'}
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <TeamLogo name={m.away_team_name} logoUrl={m.away_logo} size={20} />
                        <span className="text-sm text-slate-200">{m.away_short ?? m.away_team_name}</span>
                      </div>
                      <div className="w-16 text-right text-xs text-slate-600">
                        {m.status === 'scheduled' && format(new Date(m.scheduled_at), 'HH:mm')}
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Standings */}
      {tab === 'Standings' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['#','Team','P','W','D','L','GF','GA','GD','Pts','Form'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs text-slate-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {((standings as any)?.standings ?? []).map((s: Standing, i: number) => (
                  <tr key={s.team_id} className="hover:bg-slate-800/30">
                    <td className="px-3 py-3 text-slate-500 text-xs">{s.position ?? i+1}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <TeamLogo name={s.team_name} logoUrl={s.logo_url} size={18} />
                        <span className="text-slate-200 font-medium">{s.team_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center text-slate-400">{s.played}</td>
                    <td className="px-3 py-3 text-center text-green-400">{s.won}</td>
                    <td className="px-3 py-3 text-center text-yellow-400">{s.drawn}</td>
                    <td className="px-3 py-3 text-center text-red-400">{s.lost}</td>
                    <td className="px-3 py-3 text-center text-slate-400">{s.goals_for}</td>
                    <td className="px-3 py-3 text-center text-slate-400">{s.goals_against}</td>
                    <td className={clsx('px-3 py-3 text-center', s.goal_difference > 0 ? 'text-green-400' : s.goal_difference < 0 ? 'text-red-400' : 'text-slate-400')}>
                      {s.goal_difference > 0 ? `+${s.goal_difference}` : s.goal_difference}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-white">{s.points}</td>
                    <td className="px-3 py-3"><FormDots form={s.form} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Teams */}
      {tab === 'Teams' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {((compTeams as any)?.teams ?? []).map((t: any) => (
            <Card key={t.id} className="p-4 text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center font-bold text-white text-lg"
                style={{ background: t.primary_color ?? '#334155' }}>
                {(t.short_name ?? t.name).slice(0,2)}
              </div>
              <div className="font-medium text-white text-sm">{t.name}</div>
              {t.short_name && <div className="text-xs text-slate-500 mt-0.5">{t.short_name}</div>}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
