'use client'
import { useState, useRef } from 'react'
import useSWR from 'swr'
import { apiFetch, type Player } from '@/lib/api'
import { Card } from '@/components/ui'
import { Plus, Camera, Trash2 } from 'lucide-react'

const API = 'https://matchday.koraforge.com.ng/api'
const fetcher = (url: string) => apiFetch(url)
const POSITIONS = ['goalkeeper','defender','midfielder','forward']
const POS_LABELS: Record<string,string> = { goalkeeper:'GK', defender:'DEF', midfielder:'MID', forward:'FWD' }

export function AdminPlayers({ token }: { token: string }) {
  const headers = { Authorization: `Bearer ${token}` }
  const { data, mutate }   = useSWR(`/players?limit=250`, fetcher)
  const { data: teamData } = useSWR(`/teams`, fetcher)
  const [show, setShow]    = useState(false)
  const [creating, setCreating]   = useState(false)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    first_name:'', last_name:'', display_name:'', position:'', jersey_number:'', team_id:'', date_of_birth:'',
  })

  async function createPlayer() {
    setCreating(true)
    try {
      await apiFetch(`/admin/players`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          jersey_number: form.jersey_number ? Number(form.jersey_number) : undefined,
          team_id:       form.team_id || undefined,
          display_name:  form.display_name || undefined,
          date_of_birth: form.date_of_birth || undefined,
          position:      form.position || undefined,
        }),
      })
      mutate(); setShow(false)
      setForm({ first_name:'', last_name:'', display_name:'', position:'', jersey_number:'', team_id:'', date_of_birth:'' })
    } catch (e: any) { alert(e.message) }
    finally { setCreating(false) }
  }

  async function deletePlayer(id: string, name: string) {
    if (!confirm(`Delete player "${name}"?`)) return
    try {
      await apiFetch(`/admin/players/${id}`, { method: 'DELETE', headers })
      mutate()
    } catch (e: any) { alert(e.message) }
  }

  async function uploadPhoto(playerId: string, file: File) {
    setUploadingFor(playerId)
    try {
      const fd = new FormData()
      fd.append('file', file); fd.append('entity_type', 'player')
      fd.append('entity_id', playerId); fd.append('field_name', 'photo_url')
      await fetch(`https://matchday.koraforge.com.ng/api/admin/upload`, { method: 'POST', headers, body: fd })
      mutate()
    } catch (e: any) { alert('Upload failed: ' + e.message) }
    finally { setUploadingFor(null) }
  }

  const players = data?.players ?? []
  const teams   = teamData?.teams ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Players</h2>
        <button onClick={() => setShow(!show)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={15} /> Add Player
        </button>
      </div>

      {show && (
        <Card className="p-5">
          <h3 className="text-sm font-medium text-white mb-4">Register Player</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label:'First Name *',  key:'first_name',    placeholder:'John' },
              { label:'Last Name *',   key:'last_name',     placeholder:'Doe' },
              { label:'Display Name',  key:'display_name',  placeholder:'Known as...' },
              { label:'Jersey Number', key:'jersey_number', placeholder:'10', type:'number' },
              { label:'Date of Birth', key:'date_of_birth', type:'date' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-slate-400 mb-1 block">{f.label}</label>
                <input type={(f as any).type ?? 'text'} value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={(f as any).placeholder}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
              </div>
            ))}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Position</label>
              <select value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500">
                <option value="">Select position</option>
                {POSITIONS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Assign to Team</label>
              <select value={form.team_id} onChange={e => setForm(p => ({ ...p, team_id: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500">
                <option value="">No team yet</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={createPlayer} disabled={creating || !form.first_name || !form.last_name}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
              {creating ? 'Registering...' : 'Register Player'}
            </button>
            <button onClick={() => setShow(false)} className="text-slate-400 hover:text-white px-4 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </Card>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file && activeUploadId) uploadPhoto(activeUploadId, file)
          e.target.value = ''
        }}
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                {['Photo','#','Player','Position','Team','DOB',''].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs text-slate-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {players.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No players yet</td></tr>}
              {players.map((p, i) => (
                <tr key={p.id} className="hover:bg-slate-800/30 group">
                  <td className="px-4 py-2.5">
                    <div className="relative w-9 h-9">
                      <div className="w-9 h-9 rounded-full bg-slate-700 overflow-hidden">
                        {p.photo_url
                          ? <img src={`https://matchday.koraforge.com.ng${p.photo_url}`} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-sm">
                              {(p.last_name || p.first_name || '?')[0].toUpperCase()}
                            </div>
                        }
                      </div>
                      <button onClick={() => { setActiveUploadId(p.id); fileInputRef.current?.click() }}
                        className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        {uploadingFor === p.id
                          ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <Camera size={12} className="text-white" />
                        }
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">{i+1}</td>
                  <td className="px-4 py-2.5 text-white font-medium">{p.display_name ?? `${p.first_name} ${p.last_name}`}</td>
                  <td className="px-4 py-2.5">
                    {p.position && <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono">{POS_LABELS[p.position] ?? p.position.toUpperCase()}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">{p.current_team ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{p.date_of_birth?.slice(0,10) ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => deletePlayer(p.id, p.display_name ?? `${p.first_name} ${p.last_name}`)}
                      className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete player">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
