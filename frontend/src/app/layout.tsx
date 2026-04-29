import type { Metadata } from 'next'
import './globals.css'
import { MainNav } from '@/components/layout/MainNav'

export const metadata: Metadata = {
  title: { default: 'MatchDay', template: '%s | MatchDay' },
  description: 'Live football scores, standings, and stats',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0e14] text-slate-200">
        <MainNav />
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  )
}
