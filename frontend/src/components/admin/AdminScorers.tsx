'use client'
import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import { Card } from '@/components/ui'
import { Plus, Copy, Check } from 'lucide-react'

const API = 'https://matchday.koraforge.com.ng/api'

export function AdminScorers({ token }: { token: string }) {
  const headers = { Authorization: `Bearer ${token}` }
  const [show, setShow]       = useState(false)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied]   = useState(false)
  const [created, setCreated] = useState<any>(null)
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })

  async function createScorer() {
    setCreating(true)
    try {
      const res = await apiFetch(`/admin/scorers`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setCreated({ ...res, password: form.password })
      setShow(false)
      setForm({ full_name: '', email: '', password: '' })
    } catch (e: any) { alert(e.message) }
    finally { setCreating(false) }
  }

  function copyCredentials() {
    navigator.clipboard.writeText(`Email: ${created.email}\nPassword: ${created.password}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Live Scorers</h2>
        <button onClick={() => setShow(!show)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={15} /> Add Scorer
        </button>
      </div>

      <Card className="p-5">
        <p className="text-sm text-slate-400 mb-3">
          Scorers can log in and enter live goals, cards and match updates from the field — even from their phone.
          They cannot access admin management features.
        </p>
        <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-400">
          📱 Scorer login URL: <span className="text-white font-mono">http://localhost:3000/scorer</span>
        </div>
      </Card>

      {show && (
        <Card className="p-5">
          <h3 className="text-sm font-medium text-white mb-4">Create Scorer Account</h3>
          <div className="space-y-3 max-w-sm">
            {[
              { label: 'Full Name *', key: 'full_name', placeholder: 'John Doe', type: 'text' },
              { label: 'Email *',     key: 'email',     placeholder: 'scorer@example.com', type: 'email' },
              { label: 'Password *',  key: 'password',  placeholder: 'Min 8 characters', type: 'password' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-slate-400 mb-1 block">{f.label}</label>
                <input type={f.type} value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={createScorer} disabled={creating || !form.full_name || !form.email || form.password.length < 8}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              {creating ? 'Creating...' : 'Create Scorer'}
            </button>
            <button onClick={() => setShow(false)} className="text-slate-400 hover:text-white px-4 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </Card>
      )}

      {created && (
        <Card className="p-5 border-green-500/30 bg-green-500/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-green-400">✓ Scorer account created!</span>
            <button onClick={copyCredentials}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy credentials'}
            </button>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 font-mono text-xs space-y-1">
            <div><span className="text-slate-500">Name: </span><span className="text-white">{created.full_name}</span></div>
            <div><span className="text-slate-500">Email: </span><span className="text-white">{created.email}</span></div>
            <div><span className="text-slate-500">Password: </span><span className="text-yellow-400">{created.password}</span></div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Share these credentials with your scorer. They can log in at the scorer URL above.</p>
        </Card>
      )}
    </div>
  )
}
