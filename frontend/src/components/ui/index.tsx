import clsx from 'clsx'

// ── LiveBadge ────────────────────────────────────────────────────────────────
export function LiveBadge({ minute }: { minute?: number | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold px-2 py-0.5 rounded-full">
      <span className="live-dot" />
      {minute != null ? `${minute}'` : 'LIVE'}
    </span>
  )
}

// ── StatusBadge ───────────────────────────────────────────────────────────────
export function StatusBadge({ status, minute }: { status: string; minute?: number | null }) {
  if (status === 'live')      return <LiveBadge minute={minute} />
  if (status === 'half_time') return <span className="text-xs text-yellow-400 font-semibold">HT</span>
  if (status === 'finished')  return <span className="text-xs text-slate-500 font-medium">FT</span>
  if (status === 'postponed') return <span className="text-xs text-orange-400 font-medium">PPD</span>
  if (status === 'cancelled') return <span className="text-xs text-red-400 font-medium">CAN</span>
  return null
}

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('bg-[#141920] border border-slate-800 rounded-xl', className)}>
      {children}
    </div>
  )
}

// ── SectionHeader ─────────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-4">
      <h2 className="font-display font-bold text-lg tracking-wide text-white uppercase">{title}</h2>
      {subtitle && <span className="text-xs text-slate-500">{subtitle}</span>}
    </div>
  )
}

// ── TeamLogo ──────────────────────────────────────────────────────────────────
export function TeamLogo({ name, logoUrl, size = 24 }: { name: string; logoUrl?: string | null; size?: number }) {
  if (logoUrl) {
    return <img src={logoUrl} alt={name} width={size} height={size} className="object-contain" />
  }
  // Fallback: colored initials
  return (
    <span
      className="inline-flex items-center justify-center rounded bg-slate-700 text-slate-200 font-bold"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  )
}

// ── FormDots ──────────────────────────────────────────────────────────────────
export function FormDots({ form }: { form: string | null }) {
  if (!form) return null
  return (
    <span className="flex gap-0.5">
      {form.split('').slice(-5).map((r, i) => (
        <span
          key={i}
          className={clsx('w-4 h-4 rounded-sm text-[9px] font-bold flex items-center justify-center',
            r === 'W' ? 'bg-green-600 text-green-100' :
            r === 'D' ? 'bg-yellow-600 text-yellow-100' :
                        'bg-red-700 text-red-100'
          )}
        >
          {r}
        </span>
      ))}
    </span>
  )
}

// ── EventIcon ─────────────────────────────────────────────────────────────────
export function EventIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    goal:           '⚽',
    own_goal:       '⚽',
    penalty_goal:   '⚽',
    penalty_missed: '❌',
    yellow_card:    '🟨',
    red_card:       '🟥',
    yellow_red_card:'🟨🟥',
    substitution:   '🔄',
  }
  return <span className="text-sm">{icons[type] ?? '•'}</span>
}
