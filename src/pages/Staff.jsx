import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Staff() {
  const { business, activeStaff } = useAuth()
  const [staffList, setStaffList] = useState([])
  const [name, setName] = useState('')
  const [role, setRole] = useState('cashier')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (business) load()
  }, [business])

  async function load() {
    const { data } = await supabase.from('staff_users').select('*').eq('business_id', business.id).order('created_at')
    setStaffList(data || [])
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!/^[0-9]{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits.')
      return
    }
    setBusy(true)
    const { error } = await supabase.from('staff_users').insert({
      business_id: business.id,
      name,
      role,
      pin,
    })
    if (error) {
      setError(error.message.includes('duplicate') ? 'That PIN is already used by someone else on your team.' : error.message)
    } else {
      setName('')
      setPin('')
      load()
    }
    setBusy(false)
  }

  async function handleRemove(id) {
    await supabase.from('staff_users').delete().eq('id', id)
    load()
  }

  if (!business) return <div className="min-h-screen flex items-center justify-center text-muted text-sm">Loading business…</div>

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Staff</h1>
        <p className="text-muted text-sm">Add the people who'll use this device — each picks their name and PIN when they start working.</p>
      </div>

      <form onSubmit={handleAdd} className="card p-4 space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-muted mb-1 block">Name</span>
          <input required className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted mb-1 block">Role</span>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="cashier">Cashier</option>
            <option value="staff">Staff</option>
            <option value="owner">Owner</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted mb-1 block">4-digit PIN</span>
          <input
            required
            className="input font-mono"
            maxLength={4}
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          />
        </label>
        {error && <p className="text-brick text-sm">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? 'Adding…' : 'Add to team'}</button>
      </form>

      <div className="card divide-y divide-line">
        {staffList.map((s) => (
          <div key={s.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm font-medium">{s.name}</div>
              <div className="text-xs text-muted uppercase tracking-wide">{s.role}</div>
            </div>
            <button onClick={() => handleRemove(s.id)} className="text-xs text-brick">Remove</button>
          </div>
        ))}
        {staffList.length === 0 && <p className="px-4 py-6 text-sm text-muted text-center">No team members yet.</p>}
      </div>

      {staffList.length > 0 && (
        <Link to="/" className="btn-primary w-full block text-center">
          {activeStaff ? 'Done — back to dashboard' : 'Done — continue to sign in'}
        </Link>
      )}
    </div>
  )
}
