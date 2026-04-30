'use client'
import Link from 'next/link'
import { format } from 'date-fns'
import type { Match } from '@/lib/api'
import { StatusBadge, TeamLogo } from '@/components/ui'
import clsx from 'clsx'

interface Props { match: Match; flash?: boolean }

export function MatchCard({ match: m, flash }: Props) {
  const isLive     = m.status === 'live' || m.status === 'half_time'
  const isFinished = m.status === 'finished'
  const kickoffTime = format(new Date(m.scheduled_at), 'HH:mm')
  const kickoffDate = format(new Date(m.scheduled_at), 'dd/MM')

  return (
    <Link href={`/matches/${m.id}`}>
      <div className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors cursor-pointer group',
        'bg-[#141920] border-slate-800 hover:border-slate-600 hover:bg-[#1a2030]',
        flash && 'score-flash'
      )}>
        {/* Time / Status */}
        <div className="w-16 flex-shrink-0 text-center">
          {isLive || m.status === 'half_time'
            ? <StatusBadge status={m.status} minute={m.minute} />
            : isFinished
            ? <span className="text-xs text-slate-500 font-medium">FT</span>
            : (
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-500 font-medium leading-none mb-1">{kickoffDate}</span>
                <span className="text-xs text-slate-400 font-mono leading-none">{kickoffTime}</span>
              </div>
            )
          }
        </div>

        {/* Home team */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          <span className={clsx(
            'text-sm font-medium truncate',
            isLive ? 'text-white' : 'text-slate-300'
          )}>
            {m.home_short ?? m.home_team_name}
          </span>
          <TeamLogo name={m.home_team_name} logoUrl={m.home_logo} size={22} />
        </div>

        {/* Score */}
        <div className={clsx(
          'flex items-center gap-1.5 px-3 py-1 rounded-lg min-w-[64px] justify-center',
          isLive     ? 'bg-red-500/10 border border-red-500/20' :
          isFinished ? 'bg-slate-800' :
                       'bg-slate-900'
        )}>
          <span className={clsx(
            'font-display font-bold text-lg tabular-nums',
            isLive ? 'text-white' : isFinished ? 'text-slate-200' : 'text-slate-500'
          )}>
            {isFinished || isLive || m.status === 'half_time'
              ? `${m.home_score} - ${m.away_score}`
              : '- -'}
          </span>
        </div>

        {/* Away team */}
        <div className="flex items-center gap-2 flex-1">
          <TeamLogo name={m.away_team_name} logoUrl={m.away_logo} size={22} />
          <span className={clsx(
            'text-sm font-medium truncate',
            isLive ? 'text-white' : 'text-slate-300'
          )}>
            {m.away_short ?? m.away_team_name}
          </span>
        </div>

        {/* Round / arrow */}
        <div className="w-20 flex-shrink-0 text-right">
          {m.is_friendly
            ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium">FRIENDLY</span>
            : m.round && <span className="text-xs text-slate-600 truncate">{m.round}</span>
          }
          <span className="text-slate-700 group-hover:text-slate-400 ml-1 transition-colors">›</span>
        </div>
      </div>
    </Link>
  )
}
