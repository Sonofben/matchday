'use client'
import useSWR from 'swr'
import { useParams } from 'next/navigation'
import { format, differenceInYears } from 'date-fns'
import { apiFetch } from '@/lib/api'
import { Card, TeamLogo } from '@/components/ui'

const fetcher = (url: string) => apiFetch(url)

export default function PlayerPage() {
  const { id } = useParams() as { id: string }
  const { data } = useSWR(id ? `/players/${id}` : null, fetcher)

  if (!data) return <div className="h-64 bg-slate-800/40 rounded-xl animate-pulse" />

  const { player: p, contracts, stats } = data as any

  const age = p.date_of_birth
    ? differenceInYears(new Date(), new Date(p.date_of_birth))
    : null

  const positions: Record<string, string> = {
    goalkeeper: 'Goalkeeper', defender: 'Defender',
    midfielder: 'Midfielder', forward: 'Forward',
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Hero */}
      <Card className="p-6">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-slate-700 flex-shrink-0 overflow-hidden">
            {p.photo_url
              ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center font-display font-bold text-4xl text-slate-400">
                  {p.last_name.slice(0,1)}
                </div>
            }
          </div>
          <div>
            <h1 className="font-display font-bold text-3xl text-white tracking-wide">
              {p.display_name ?? `${p.first_name} ${p.last_name}`}
            </h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-slate-400">
              {p.position && <span className="text-green-400 font-medium">{positions[p.position] ?? p.position}</span>}
              {p.nationality_name && <span>🌍 {p.nationality_name}</span>}
              {age && <span>Age {age}</span>}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-slate-500">
              {p.height_cm && <span>Height: {p.height_cm}cm</span>}
              {p.weight_kg && <span>Weight: {p.weight_kg}kg</span>}
              {p.date_of_birth && <span>Born: {format(new Date(p.date_of_birth), 'd MMM yyyy')}</span>}
            </div>
          </div>
        </div>
      </Card>

      {/* Current team */}
      {contracts?.[0] && (
        <Card className="p-4">
          <h2 className="font-display font-bold text-sm uppercase text-slate-400 mb-3">Current Club</h2>
          <div className="flex items-center gap-3">
            <TeamLogo name={contracts[0].team_name} logoUrl={contracts[0].logo_url} size={40} />
            <div>
              <div className="font-medium text-white">{contracts[0].team_name}</div>
              <div className="text-xs text-slate-500">
                Since {format(new Date(contracts[0].start_date), 'MMM yyyy')}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Competition stats */}
      {stats?.length > 0 && (
        <Card className="p-4">
          <h2 className="font-display font-bold text-sm uppercase text-slate-400 mb-3">Competition Stats</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Competition', 'Season', 'Apps', 'Goals', 'Assists', 'Mins', 'YC', 'RC'].map(h => (
                    <th key={h} className="text-left px-2 py-2 text-xs text-slate-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {stats.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-800/30">
                    <td className="px-2 py-2.5 text-slate-200">{s.competition_name}</td>
                    <td className="px-2 py-2.5 text-slate-400">{s.season_name ?? '—'}</td>
                    <td className="px-2 py-2.5 text-slate-300">{s.appearances}</td>
                    <td className="px-2 py-2.5 font-bold text-green-400">{s.goals}</td>
                    <td className="px-2 py-2.5 text-blue-400">{s.assists}</td>
                    <td className="px-2 py-2.5 text-slate-400">{s.minutes_played}</td>
                    <td className="px-2 py-2.5 text-yellow-400">{s.yellow_cards}</td>
                    <td className="px-2 py-2.5 text-red-400">{s.red_cards}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
