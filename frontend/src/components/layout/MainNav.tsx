'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const links = [
  { href: '/',             label: 'Scores' },
  { href: '/standings',    label: 'Standings' },
  { href: '/competitions', label: 'Competitions' },
  { href: '/brackets',     label: 'Brackets' },
  { href: '/stats',        label: 'Stats' },
  { href: '/players',      label: 'Players' },
]

export function MainNav() {
  const pathname = usePathname()
  if (pathname.startsWith('/admin') || pathname.startsWith('/scorer')) return null

  return (
    <header className="border-b border-slate-800 bg-[#0d1117] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-14 overflow-x-auto">
        <Link href="/"
          className="font-bold text-lg tracking-wide text-white flex items-center gap-2 flex-shrink-0 mr-4"
          style={{ fontFamily: 'Arial Black, sans-serif' }}>
          <span className="text-green-400">⚽</span>
          <span>MATCH<span className="text-green-400">DAY</span></span>
        </Link>
        <nav className="flex items-center gap-0.5">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={clsx(
                'px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap',
                pathname === l.href
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
