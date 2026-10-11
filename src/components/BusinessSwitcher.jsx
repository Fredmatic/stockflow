import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getProfile } from '../lib/businessTypes'
import AddBusinessModal from './AddBusinessModal'

// Shows the current business and — for the owner — lets them jump to another
// one or add a new one. Cashiers/staff only see a plain name (they work in one
// business; switching is an owner decision).
export default function BusinessSwitcher({ compact = false }) {
  const { business, businesses, activeStaff, switchBusiness } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)

  const profile = getProfile(business)
  const canSwitch = activeStaff?.role === 'owner'

  const label = (
    <div className="min-w-0 text-left">
      <div className={`font-display font-semibold text-brand-dark truncate ${compact ? 'text-sm' : ''}`}>
        {profile.icon} {business?.name}
      </div>
      <div className="text-xs text-muted truncate">{profile.label}</div>
    </div>
  )

  if (!canSwitch) return <div className="min-w-0">{label}</div>

  function pick(id) {
    setOpen(false)
    if (id !== business?.id) {
      switchBusiness(id)
      navigate('/dashboard')
    }
  }

  return (
    <div className="relative min-w-0">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 w-full min-w-0 text-left">
        {label}
        <span className="text-muted text-xs shrink-0">{businesses.length > 1 ? `▾ ${businesses.length}` : '▾'}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 w-64 bg-paper-raised border border-line rounded-md shadow-lg z-30 py-1">
            {businesses.map((b) => {
              const p = getProfile(b)
              const active = b.id === business?.id
              return (
                <button
                  key={b.id}
                  onClick={() => pick(b.id)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-paper ${active ? 'bg-brand-light' : ''}`}
                >
                  <span className="text-lg">{p.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">{b.name}</span>
                    <span className="block text-xs text-muted truncate">{p.label}</span>
                  </span>
                  {active && <span className="text-brand-dark text-sm">✓</span>}
                </button>
              )
            })}
            <div className="border-t border-line mt-1 pt-1">
              <button
                onClick={() => { setOpen(false); setAdding(true) }}
                className="w-full text-left px-3 py-2 text-sm text-brand-dark font-medium hover:bg-paper"
              >
                ＋ Add another business
              </button>
              <Link
                to="/businesses"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm text-muted hover:bg-paper"
              >
                All businesses overview →
              </Link>
            </div>
          </div>
        </>
      )}

      {adding && <AddBusinessModal onClose={() => setAdding(false)} />}
    </div>
  )
}
