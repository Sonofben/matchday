'use client'
import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

const API = 'https://matchday.koraforge.com.ng/api'
type Screen = 'login' | 'matches' | 'lineup' | 'live'

export default function ScorerPage() {
  const [screen, setScreen]       = useState<Screen>('login')
  const [token, setToken]         = useState<string | null>(null)
  const [user, setUser]           = useState<any>(null)
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loginError, setLoginError] = useState('')
  const [loading, setLoading]     = useState(false)
  const [matches, setMatches]     = useState<any[]>([])
  const [selected, setSelected]   = useState<any>(null)
  const [matchDetail, setMatchDetail] = useState<any>(null)
  const [homeSquad, setHomeSquad] = useState<any[]>([])
  const [awaySquad, setAwaySquad] = useState<any[]>([])
  const [liveMinute, setLiveMinute]   = useState(0)
  const [showAddTime, setShowAddTime] = useState(false)
  const [addTimeValue, setAddTimeValue] = useState(0)
  const [eventModal, setEventModal]   = useState<{ type: string; teamId: string } | null>(null)
  const [lineupTeam, setLineupTeam]   = useState<'home'|'away'>('home')
  const [lineupSelections, setLineupSelections] = useState<Record<string, { is_starter: boolean; is_captain: boolean }>>({})
  const [coachName, setCoachName]   = useState('')
  const [savingLineup, setSavingLineup] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const timerRef  = useRef<any>(null)

  useEffect(() => {
    const saved     = localStorage.getItem('matchday_scorer_token')
    const savedUser = localStorage.getItem('matchday_scorer_user')
    if (saved && savedUser) {
      setToken(saved); setUser(JSON.parse(savedUser))
      setScreen('matches')
      loadMatchesWith(saved)
    }
  }, [])

  useEffect(() => {
    if (!selected) return
    clearInterval(timerRef.current)
    if (selected.status === 'live' && selected.timer_running && selected.timer_started_at) {
      const startedAt = new Date(selected.timer_started_at).getTime()
      const offset    = selected.timer_offset ?? 0
      const halfDur   = selected.half_duration ?? 45
      const update = () => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000 / 60) + offset
        setLiveMinute(elapsed)
        if (elapsed >= halfDur && (selected.current_half ?? 1) === 1 && !showAddTime) setShowAddTime(true)
        if (elapsed >= halfDur * 2 && (selected.current_half ?? 1) === 2 && !showAddTime) setShowAddTime(true)
      }
      update()
      timerRef.current = setInterval(update, 5000)
    } else {
      setLiveMinute(selected.minute ?? 0)
    }
    return () => clearInterval(timerRef.current)
  }, [selected?.status, selected?.timer_running, selected?.timer_started_at])

  async function loadMatchesWith(tkn: string) {
    try {
      const [live, sched] = await Promise.all([
        fetch(`https://matchday.koraforge.com.ng/api/matches?status=live`).then(r => r.json()),
        fetch(`https://matchday.koraforge.com.ng/api/matches?status=scheduled`).then(r => r.json()),
      ])
      setMatches([...(live.matches ?? []), ...(sched.matches ?? [])])
    } catch { console.error('Backend not reachable') }
  }

  async function loadMatchDetail(matchId: string) {
    try {
      const res  = await fetch(`https://matchday.koraforge.com.ng/api/matches/${matchId}`)
      const data = await res.json()
      setMatchDetail(data)
      return data
    } catch { return null }
  }

  async function loadSquads(homeId: string, awayId: string) {
    try {
      const [h, a] = await Promise.all([
        fetch(`https://matchday.koraforge.com.ng/api/teams/${homeId}`).then(r => r.json()),
        fetch(`https://matchday.koraforge.com.ng/api/teams/${awayId}`).then(r => r.json()),
      ])
      setHomeSquad(h.squad ?? [])
      setAwaySquad(a.squad ?? [])
    } catch { console.error('Could not load squads') }
  }

  async function login() {
    setLoading(true); setLoginError('')
    try {
      const res  = await fetch(`https://matchday.koraforge.com.ng/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Login failed')
      if (!['admin','scorer'].includes(data.user.role)) throw new Error('Scorer access only')
      localStorage.setItem('matchday_scorer_token', data.token)
      localStorage.setItem('matchday_scorer_user', JSON.stringify(data.user))
      setToken(data.token); setUser(data.user)
      setScreen('matches')
      loadMatchesWith(data.token)
    } catch (e: any) { setLoginError(e.message) }
    finally { setLoading(false) }
  }

  function logout() {
    localStorage.removeItem('matchday_scorer_token')
    localStorage.removeItem('matchday_scorer_user')
    setToken(null); setUser(null); setSelected(null); setMatchDetail(null); setScreen('login')
  }

  async function patch(update: Record<string, any>) {
    if (!selected || !token) return
    const updated = { ...selected, ...update }
    setSelected(updated)
    setMatches(prev => prev.map(m => m.id === selected.id ? updated : m))
    await fetch(`https://matchday.koraforge.com.ng/api/matches/${selected.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
  }

  async function kickOff() {
    const now = new Date().toISOString()
    await patch({ status: 'live', minute: 1, timer_running: true, timer_started_at: now, timer_offset: 0, current_half: 1 })
    if (!socketRef.current) socketRef.current = io(API, { transports: ['websocket'] })
    socketRef.current.emit('subscribe:match', selected.id)
  }

  async function confirmHalfTime(added: number) {
    clearInterval(timerRef.current)
    await patch({ status: 'half_time', minute: (selected.half_duration ?? 45) + added, timer_running: false, added_time_ht: added })
    setShowAddTime(false)
  }

  async function secondHalf() {
    const now = new Date().toISOString(); const h = selected.half_duration ?? 45
    await patch({ status: 'live', minute: h + 1, timer_running: true, timer_started_at: now, timer_offset: h + 1, current_half: 2 })
  }

  async function confirmFullTime(added: number) {
    clearInterval(timerRef.current)
    const h = selected.half_duration ?? 45
    await patch({ status: 'finished', minute: h * 2 + added, timer_running: false, added_time_ft: added })
    setShowAddTime(false)
  }

  async function addEvent(type: string, teamId: string, extra: any = {}) {
    if (!selected || !token) return
    await fetch(`https://matchday.koraforge.com.ng/api/matches/${selected.id}/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: type, minute: liveMinute || selected.minute || 1, team_id: teamId, ...extra }),
    })
    if (['goal','penalty_goal'].includes(type)) {
      await patch(teamId === selected.home_team_id ? { home_score: selected.home_score + 1 } : { away_score: selected.away_score + 1 })
    }
    await loadMatchDetail(selected.id)
    setEventModal(null)
  }

  async function saveLineup() {
    if (!selected || !token) return
    setSavingLineup(true)
    try {
      const teamId  = lineupTeam === 'home' ? selected.home_team_id : selected.away_team_id
      const players = Object.entries(lineupSelections).map(([player_id, sel]) => ({
        player_id, is_starter: sel.is_starter, is_captain: sel.is_captain,
      }))
      await fetch(`https://matchday.koraforge.com.ng/api/matches/${selected.id}/lineups`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: teamId, players, coach_name: coachName || undefined, confirmed: true }),
      })
      await loadMatchDetail(selected.id)
      setLineupSelections({}); setCoachName('')
      alert(`✅ ${lineupTeam === 'home' ? selected.home_team_name : selected.away_team_name} lineup saved!`)
    } catch (e: any) { alert(e.message) }
    finally { setSavingLineup(false) }
  }

  // ── LOGIN ────────────────────────────────────────────────────────────────
  if (screen === 'login') return (
    <div className="min-h-screen bg-[#0a0e14] flex items-center justify-center p-4">
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">📱</div>
          <h1 className="text-xl font-bold text-white">Scorer Login</h1>
          <p className="text-slate-500 text-sm mt-1">Enter live scores from the field</p>
        </div>
        <div className="bg-[#141920] border border-slate-800 rounded-2xl p-5 space-y-3">
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-green-500" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && login()}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-green-500" />
          {loginError && <p className="text-red-400 text-xs text-center">{loginError}</p>}
          <button onClick={login} disabled={loading || !email || !password}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl text-sm">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
        <p className="text-center text-xs text-slate-700 mt-4">Scorer access only — not public</p>
      </div>
    </div>
  )

  // ── MATCH LIST ────────────────────────────────────────────────────────────
  if (screen === 'matches') return (
    <div className="min-h-screen bg-[#0a0e14] p-4">
      <div className="flex items-center justify-between mb-5 max-w-sm mx-auto">
        <h1 className="text-lg font-bold text-white">Select Match</h1>
        <div className="flex gap-3 items-center">
          <span className="text-xs text-slate-500">{user?.full_name}</span>
          <button onClick={logout} className="text-xs text-slate-600 hover:text-red-400">Sign out</button>
        </div>
      </div>
      <div className="space-y-2 max-w-sm mx-auto">
        {matches.length === 0 && (
          <div className="text-center text-slate-500 text-sm py-16">
            <div className="text-4xl mb-3">⚽</div>
            No matches available
            <button onClick={() => token && loadMatchesWith(token)} className="block mx-auto mt-3 text-xs text-green-400 underline">Refresh</button>
          </div>
        )}
        {matches.map(m => (
          <button key={m.id} onClick={async () => {
            setSelected(m)
            await Promise.all([loadMatchDetail(m.id), loadSquads(m.home_team_id, m.away_team_id)])
            setScreen('lineup')
          }}
            className="w-full bg-[#141920] border border-slate-700 hover:border-green-500/50 rounded-2xl p-4 text-left transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">{m.competition_name}</span>
                {m.is_friendly
                  ? <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">Friendly</span>
                  : m.round ? <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 font-medium">{m.round}</span> : null
                }
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'live' ? 'bg-red-500/20 text-red-400' : m.status === 'half_time' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-400'}`}>
                {m.status === 'live' ? `🔴 ${m.minute}'` : m.status === 'half_time' ? '⏸ HT' : '⏳ Scheduled'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold text-sm">{m.home_short ?? m.home_team_name}</span>
              <span className="text-white font-bold tabular-nums">
                {['live','half_time','finished'].includes(m.status) ? `${m.home_score} - ${m.away_score}` : 'vs'}
              </span>
              <span className="text-white font-semibold text-sm">{m.away_short ?? m.away_team_name}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  // ── LINEUP SETUP ──────────────────────────────────────────────────────────
  if (screen === 'lineup' && selected) {
    const squad     = lineupTeam === 'home' ? homeSquad : awaySquad
    const teamId    = lineupTeam === 'home' ? selected.home_team_id : selected.away_team_id
    const teamName  = lineupTeam === 'home' ? selected.home_team_name : selected.away_team_name
    const lineups   = matchDetail?.lineups ?? []
    const alreadySet = lineups.filter((l: any) => l.team_id === teamId)
    const starters  = Object.entries(lineupSelections).filter(([,s]) => s.is_starter).length
    const bench     = Object.entries(lineupSelections).filter(([,s]) => !s.is_starter).length

    // Group squad by position
    const byPos: Record<string, any[]> = { goalkeeper: [], defender: [], midfielder: [], forward: [], unknown: [] }
    squad.forEach((p: any) => {
      const pos = p.position ?? 'unknown'
      if (!byPos[pos]) byPos[pos] = []
      byPos[pos].push(p)
    })
    const posLabels: Record<string, string> = { goalkeeper: 'Goalkeepers', defender: 'Defenders', midfielder: 'Midfielders', forward: 'Forwards', unknown: 'Players' }

    return (
      <div className="min-h-screen bg-[#0a0e14] p-4 max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setScreen('matches')} className="text-slate-400 text-sm">← Matches</button>
          <button onClick={() => setScreen('live')}
            className="bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg">
            Go to Live →
          </button>
        </div>

        <h2 className="text-white font-bold text-lg mb-1">Confirm Lineup</h2>
        <p className="text-slate-500 text-xs mb-4">{selected.home_team_name} vs {selected.away_team_name}</p>

        {/* Team toggle */}
        <div className="flex gap-2 mb-4">
          {(['home','away'] as const).map(side => {
            const tid  = side === 'home' ? selected.home_team_id : selected.away_team_id
            const done = lineups.some((l: any) => l.team_id === tid && l.confirmed)
            return (
              <button key={side} onClick={() => { setLineupTeam(side); setLineupSelections({}); setCoachName('') }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors relative ${lineupTeam === side ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-slate-800 text-slate-400 hover:text-white border border-transparent'}`}>
                {side === 'home' ? selected.home_team_name : selected.away_team_name}
                {done && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center text-white" style={{fontSize:8}}>✓</span>}
              </button>
            )
          })}
        </div>

        {/* Already confirmed indicator */}
        {alreadySet.length > 0 && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-3 text-xs text-green-400">
            ✓ {alreadySet.filter((l: any) => l.is_starter).length} starters + {alreadySet.filter((l: any) => !l.is_starter).length} bench already confirmed for {teamName}
          </div>
        )}

        {/* Coach */}
        <div className="mb-3">
          <label className="text-xs text-slate-400 block mb-1">Coach Name</label>
          <input value={coachName} onChange={e => setCoachName(e.target.value)}
            placeholder="Head coach full name"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500" />
        </div>

        {/* Summary bar */}
        {Object.keys(lineupSelections).length > 0 && (
          <div className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-2 mb-3 text-sm">
            <span className="text-green-400 font-medium">{starters} starters</span>
            <span className="text-slate-500">·</span>
            <span className="text-blue-400 font-medium">{bench} bench</span>
            <span className="text-slate-500">·</span>
            <span className="text-white font-medium">{Object.keys(lineupSelections).length} total</span>
          </div>
        )}

        {/* Player list by position */}
        {squad.length === 0 ? (
          <div className="bg-[#141920] border border-slate-800 rounded-2xl p-6 text-center text-slate-500 text-sm mb-3">
            No players registered for {teamName}.<br/>
            <span className="text-xs">Add players via the Admin panel first.</span>
          </div>
        ) : (
          <div className="bg-[#141920] border border-slate-800 rounded-2xl overflow-hidden mb-3">
            {Object.entries(byPos).map(([pos, players]) => {
              if (players.length === 0) return null
              return (
                <div key={pos}>
                  <div className="px-4 py-2 bg-slate-800/50 text-xs text-slate-500 font-medium uppercase tracking-wide">
                    {posLabels[pos] ?? pos}
                  </div>
                  {players.map((p: any) => {
                    const sel = lineupSelections[p.id]
                    return (
                      <div key={p.id} onClick={() => {
                        setLineupSelections(prev => {
                          if (prev[p.id]) { const n = { ...prev }; delete n[p.id]; return n }
                          return { ...prev, [p.id]: { is_starter: true, is_captain: false } }
                        })
                      }}
                        className={`flex items-center gap-3 px-4 py-3 border-b border-slate-800/50 last:border-0 cursor-pointer transition-colors ${sel ? 'bg-slate-700/50' : 'hover:bg-slate-800/30'}`}>

                        {/* Player photo */}
                        <div className="w-9 h-9 rounded-full bg-slate-700 flex-shrink-0 overflow-hidden">
                          {p.photo_url
                            ? <img src={`https://matchday.koraforge.com.ng${p.photo_url}`} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-sm">
                                {(p.last_name || p.first_name || '?')[0].toUpperCase()}
                              </div>
                          }
                        </div>

                        {/* Jersey + name */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {(p.squad_number ?? p.jersey_number) && (
                              <span className="text-xs text-slate-500 font-mono">#{p.squad_number ?? p.jersey_number}</span>
                            )}
                            <span className="text-sm text-white truncate">{p.display_name ?? `${p.first_name} ${p.last_name}`}</span>
                          </div>
                        </div>

                        {/* Controls */}
                        {sel ? (
                          <div className="flex gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setLineupSelections(prev => ({ ...prev, [p.id]: { ...prev[p.id], is_starter: !prev[p.id].is_starter } }))}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${sel.is_starter ? 'bg-green-600 text-white' : 'bg-slate-600 text-slate-300'}`}>
                              {sel.is_starter ? 'START' : 'BENCH'}
                            </button>
                            <button onClick={() => setLineupSelections(prev => ({ ...prev, [p.id]: { ...prev[p.id], is_captain: !prev[p.id].is_captain } }))}
                              className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors ${sel.is_captain ? 'bg-yellow-500 text-black' : 'bg-slate-600 text-slate-400'}`}>
                              C
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs flex-shrink-0">Tap to add</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        <button onClick={saveLineup} disabled={savingLineup || Object.keys(lineupSelections).length === 0}
          className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-3 rounded-2xl text-sm mb-3 transition-colors">
          {savingLineup ? 'Saving...' : `Save ${teamName} Lineup (${Object.keys(lineupSelections).length} players)`}
        </button>

        <button onClick={() => setScreen('live')}
          className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-2xl text-sm transition-colors">
          Skip → Go to Live Score Entry
        </button>
      </div>
    )
  }

  // ── LIVE ENTRY ────────────────────────────────────────────────────────────
  if (!selected) { setScreen('matches'); return null }

  const lineups     = matchDetail?.lineups ?? []
  const homePlayers = lineups.filter((l: any) => l.team_id === selected.home_team_id)
  const awayPlayers = lineups.filter((l: any) => l.team_id === selected.away_team_id)
  const halfDur     = selected.half_duration ?? 45

  return (
    <div className="min-h-screen bg-[#0a0e14] p-4 max-w-sm mx-auto select-none">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setScreen('lineup')} className="text-slate-400 text-sm">← Lineup</button>
        <span className="text-xs text-slate-500">{selected.competition_name}</span>
        <button onClick={logout} className="text-xs text-slate-600 hover:text-red-400">Sign out</button>
      </div>

      {/* Score */}
      <div className="bg-[#141920] border border-slate-800 rounded-2xl p-5 mb-3">
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            selected.status === 'live'      ? 'bg-red-500/20 text-red-400' :
            selected.status === 'half_time' ? 'bg-yellow-500/20 text-yellow-400' :
            selected.status === 'finished'  ? 'bg-green-500/20 text-green-400' :
                                              'bg-slate-700 text-slate-400'}`}>
            {selected.status === 'live' ? `🔴 ${liveMinute}'` : selected.status === 'half_time' ? '⏸ HT' : selected.status === 'finished' ? '✅ FT' : '⏳ Scheduled'}
          </span>
          <span className="text-xs text-slate-600">{halfDur}' halves{selected.round ? ` · ${selected.round}` : ''}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-center w-28"><div className="text-white font-bold text-sm">{selected.home_team_name}</div></div>
          <div className="text-5xl font-bold text-white tabular-nums">{selected.home_score}<span className="text-slate-600 mx-1">-</span>{selected.away_score}</div>
          <div className="text-center w-28"><div className="text-white font-bold text-sm">{selected.away_team_name}</div></div>
        </div>
      </div>

      {/* Added time prompt */}
      {showAddTime && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 mb-3">
          <p className="text-yellow-400 text-sm font-bold text-center mb-1">{(selected.current_half ?? 1) === 1 ? '⏸ Half Time' : '✅ Full Time'}</p>
          <p className="text-yellow-300 text-xs text-center mb-3">How many minutes of added time?</p>
          <div className="flex justify-center gap-2 mb-3">
            {[0,1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setAddTimeValue(n)}
                className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${addTimeValue === n ? 'bg-yellow-500 text-black scale-110' : 'bg-slate-800 text-white'}`}>
                +{n}
              </button>
            ))}
          </div>
          <button onClick={() => (selected.current_half ?? 1) === 1 ? confirmHalfTime(addTimeValue) : confirmFullTime(addTimeValue)}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl text-sm">
            Confirm +{addTimeValue} mins
          </button>
        </div>
      )}

      {/* Match controls */}
      <div className="bg-[#141920] border border-slate-800 rounded-2xl p-4 mb-3">
        <p className="text-xs text-slate-500 mb-2">Match Control</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: '▶ Kick Off',   fn: kickOff,                   dis: selected.status === 'live' && (selected.current_half ?? 1) === 1 },
            { label: '⏸ Half Time', fn: () => setShowAddTime(true), dis: selected.status !== 'live' || (selected.current_half ?? 1) !== 1 },
            { label: '▶ 2nd Half',  fn: secondHalf,                 dis: selected.status !== 'half_time' },
            { label: '✅ Full Time', fn: () => setShowAddTime(true), dis: selected.status !== 'live' || (selected.current_half ?? 1) !== 2 },
          ].map(({ label, fn, dis }) => (
            <button key={label} onClick={fn} disabled={dis}
              className={`py-3 rounded-xl text-xs font-medium border transition-all active:scale-95 disabled:opacity-40 ${!dis ? 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Goals */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <button onClick={() => setEventModal({ type: 'goal', teamId: selected.home_team_id })}
          className="bg-green-700 hover:bg-green-600 active:scale-95 text-white font-bold py-5 rounded-2xl">
          <div className="text-2xl mb-1">⚽</div><div className="text-sm">HOME GOAL</div>
          <div className="text-xs font-normal opacity-70">{selected.home_short ?? selected.home_team_name}</div>
        </button>
        <button onClick={() => setEventModal({ type: 'goal', teamId: selected.away_team_id })}
          className="bg-blue-700 hover:bg-blue-600 active:scale-95 text-white font-bold py-5 rounded-2xl">
          <div className="text-2xl mb-1">⚽</div><div className="text-sm">AWAY GOAL</div>
          <div className="text-xs font-normal opacity-70">{selected.away_short ?? selected.away_team_name}</div>
        </button>
      </div>
<<<<<<< HEAD

=======
      
>>>>>>> 2df330d6cce0c7061697819d577419783cc54bf9
      {/* Penalties */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label:'PEN ✓ Home', type:'penalty_goal',   teamId:selected.home_team_id, color:'bg-green-800' },
          { label:'PEN ✗ Home', type:'penalty_missed', teamId:selected.home_team_id, color:'bg-orange-800' },
          { label:'PEN ✓ Away', type:'penalty_goal',   teamId:selected.away_team_id, color:'bg-green-800' },
          { label:'PEN ✗ Away', type:'penalty_missed', teamId:selected.away_team_id, color:'bg-orange-800' },
        ].map(({ label, type, teamId, color }) => (
          <button key={label} onClick={() => setEventModal({ type, teamId })}
            className={`${color} hover:opacity-90 active:scale-95 text-white py-3 rounded-xl text-[11px] font-medium leading-tight`}>
            {label}
          </button>
        ))}
      </div>
<<<<<<< HEAD

=======
      
>>>>>>> 2df330d6cce0c7061697819d577419783cc54bf9
      {/* Cards + Subs */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[
          { label: '🟨 Home Yellow', type: 'yellow_card', teamId: selected.home_team_id, color: 'bg-yellow-800' },
          { label: '🟨 Away Yellow', type: 'yellow_card', teamId: selected.away_team_id, color: 'bg-yellow-800' },
          { label: '🟥 Home Red',    type: 'red_card',    teamId: selected.home_team_id, color: 'bg-red-900' },
          { label: '🟥 Away Red',    type: 'red_card',    teamId: selected.away_team_id, color: 'bg-red-900' },
          { label: '🔄 Home Sub',    type: 'substitution',teamId: selected.home_team_id, color: 'bg-slate-700' },
          { label: '🔄 Away Sub',    type: 'substitution',teamId: selected.away_team_id, color: 'bg-slate-700' },
        ].map(({ label, type, teamId, color }) => (
          <button key={label} onClick={() => setEventModal({ type, teamId })}
            className={`${color} hover:opacity-90 active:scale-95 text-white py-3 rounded-xl text-xs font-medium transition-all`}>
            {label}
          </button>
        ))}
      </div>

      {/* Recent events */}
      {(matchDetail?.events ?? []).length > 0 && (
        <div className="bg-[#141920] border border-slate-800 rounded-2xl p-3">
          <p className="text-xs text-slate-500 mb-2">Recent events</p>
          {[...(matchDetail.events)].reverse().slice(0,5).map((ev: any, i: number) => {
            const icon = ev.event_type === 'goal' || ev.event_type === 'penalty_goal' ? '⚽' : ev.event_type === 'penalty_missed' ? '❌' : ev.event_type === 'yellow_card' ? '🟨' : ev.event_type === 'red_card' ? '🟥' : ev.event_type === 'substitution' ? '🔄' : '•'
            const name = ev.display_name ?? (ev.first_name ? `${ev.first_name} ${ev.last_name}` : ev.team_name)
            return (
              <div key={`${ev.id}-${i}`} className="flex items-center gap-2 py-1.5 text-xs border-t border-slate-800/50 first:border-0">
                <span className="text-slate-500 w-8 flex-shrink-0">{ev.minute}'</span>
                <span>{icon}</span>
                <span className="text-slate-300 flex-1 truncate">{name}</span>
                <span className="text-slate-600 flex-shrink-0">{ev.team_short}</span>
              </div>
            )
          })}
        </div>
      )}

      {eventModal && (
        <EventModal
          type={eventModal.type}
          players={eventModal.teamId === selected.home_team_id ? homePlayers : awayPlayers}
          minute={liveMinute}
          onSubmit={(extra: any) => addEvent(eventModal.type, eventModal.teamId, extra)}
          onClose={() => setEventModal(null)}
        />
      )}
    </div>
  )
}

function EventModal({ type, players, minute, onSubmit, onClose }: any) {
  const [playerId, setPlayerId] = useState('')
  const [assistId, setAssistId] = useState('')
  const [subOutId, setSubOutId] = useState('')
  const starters   = players.filter((p: any) => p.is_starter)
  const bench      = players.filter((p: any) => !p.is_starter)
  const all        = [...starters, ...bench]

  const title = { goal: '⚽ Goal', own_goal: '⚽ Own Goal', yellow_card: '🟨 Yellow Card', red_card: '🟥 Red Card', yellow_red_card: '🟨🟥 2nd Yellow', substitution: '🔄 Substitution' }[type] ?? type

  const PlayerSelect = ({ value, onChange, label, pool }: any) => (
    <div>
      <label className="text-xs text-slate-400 block mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500">
        <option value="">Select player...</option>
        {starters.length > 0 && <optgroup label="Starting XI">
          {starters.map((p: any) => <option key={p.player_id} value={p.player_id}>{p.jersey_number ? `#${p.jersey_number} ` : ''}{p.display_name ?? `${p.first_name} ${p.last_name}`}{p.is_captain ? ' ©' : ''}</option>)}
        </optgroup>}
        {bench.length > 0 && <optgroup label="Bench">
          {bench.map((p: any) => <option key={p.player_id} value={p.player_id}>{p.jersey_number ? `#${p.jersey_number} ` : ''}{p.display_name ?? `${p.first_name} ${p.last_name}`}</option>)}
        </optgroup>}
      </select>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50 p-4">
      <div className="bg-[#141920] border border-slate-700 rounded-2xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold">{title} <span className="text-slate-500 text-xs font-normal">{minute}'</span></h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl leading-none">×</button>
        </div>
        {all.length === 0
          ? <p className="text-slate-500 text-sm text-center py-4">No lineup confirmed — recording without player</p>
          : <div className="space-y-3">
              <PlayerSelect value={playerId} onChange={setPlayerId} label={type === 'substitution' ? 'Player IN ↑' : 'Player'} />
              {type === 'goal' && <PlayerSelect value={assistId} onChange={setAssistId} label="Assist (optional)" />}
              {type === 'substitution' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Player OUT ↓</label>
                  <select value={subOutId} onChange={e => setSubOutId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500">
                    <option value="">Select player coming off...</option>
                    {starters.map((p: any) => <option key={p.player_id} value={p.player_id}>{p.jersey_number ? `#${p.jersey_number} ` : ''}{p.display_name ?? `${p.first_name} ${p.last_name}`}</option>)}
                  </select>
                </div>
              )}
            </div>
        }
        <button onClick={() => {
          const extra: any = {}
          if (playerId) extra.player_id = playerId
          if (assistId) extra.assist_player_id = assistId
          if (subOutId) extra.sub_player_out_id = subOutId
          onSubmit(extra)
        }} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl text-sm mt-4 active:scale-95">
          Confirm {title}
        </button>
      </div>
    </div>
  )
}
