'use client'
import { useState, useCallback } from 'react'
import useSWR from 'swr'
import { apiFetch, type Match } from '@/lib/api'
import { useLiveScores } from '@/hooks/useSocket'
import { MatchCard } from '@/components/scores/MatchCard'
import { Card, SectionHeader } from '@/components/ui'
import { format } from 'date-fns'

const fetcher = (url: string) => apiFetch(url)
const TABS = ['All', 'Live', 'Today', 'Finished']

export default function HomePage() {
  const [tab, setTab] = useState('All')
  const today = format(new Date(), 'yyyy-MM-dd')

  const params = tab === 'Live'     ? '?status=live'
               : tab === 'Today'    ? `?date=${today}`
               : tab === 'Finished' ? '?status=finished'
               : ''

  const { data, error, mutate } = useSWR(
    `https://matchday.koraforge.com.ng/api/matches${params}`,
    fetcher,
    { refreshInterval: tab === 'Live' ? 10000 : 30000 }
  )

  const handleLiveScore = useCallback((update: { matchId: string; homeScore: number; awayScore: number; status: string }) => {
    mutate(prev => {
      if (!prev) return prev
      return {
        matches: prev.matches.map(m =>
          m.id === update.matchId
            ? { ...m, home_score: update.homeScore, away_score: update.awayScore, status: update.status as any }
            : m
        ),
      }
    }, false)
  }, [mutate])

  useLiveScores(handleLiveScore)

  const grouped = (data?.matches ?? []).reduce<Record<string, Match[]>>((acc, m) => {
    const key = m.competition_name
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 style={{ fontFamily: 'Arial Black, sans-serif' }} className="font-bold text-2xl tracking-wide text-white uppercase">
          Football Scores
        </h1>
        <span className="text-sm text-slate-400">{format(new Date(), 'EEEE, d MMMM yyyy')}</span>
      </div>

      <div className="flex gap-1 border-b border-slate-800">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t ? 'border-green-400 text-green-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {error && (
        <Card className="p-6 text-center">
          <p className="text-red-400 text-sm mb-1">Could not connect to API</p>
          <p className="text-slate-500 text-xs">Make sure the backend is running on https://matchday.koraforge.com.ng/api</p>
        </Card>
      )}

      {!data && !error && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-800/40 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {data && Object.keys(grouped).length === 0 && (
        <Card className="p-12 text-center text-slate-500">No matches found</Card>
      )}

      {Object.entries(grouped).map(([competition, matches]) => (
        <div key={competition}>
          <SectionHeader title={competition} subtitle={`${matches.length} match${matches.length !== 1 ? 'es' : ''}`} />
          <div className="space-y-1">
            {matches.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
