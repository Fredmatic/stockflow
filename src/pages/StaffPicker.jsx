import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function StaffPicker() {
  const { business, activeStaff, chooseStaff } = useAuth()
  const [staffList, setStaffList] = useState([])
  const [selected, setSelected] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!business) return
    supabase
      .from('staff_users')
      .select('*')
      .eq('business_id', business.id)
      .then(({ data }) => setStaffList(data || []))
  }, [business, activeStaff])

  function handleDigit(d) {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    setError('')
    if (next.length === 4) {
      if (next === selected.pin) {
        chooseStaff(selected)
      } else {
        setError('Wrong PIN, try again.')
        setTimeout(() => setPin(''), 400)
      }
    }
  }

  if (!selected) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="font-display text-xl font-semibold mb-1">Who's working?</div>
          <p className="text-muted text-sm mb-6">Pick your name to start</p>
          <div className="space-y-2">
            {staffList.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className="card w-full text-left px-4 py-3 flex items-center justify-between hover:border-brand"
              >
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-muted uppercase tracking-wide">{s.role}</span>
              </button>
            ))}
            {staffList.length === 0 && (
              <div className="text-sm text-muted">
                <p className="mb-3">No staff added yet.</p>
                <Link to="/staff" className="btn-primary inline-block">
                  Add your team
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-xs text-center">
        <button onClick={() => { setSelected(null); setPin('') }} className="text-sm text-muted mb-4">
          ← Back
        </button>
        <div className="font-display text-xl font-semibold mb-1">Hi, {selected.name}</div>
        <p className="text-muted text-sm mb-6">Enter your 4-digit PIN</p>

        <div className="flex justify-center gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-10 h-12 rounded-md border border-line flex items-center justify-center font-mono text-lg"
            >
              {pin[i] ? '•' : ''}
            </div>
          ))}
        </div>

        {error && <p className="text-brick text-sm mb-4">{error}</p>}

        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} onClick={() => handleDigit(String(n))} className="btn-secondary py-3 font-mono text-lg">
              {n}
            </button>
          ))}
          <div />
          <button onClick={() => handleDigit('0')} className="btn-secondary py-3 font-mono text-lg">
            0
          </button>
          <button onClick={() => setPin(pin.slice(0, -1))} className="btn-secondary py-3 text-sm">
            ⌫
          </button>
        </div>
      </div>
    </div>
  )
}