'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { apiFetch } from '@/lib/api'
import { Card } from '@/components/ui'
import { Plus, Trophy, Pencil, Trash2, X, Check } from 'lucide-react'

const API = 'https://matchday.koraforge.com.ng/api'
const fetcher = (url: string) => apiFetch(url)

const TEAM_SIZES   = [{ value: 5, label: '5-a-side (10 min halves)' }, { value: 7, label: '7-a-side (20-25 min halves)' }, { value: 11, label: '11-a-side (45 min halves)' }]
const DEFAULT_HALF: Record<number, number> = { 5: 10, 7: 20, 11: 45 }
const BRACKET_TYPES = [
  { value: 'league',         label: 'League (Round Robin)' },
  { value: 'cup',            label: 'Cup (Knockout)' },
  { value: 'group_knockout', label: 'Group Stage + Knockout' },
  { value: 'league_cup',     label: 'League + Cup' },
]

const emptyForm = () => ({
  name: '', short_name: '', format: 'league', bracket_type: 'league',
  team_size: 11, half_duration: 45, has_extra_time: true, has_penalties: true, is_local: true,
})

export function AdminCompetitions({ token }: { token: string }) {
  const headers = { Authorization: `Bearer ${token}` }
  const { data, mutate } = useSWR(`/competitions`, fetcher)
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId]         = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const [form, setForm]             = useState(emptyForm())

  function setTeamSize(size: number) {
    setForm(f => ({ ...f, team_size: size, half_duration: DEFAULT_HALF[size] ?? 45 }))
  }

  function startEdit(c: any) {
    setEditId(c.id)
    setShowCreate(false)
    setForm({
      name: c.name, short_name: c.short_name ?? '', format: c.format,
      bracket_type: c.bracket_type ?? 'league', team_size: c.team_size ?? 11,
      half_duration: c.half_duration ?? 45, has_extra_time: c.has_extra_time ?? true,
      has_penalties: c.has_penalties ?? true, is_local: c.is_local ?? false,
    })
  }

  async function save() {
    setSaving(true)
    try {
      if (editId) {
        await apiFetch(`/admin/competitions/${editId}`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        setEditId(null)
      } else {
        await apiFetch(`/admin/competitions`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        setShowCreate(false)
      }
      setForm(emptyForm())
      mutate()
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function deleteComp(id: string, name: string) {
    if (!confirm(`Delete "${name}" and ALL its matches, fixtures and standings? This cannot be undone.`)) return
    try {
      await apiFetch(`/admin/competitions/${id}`, { method: 'DELETE', headers })
      mutate()
    } catch (e: any) { alert(e.message) }
  }

  const competitions = data?.competitions ?? []

  const CompForm = () => (
    <Card className="p-5">
      <h3 className="text-sm font-medium text-white mb-4">{editId ? 'Edit Competition' : 'New Competition'}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Competition Name *</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Saturday's Baller Cup 2026"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Short Name</label>
          <input value={form.short_name} onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))}
            placeholder="e.g. SBC26"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Team Format</label>
          <select value={form.team_size} onChange={e => setTeamSize(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500">
            {TEAM_SIZES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Half Duration (minutes)</label>
          <input type="number" min={5} max={60} value={form.half_duration}
            onChange={e => setForm(f => ({ ...f, half_duration: Number(e.target.value) }))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
          <p className="text-xs text-slate-600 mt-0.5">Full match = {form.half_duration * 2} mins</p>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Competition Format</label>
          <select value={form.bracket_type} onChange={e => setForm(f => ({ ...f, bracket_type: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500">
            {BRACKET_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>
        <div className="space-y-2 pt-4">
          {[
            { key: 'has_extra_time', label: 'Allow Extra Time' },
            { key: 'has_penalties',  label: 'Allow Penalties' },
            { key: 'is_local',       label: '★ Local Competition' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={(form as any)[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} className="rounded" />
              <span className="text-sm text-slate-300">{label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={save} disabled={saving || !form.name}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Check size={14} /> {saving ? 'Saving...' : editId ? 'Save Changes' : 'Create Competition'}
        </button>
        <button onClick={() => { setShowCreate(false); setEditId(null); setForm(emptyForm()) }}
          className="text-slate-400 hover:text-white px-4 py-2 rounded-lg text-sm">Cancel</button>
      </div>
    </Card>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Competitions</h2>
        <button onClick={() => { setShowCreate(!showCreate); setEditId(null); setForm(emptyForm()) }}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={15} /> New Competition
        </button>
      </div>

      {(showCreate || editId) && <CompForm />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {competitions.length === 0 && (
          <Card className="col-span-2 p-10 text-center text-slate-500 text-sm">No competitions yet</Card>
        )}
        {competitions.map((c: any) => (
          <Card key={c.id} className={`p-4 ${editId === c.id ? 'border-green-500/40' : ''}`}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                <Trophy size={18} className="text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white truncate">{c.name}</div>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span>{c.team_size ?? 11}-a-side</span>
                  <span>·</span>
                  <span>{c.half_duration ?? 45}' halves</span>
                  <span>·</span>
                  <span className="capitalize">{(c.bracket_type ?? c.format)?.replace('_',' ')}</span>
                  {c.is_local && <span className="text-green-400">★ Local</span>}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => startEdit(c)}
                  className="p-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors" title="Edit">
                  <Pencil size={13} />
                </button>
                <button onClick={() => deleteComp(c.id, c.name)}
                  className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors" title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
