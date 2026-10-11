import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BusinessTypePicker from './BusinessTypePicker'

// Add another business under the same login. The owner picks a name + type
// and sets a PIN for themselves inside the new business, then lands straight
// in it with the right menus for that kind of business.
export default function AddBusinessModal({ onClose }) {
  const { createBusiness } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!type) return setError('Pick the type of business.')
    if (!/^[0-9]{4}$/.test(pin)) return setError('PIN must be exactly 4 digits.')
    setBusy(true)
    try {
      await createBusiness({ name, type, pin })
      onClose()
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Could not create the business.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-paper-raised w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-lg sm:rounded-lg p-5 space-y-4"
      >
        <div>
          <h2 className="font-display text-lg font-semibold">Add another business</h2>
          <p className="text-sm text-muted">
            It runs under this same login. Each business keeps its own stock, sales, staff and reports.
          </p>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-muted mb-1 block">Business name</span>
          <input
            required
            autoFocus
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Glow Salon"
          />
        </label>

        <div>
          <span className="text-xs font-medium text-muted block">What kind of business is it?</span>
          <BusinessTypePicker value={type} onChange={setType} />
        </div>

        <label className="block">
          <span className="text-xs font-medium text-muted mb-1 block">Your 4-digit PIN for this business</span>
          <input
            required
            inputMode="numeric"
            maxLength={4}
            className="input font-mono w-32"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
            type="password"
          />
          <span className="text-xs text-muted mt-1 block">
            You can use the same PIN as your other business. You are added as the owner.
          </span>
        </label>

        {error && <p className="text-sm text-brick bg-brick-light rounded-md px-3 py-2">{error}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={busy || !name.trim() || !type} className="btn-primary flex-1">
            {busy ? 'Creating…' : 'Create business'}
          </button>
        </div>
      </form>
    </div>
  )
}
