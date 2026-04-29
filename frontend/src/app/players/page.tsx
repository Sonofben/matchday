'use client'
import { useState, useCallback } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { apiFetch, type Player } from '@/lib/api'
import { Card, TeamLogo } from '@/components/ui'
import { Search } from 'lucide-react'

const fetcher = (url: string) => apiFetch(url)

export default function PlayersPage() {
  const [search, setSearch] = useState('')
  const query = search.length >= 2 ? `?search=${encodeURIComponent(search)}` : ''

  const { data } = useSWR(
    `/players${query}`,
    fetcher,
    { keepPreviousData: true }
  )

  const positions: Record<string, string> = {
    goalkeeper: 'GK', defender: 'DEF', midfielder: 'MID', forward: 'FWD'
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display font-bold text-2xl tracking-wide text-white uppercase">Players</h1>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search players..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-[#141920] border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-green-500/60"
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {(data?.players ?? []).map(p => (
          <Link key={p.id} href={`/players/${p.id}`}>
            <Card className="p-4 hover:border-slate-600 transition-colors cursor-pointer group">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-slate-700 flex-shrink-0 overflow-hidden">
                  {p.photo_url
                    ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-slate-400 font-display font-bold text-lg">
                        {(p.display_name ?? p.last_name).slice(0,1)}
                      </div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate group-hover:text-green-400 transition-colors">
                    {p.display_name ?? `${p.first_name} ${p.last_name}`}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.position && (
                      <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                        {positions[p.position] ?? p.position.toUpperCase()}
                      </span>
                    )}
                    {p.current_team && (
                      <span className="text-xs text-slate-500 truncate">{p.current_team}</span>
                    )}
                  </div>
                  {p.nationality_name && (
                    <span className="text-xs text-slate-600">{p.nationality_name}</span>
                  )}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {data?.players.length === 0 && (
        <Card className="p-12 text-center text-slate-500">
          {search.length >= 2 ? `No players found for "${search}"` : 'No players yet'}
        </Card>
      )}
    </div>
  )
}
