import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { hashPin } from '../lib/pinHash'

export default function Staff() {
  const { business, activeStaff } = useAuth()
  const [staffList, setStaffList] = useState([])
  const [name, setName] = useState('')
  const [role, setRole] = useState('cashier')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editPin, setEditPin] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState('')

  const isOwner = activeStaff?.role === 'owner'

  useEffect(() => {
    if (business) load()
  }, [business])

  async function load() {
    const { data } = await supabase
      .from('staff_users')
      .select('*')
      .eq('business_id', business.id)
      .order('created_at')
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
    try {
      // Generate the id on the device so we can hash the PIN with it as
      // salt before the row is ever written — no placeholder pin needed.
      const id = crypto.randomUUID()
      const hashed = await hashPin(pin, id)
      const { error: insertErr } = await supabase
        .from('staff_users')
        .insert({ id, business_id: business.id, name, role, pin: hashed })
      if (insertErr) throw insertErr

      setName(''); setPin('')
      load()
    } catch (err) {
      setError(err.message.includes('duplicate') ? 'That PIN is already used by someone on your team.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(id) {
    if (!confirm('Remove this staff member?')) return
    await supabase.from('staff_users').delete().eq('id', id)
    load()
  }

  async function handleChangePin(staff) {
    setEditError('')
    if (!/^[0-9]{4}$/.test(editPin)) {
      setEditError('PIN must be exactly 4 digits.')
      return
    }
    setEditBusy(true)
    try {
      const hashed = await hashPin(editPin, staff.id)
      const { error: err } = await supabase
        .from('staff_users')
        .update({ pin: hashed, pin_reset_required: false })
        .eq('id', staff.id)
      if (err) throw err
      setEditingId(null); setEditPin('')
      load()
    } catch (err) {
      setEditError(err.message)
    } finally {
      setEditBusy(false)
    }
  }

  async function forceReset(staff) {
    if (!confirm(`Force ${staff.name} to set a new PIN next time they log in?`)) return
    await supabase
      .from('staff_users')
      .update({ pin_reset_required: true })
      .eq('id', staff.id)
    load()
  }

  if (!business) return (
    <div className="min-h-screen flex items-center justify-center text-muted text-sm">
      Loading business…
    </div>
  )

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Staff</h1>
        <p className="text-muted text-sm">
          Add the people who'll use this device — each picks their name and PIN when they start working.
        </p>
      </div>

      {/* Add staff form */}
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
            placeholder="e.g. 1234"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          />
        </label>
        {error && <p className="text-brick text-sm">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? 'Adding…' : 'Add to team'}
        </button>
      </form>

      {/* Staff list */}
      <div className="card divide-y divide-line">
        {staffList.map((s) => (
          <div key={s.id} className="px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">{s.name}</div>
                  {s.pin_reset_required && (
                    <span className="text-xs bg-amber-500/10 text-amber-700 px-2 py-0.5 rounded-full">
                      PIN reset pending
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted uppercase tracking-wide">{s.role}</div>
              </div>
              <div className="flex items-center gap-3">
                {isOwner && (
                  <>
                    <button
                      onClick={() => { setEditingId(editingId === s.id ? null : s.id); setEditPin(''); setEditError('') }}
                      className="text-xs text-brand-dark font-medium"
                    >
                      {editingId === s.id ? 'Cancel' : 'Change PIN'}
                    </button>
                    {!s.pin_reset_required && (
                      <button onClick={() => forceReset(s)} className="text-xs text-amber-700 font-medium">
                        Force reset
                      </button>
                    )}
                  </>
                )}
                <button onClick={() => handleRemove(s.id)} className="text-xs text-brick">
                  Remove
                </button>
              </div>
            </div>

            {/* Change PIN inline form */}
            {editingId === s.id && (
              <div className="flex gap-2 pt-1">
                <input
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  className="input font-mono w-32"
                  placeholder="New PIN"
                  value={editPin}
                  onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ''))}
                />
                <button
                  type="button"
                  onClick={() => handleChangePin(s)}
                  disabled={editBusy || editPin.length !== 4}
                  className="btn-primary px-4 text-sm"
                >
                  {editBusy ? '…' : 'Save'}
                </button>
              </div>
            )}
            {editingId === s.id && editError && (
              <p className="text-brick text-xs">{editError}</p>
            )}
          </div>
        ))}
        {staffList.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted text-center">No team members yet.</p>
        )}
      </div>

      {staffList.length > 0 && (
        <Link to="/" className="btn-primary w-full block text-center">
          {activeStaff ? 'Done — back to dashboard' : 'Done — continue to sign in'}
        </Link>
      )}
    </div>
  )
}