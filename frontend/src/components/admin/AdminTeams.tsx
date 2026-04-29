'use client'
import { useState, useRef } from 'react'
import useSWR from 'swr'
import { apiFetch } from '@/lib/api'
import { Card } from '@/components/ui'
import { Plus, Camera, Trash2 } from 'lucide-react'

const API = 'https://matchday.koraforge.com.ng/api'
const fetcher = (url: string) => apiFetch(url)

export function AdminTeams({ token }: { token: string }) {
  const headers = { Authorization: `Bearer ${token}` }
  const { data, mutate }    = useSWR(`/teams`, fetcher)
  const [show, setShow]     = useState(false)
  const [creating, setCreating]   = useState(false)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    name: '', short_name: '', home_stadium: '', primary_color: '#3b82f6', coach_name: '', is_local: true,
  })

  async function createTeam() {
    setCreating(true)
    try {
      await apiFetch(`/admin/teams`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      mutate(); setShow(false)
      setForm({ name: '', short_name: '', home_stadium: '', primary_color: '#3b82f6', coach_name: '', is_local: true })
    } catch (e: any) { alert(e.message) }
    finally { setCreating(false) }
  }

  async function deleteTeam(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This will remove them from all competitions.`)) return
    try {
      await apiFetch(`/admin/teams/${id}`, { method: 'DELETE', headers })
      mutate()
    } catch (e: any) { alert(e.message) }
  }

  async function uploadLogo(teamId: string, file: File) {
    setUploadingFor(teamId)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('entity_type', 'team')
      fd.append('entity_id', teamId)
      fd.append('field_name', 'logo_url')
      await fetch(`https://matchday.koraforge.com.ng/api/admin/upload`, { method: 'POST', headers, body: fd })
      mutate()
    } catch (e: any) { alert('Upload failed: ' + e.message) }
    finally { setUploadingFor(null) }
  }

  const teams = data?.teams ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Teams</h2>
        <button onClick={() => setShow(!show)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={15} /> Add Team
        </button>
      </div>

      {show && (
        <Card className="p-5">
          <h3 className="text-sm font-medium text-white mb-4">New Team</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Team Name *',  key: 'name',         placeholder: 'e.g. Lagos United FC' },
              { label: 'Short Name',   key: 'short_name',   placeholder: 'e.g. LAG' },
              { label: 'Home Stadium', key: 'home_stadium', placeholder: 'Stadium name' },
              { label: 'Head Coach',   key: 'coach_name',   placeholder: 'Coach name' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-slate-400 mb-1 block">{f.label}</label>
                <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
              </div>
            ))}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Team Colour</label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.primary_color}
                  onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))}
                  className="w-12 h-10 rounded-lg cursor-pointer bg-transparent border border-slate-700" />
                <span className="text-sm text-slate-400 font-mono">{form.primary_color}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="is_local" checked={form.is_local}
                onChange={e => setForm(p => ({ ...p, is_local: e.target.checked }))} className="rounded" />
              <label htmlFor="is_local" className="text-sm text-slate-300">Local competition team</label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={createTeam} disabled={creating || !form.name}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
              {creating ? 'Creating...' : 'Create Team'}
            </button>
            <button onClick={() => setShow(false)} className="text-slate-400 hover:text-white px-4 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </Card>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file && activeUploadId) uploadLogo(activeUploadId, file)
          e.target.value = ''
        }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {teams.length === 0 && <Card className="col-span-3 p-10 text-center text-slate-500 text-sm">No teams yet</Card>}
        {teams.map((t: any) => (
          <Card key={t.id} className="p-4 group">
            <div className="flex items-center gap-3">
              {/* Logo with upload */}
              <div className="relative w-14 h-14 flex-shrink-0">
                <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-700"
                  style={{ background: t.logo_url ? 'transparent' : (t.primary_color ?? '#334155') }}>
                  {t.logo_url
                    ? <img src={`https://matchday.koraforge.com.ng${t.logo_url}`} alt={t.name} className="w-full h-full object-contain p-1" />
                    : <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                        {(t.short_name ?? t.name).slice(0,2).toUpperCase()}
                      </div>
                  }
                </div>
                <button onClick={() => { setActiveUploadId(t.id); fileInputRef.current?.click() }}
                  className="absolute inset-0 rounded-xl bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  {uploadingFor === t.id
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><Camera size={14} className="text-white" /><span className="text-white text-xs mt-0.5">Logo</span></>
                  }
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white truncate">{t.name}</div>
                {t.short_name && <div className="text-xs text-slate-500 font-mono">{t.short_name}</div>}
                <div className="text-xs text-slate-500 mt-0.5">
                  {t.coach_name && <span>👤 {t.coach_name}</span>}
                  {t.is_local && <span className="ml-1.5 text-green-400">★ Local</span>}
                </div>
              </div>
              {/* Delete button */}
              <button onClick={() => deleteTeam(t.id, t.name)}
                className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                title="Delete team">
                <Trash2 size={14} />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
