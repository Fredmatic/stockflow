import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { hashPin, isHashed } from '../lib/pinHash'

export default function StaffPicker() {
  const { business, activeStaff, chooseStaff } = useAuth()
  const [staffList, setStaffList] = useState([])
  const [selected, setSelected] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  // PIN reset flow
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [resetStep, setResetStep] = useState(1) // 1 = new pin, 2 = confirm
  const [resetBusy, setResetBusy] = useState(false)
  const [resetError, setResetError] = useState('')

  useEffect(() => {
    if (!business) return
    supabase
      .from('staff_users')
      .select('*')
      .eq('business_id', business.id)
      .then(({ data }) => setStaffList(data || []))
  }, [business, activeStaff])

  async function handleDigit(d) {
    if (pin.length >= 4 || checking) return
    const next = pin + d
    setPin(next)
    setError('')

    if (next.length === 4) {
      setChecking(true)
      try {
        let match = false

        if (isHashed(selected.pin)) {
          // Normal case — compare hash
          const hashed = await hashPin(next, selected.id)
          match = hashed === selected.pin
        } else {
          // Legacy plain text PIN — compare directly then migrate
          match = next === selected.pin
          if (match) {
            // Silently upgrade to hashed in background
            const hashed = await hashPin(next, selected.id)
            supabase.from('staff_users').update({ pin: hashed }).eq('id', selected.id)
              .then(() => { })
          }
        }

        if (match) {
          chooseStaff(selected)
        } else {
          setError('Wrong PIN, try again.')
          setTimeout(() => { setPin(''); setChecking(false) }, 400)
          return
        }
      } catch {
        setError('Something went wrong. Try again.')
        setTimeout(() => { setPin(''); setChecking(false) }, 400)
        return
      }
      setChecking(false)
    }
  }

  async function saveNewPin() {
    setResetError('')
    if (!/^[0-9]{4}$/.test(newPin)) { setResetError('PIN must be exactly 4 digits.'); return }
    if (newPin !== confirmPin) { setResetError('PINs do not match.'); return }
    setResetBusy(true)
    try {
      const hashed = await hashPin(newPin, selected.id)
      const { error: err } = await supabase
        .from('staff_users')
        .update({ pin: hashed, pin_reset_required: false })
        .eq('id', selected.id)
      if (err) throw err
      // Update local list
      const updated = { ...selected, pin: hashed, pin_reset_required: false }
      setStaffList(l => l.map(s => s.id === selected.id ? updated : s))
      chooseStaff(updated)
    } catch (err) {
      setResetError(err.message)
    } finally {
      setResetBusy(false)
    }
  }

  function handleResetDigit(d, target, setTarget, onComplete) {
    if (target.length >= 4) return
    const next = target + d
    setTarget(next)
    if (next.length === 4) onComplete(next)
  }

  // ── Staff list ─────────────────────────────────────────────────────────
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
                onClick={() => { setSelected(s); setPin(''); setError('') }}
                className="card w-full text-left px-4 py-3 flex items-center justify-between hover:border-brand"
              >
                <span className="font-medium">{s.name}</span>
                <div className="flex items-center gap-2">
                  {s.pin_reset_required && (
                    <span className="text-xs bg-amber-500/10 text-amber-700 px-2 py-0.5 rounded-full">
                      New PIN needed
                    </span>
                  )}
                  <span className="text-xs text-muted uppercase tracking-wide">{s.role}</span>
                </div>
              </button>
            ))}
            {staffList.length === 0 && (
              <div className="text-sm text-muted">
                <p className="mb-3">No staff added yet.</p>
                <Link to="/staff" className="btn-primary inline-block">Add your team</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── PIN reset flow ──────────────────────────────────────────────────────
  if (selected.pin_reset_required) {
    const isConfirmStep = resetStep === 2
    const currentPin = isConfirmStep ? confirmPin : newPin
    const setCurrentPin = isConfirmStep ? setConfirmPin : setNewPin

    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-xs text-center">
          <button onClick={() => { setSelected(null); setNewPin(''); setConfirmPin(''); setResetStep(1) }}
            className="text-sm text-muted mb-4">← Back</button>
          <div className="font-display text-xl font-semibold mb-1">Set your new PIN</div>
          <p className="text-muted text-sm mb-6">
            {isConfirmStep ? 'Confirm your new PIN' : `Hi ${selected.name} — your PIN has been reset. Create a new one.`}
          </p>

          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}
                className="w-10 h-12 rounded-md border border-line flex items-center justify-center font-mono text-lg">
                {currentPin[i] ? '•' : ''}
              </div>
            ))}
          </div>

          {resetError && <p className="text-brick text-sm mb-4">{resetError}</p>}

          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button key={n} onClick={() => handleResetDigit(String(n), currentPin, setCurrentPin, (val) => {
                if (!isConfirmStep) { setResetStep(2) }
                else { saveNewPin() }
              })} className="btn-secondary py-3 font-mono text-lg">{n}</button>
            ))}
            <div />
            <button onClick={() => handleResetDigit('0', currentPin, setCurrentPin, (val) => {
              if (!isConfirmStep) setResetStep(2)
              else saveNewPin()
            })} className="btn-secondary py-3 font-mono text-lg">0</button>
            <button onClick={() => setCurrentPin(currentPin.slice(0, -1))} className="btn-secondary py-3 text-sm">⌫</button>
          </div>

          {resetBusy && <p className="text-muted text-sm mt-4">Saving…</p>}
        </div>
      </div>
    )
  }

  // ── Normal PIN entry ────────────────────────────────────────────────────
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
            <div key={i}
              className="w-10 h-12 rounded-md border border-line flex items-center justify-center font-mono text-lg">
              {pin[i] ? '•' : ''}
            </div>
          ))}
        </div>

        {error && <p className="text-brick text-sm mb-4">{error}</p>}
        {checking && <p className="text-muted text-sm mb-4">Checking…</p>}

        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} onClick={() => handleDigit(String(n))} className="btn-secondary py-3 font-mono text-lg">
              {n}
            </button>
          ))}
          <div />
          <button onClick={() => handleDigit('0')} className="btn-secondary py-3 font-mono text-lg">0</button>
          <button onClick={() => setPin(pin.slice(0, -1))} className="btn-secondary py-3 text-sm">⌫</button>
        </div>
      </div>
    </div>
  )
}