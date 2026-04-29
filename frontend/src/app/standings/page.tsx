'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { apiFetch, type Competition, type Standing } from '@/lib/api'
import { Card, SectionHeader, TeamLogo, FormDots } from '@/components/ui'
import clsx from 'clsx'

const fetcher = (url: string) => apiFetch(url)

export default function StandingsPage() {
  const { data: compsData } = useSWR('/competitions', fetcher)
  const competitions = compsData?.competitions ?? []

  const [selected, setSelected] = useState<string | null>(null)
  const activeId = selected ?? competitions[0]?.id ?? null

  const { data } = useSWR(
    activeId ? `/standings/${activeId}` : null,
    fetcher,
    { refreshInterval: 60000 }
  )

  // Group by group_name
  const groups = (data?.standings ?? []).reduce<Record<string, Standing[]>>((acc, s) => {
    const key = s.group_name ?? 'table'
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <h1 className="font-display font-bold text-2xl tracking-wide text-white uppercase">Standings</h1>

      {/* Competition selector */}
      <div className="flex flex-wrap gap-2">
        {competitions.map(c => (
          <button
            key={c.id}
            onClick={() => setSelected(c.id)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
              (activeId === c.id)
                ? 'bg-green-500/10 border-green-500/40 text-green-400'
                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
            )}
          >
            {c.is_local && <span className="mr-1 text-green-400">★</span>}
            {c.name}
          </button>
        ))}
      </div>

      {/* Tables */}
      {!data && activeId && (
        <div className="h-64 bg-slate-800/40 rounded-xl animate-pulse" />
      )}

      {Object.entries(groups).map(([group, rows]) => (
        <div key={group}>
          {group !== 'table' && <SectionHeader title={`Group ${group}`} />}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-medium w-8">#</th>
                    <th className="text-left px-2 py-2.5 text-xs text-slate-500 font-medium">Team</th>
                    <th className="text-center px-2 py-2.5 text-xs text-slate-500 font-medium w-10">P</th>
                    <th className="text-center px-2 py-2.5 text-xs text-slate-500 font-medium w-10">W</th>
                    <th className="text-center px-2 py-2.5 text-xs text-slate-500 font-medium w-10">D</th>
                    <th className="text-center px-2 py-2.5 text-xs text-slate-500 font-medium w-10">L</th>
                    <th className="text-center px-2 py-2.5 text-xs text-slate-500 font-medium w-12">GF</th>
                    <th className="text-center px-2 py-2.5 text-xs text-slate-500 font-medium w-12">GA</th>
                    <th className="text-center px-2 py-2.5 text-xs text-slate-500 font-medium w-12">GD</th>
                    <th className="text-center px-2 py-2.5 text-xs text-slate-500 font-medium w-12 text-white">Pts</th>
                    <th className="text-center px-4 py-2.5 text-xs text-slate-500 font-medium">Form</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {rows.map((s, i) => (
                    <tr key={s.team_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-slate-500 text-xs">{s.position ?? i + 1}</td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <TeamLogo name={s.team_name} logoUrl={s.logo_url} size={20} />
                          <span className="text-slate-200 font-medium">{s.team_name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center text-slate-400">{s.played}</td>
                      <td className="px-2 py-3 text-center text-green-400">{s.won}</td>
                      <td className="px-2 py-3 text-center text-yellow-400">{s.drawn}</td>
                      <td className="px-2 py-3 text-center text-red-400">{s.lost}</td>
                      <td className="px-2 py-3 text-center text-slate-400">{s.goals_for}</td>
                      <td className="px-2 py-3 text-center text-slate-400">{s.goals_against}</td>
                      <td className={clsx('px-2 py-3 text-center', s.goal_difference > 0 ? 'text-green-400' : s.goal_difference < 0 ? 'text-red-400' : 'text-slate-400')}>
                        {s.goal_difference > 0 ? `+${s.goal_difference}` : s.goal_difference}
                      </td>
                      <td className="px-2 py-3 text-center font-bold text-white">{s.points}</td>
                      <td className="px-4 py-3 text-center">
                        <FormDots form={s.form} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ))}
    </div>
  )
}
