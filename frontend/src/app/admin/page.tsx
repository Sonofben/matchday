'use client'
import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { apiFetch } from '@/lib/api'
import { Card } from '@/components/ui'
import { AdminMatches }      from '@/components/admin/AdminMatches'
import { AdminTeams }        from '@/components/admin/AdminTeams'
import { AdminPlayers }      from '@/components/admin/AdminPlayers'
import { AdminScorers }      from '@/components/admin/AdminScorers'
import { AdminCompetitions } from '@/components/admin/AdminCompetitions'
import { LayoutDashboard, Calendar, Shield, User, Users, Trophy, LogOut, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

const API = 'https://matchday.koraforge.com.ng/api'

const SECTIONS = [
  { key: 'dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { key: 'competitions', label: 'Competitions', icon: Trophy },
  { key: 'matches',      label: 'Matches',      icon: Calendar },
  { key: 'teams',        label: 'Teams',        icon: Shield },
  { key: 'players',      label: 'Players',      icon: User },
  { key: 'scorers',      label: 'Scorers',      icon: Users },
]

export default function AdminPage() {
  const [section, setSection]   = useState('dashboard')
  const [token, setToken]       = useState<string | null>(null)
  const [authUser, setAuthUser] = useState<any>(null)
  const [email, setEmail]       = useState('admin@matchday.local')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('matchday_admin_token')
    const savedUser = localStorage.getItem('matchday_admin_user')
    if (saved && savedUser) { setToken(saved); setAuthUser(JSON.parse(savedUser)) }
  }, [])

  const { data: stats, isLoading: statsLoading } = useSWR(
    token ? `/admin/stats` : null,
    (url) => apiFetch(url, { headers: { Authorization: `Bearer ${token}` } }),
    { refreshInterval: 15000 }
  )

  async function login() {
    setLoading(true); setError('')
    try {
      const res  = await fetch(`https://matchday.koraforge.com.ng/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Login failed')
      if (data.user.role !== 'admin') throw new Error('Admin access only')
      localStorage.setItem('matchday_admin_token', data.token)
      localStorage.setItem('matchday_admin_user', JSON.stringify(data.user))
      setToken(data.token); setAuthUser(data.user)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  function logout() {
    localStorage.removeItem('matchday_admin_token')
    localStorage.removeItem('matchday_admin_user')
    setToken(null); setAuthUser(null)
  }

  if (!token) return (
    <div className="min-h-screen bg-[#0a0e14] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-5xl">⚽</span>
          <h1 className="text-2xl font-bold text-white mt-3" style={{ fontFamily: 'Arial Black' }}>
            MATCH<span className="text-green-400">DAY</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">Admin Panel</p>
        </div>
        <Card className="p-6">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && login()}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500" />
            </div>
            {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-xs">{error}</div>}
            <button onClick={login} disabled={loading || !email || !password}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm flex items-center justify-center gap-2">
              {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in...</> : <>Sign in <ChevronRight size={14} /></>}
            </button>
          </div>
        </Card>
        <p className="text-center text-xs text-slate-700 mt-4">This page is not publicly accessible</p>
      </div>
    </div>
  )

  const s = stats as any

  return (
    <div className="min-h-screen bg-[#0a0e14]">
      <header className="border-b border-slate-800 bg-[#0d1117] sticky top-0 z-50 h-14 flex items-center px-6 gap-4">
        <span className="font-bold text-white" style={{ fontFamily: 'Arial Black' }}>
          ⚽ MATCH<span className="text-green-400">DAY</span>
          <span className="text-slate-500 font-normal text-sm ml-2">Admin</span>
        </span>
        <div className="ml-auto flex items-center gap-3">
          {s?.live_matches > 0 && <div className="flex items-center gap-1.5 text-xs text-red-400"><span className="live-dot" />{s.live_matches} live</div>}
          <span className="text-sm text-slate-400">{authUser?.full_name}</span>
          <button onClick={logout} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors">
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </header>

      <div className="flex">
        <aside className="w-52 flex-shrink-0 border-r border-slate-800 min-h-[calc(100vh-56px)] p-3">
          <nav className="space-y-0.5">
            {SECTIONS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setSection(key)}
                className={clsx('w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-2.5 transition-colors',
                  section === key ? 'bg-green-500/10 text-green-400 font-medium' : 'text-slate-400 hover:text-white hover:bg-slate-800')}>
                <Icon size={15} />
                {label}
                {key === 'matches' && s?.live_matches > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{s.live_matches}</span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6 min-w-0">
          {section === 'dashboard' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white">Dashboard</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { label: 'Live Now',     value: s?.live_matches,        color: 'text-red-400',    bg: 'bg-red-500/10' },
                  { label: 'Today',        value: s?.today_matches,       color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                  { label: 'Teams',        value: s?.total_teams,         color: 'text-blue-400',   bg: 'bg-blue-500/10' },
                  { label: 'Players',      value: s?.total_players,       color: 'text-purple-400', bg: 'bg-purple-500/10' },
                  { label: 'Competitions', value: s?.active_competitions, color: 'text-green-400',  bg: 'bg-green-500/10' },
                ].map(stat => (
                  <Card key={stat.label} className={`p-4 text-center border-transparent ${stat.bg}`}>
                    <div className={`text-3xl font-bold ${stat.color}`}>{statsLoading ? '…' : (stat.value ?? 0)}</div>
                    <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
                  </Card>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Quick Actions</h3>
                  <div className="space-y-1">
                    {[
                      { label: '+ Create competition', sec: 'competitions' },
                      { label: '+ Create new match',   sec: 'matches' },
                      { label: '+ Add team',           sec: 'teams' },
                      { label: '+ Register player',    sec: 'players' },
                      { label: '+ Add scorer',         sec: 'scorers' },
                    ].map(a => (
                      <button key={a.label} onClick={() => setSection(a.sec)}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-between group">
                        {a.label}
                        <ChevronRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </Card>
                <Card className="p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Access URLs</h3>
                  <div className="space-y-2 text-xs">
                    {[
                      { label: 'Public site',  url: 'http://localhost:3000',        note: 'Fans & viewers' },
                      { label: 'Admin panel',  url: 'http://localhost:3000/admin',  note: 'You are here' },
                      { label: 'Scorer app',   url: 'http://localhost:3000/scorer', note: 'Mobile score entry' },
                    ].map(r => (
                      <div key={r.label} className="flex items-center justify-between">
                        <span className="text-slate-300">{r.label} <span className="text-slate-600">({r.note})</span></span>
                        <span className="font-mono text-slate-500 text-xs">{r.url.replace('http://localhost:3000','')}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}
          {section === 'competitions' && token && <AdminCompetitions token={token} />}
          {section === 'matches'      && token && <AdminMatches      token={token} />}
          {section === 'teams'        && token && <AdminTeams        token={token} />}
          {section === 'players'      && token && <AdminPlayers      token={token} />}
          {section === 'scorers'      && token && <AdminScorers      token={token} />}
        </main>
      </div>
    </div>
  )
}
