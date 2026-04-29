'use client'
import useSWR from 'swr'
import Link from 'next/link'
import { apiFetch, type Competition } from '@/lib/api'
import { Card } from '@/components/ui'

const fetcher = (url: string) => apiFetch(url)

export default function CompetitionsPage() {
  const { data } = useSWR('/competitions', fetcher)
  const local  = data?.competitions.filter(c => c.is_local)  ?? []
  const global = data?.competitions.filter(c => !c.is_local) ?? []

  return (
    <div className="space-y-8">
      <h1 className="font-display font-bold text-2xl tracking-wide text-white uppercase">Competitions</h1>

      {local.length > 0 && (
        <section>
          <h2 className="font-display text-base font-bold text-green-400 uppercase mb-3 tracking-wide">
            ★ Local Competitions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {local.map(c => <CompCard key={c.id} comp={c} />)}
          </div>
        </section>
      )}

      {global.length > 0 && (
        <section>
          <h2 className="font-display text-base font-bold text-slate-400 uppercase mb-3 tracking-wide">
            International & Club Competitions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {global.map(c => <CompCard key={c.id} comp={c} />)}
          </div>
        </section>
      )}
    </div>
  )
}

function CompCard({ comp: c }: { comp: Competition }) {
  return (
    <Link href={`/competitions/${c.id}`}>
      <Card className="p-4 hover:border-slate-600 transition-colors cursor-pointer group">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
            {c.logo_url
              ? <img src={c.logo_url} alt="" className="w-8 h-8 object-contain" />
              : <span className="text-lg">🏆</span>
            }
          </div>
          <div>
            <div className="font-medium text-white group-hover:text-green-400 transition-colors">{c.name}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {c.country_name && `${c.country_name} · `}
              {c.format.replace('_', ' ')}
              {c.season_name && ` · ${c.season_name}`}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
