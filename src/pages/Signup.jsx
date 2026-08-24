import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import '../styles/auth-card.css'

const STEPS = ['Your business', 'Your account', 'Done']

const BUSINESS_TYPES = [
  { value: 'retail', label: '🛍 Retail shop' },
  { value: 'electronics', label: '📱 Electronics / Phones' },
  { value: 'supermarket', label: '🛒 Supermarket / Grocery' },
  { value: 'restaurant', label: '🍽 Restaurant / Cafe' },
  { value: 'barbershop', label: '💈 Barbershop / Salon' },
  { value: 'clothing', label: '👗 Clothing / Fashion' },
  { value: 'wholesale', label: '📦 Wholesale / Distributor' },
  { value: 'pharmacy', label: '💊 Pharmacy' },
  { value: 'hardware', label: '🔨 Hardware store' },
  { value: 'other', label: '🏪 Other' },
]

export default function Signup() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)

  // Step 0 — business info
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [ownerName, setOwnerName] = useState('')

  // Step 1 — account
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  async function handleCreateAccount(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) {
        if (signUpError.message?.toLowerCase().includes('already registered') || signUpError.status === 422) {
          throw new Error('This email is already registered. Sign in instead.')
        }
        throw signUpError
      }

      if (!data.session) {
        // Email confirmation required — business row can't be created yet
        // (RLS blocks it until the session exists). Show the confirmation step.
        setNeedsConfirmation(true)
        setStep(2)
        setBusy(false)
        return
      }

      // No email confirmation required — create the business immediately
      if (data.user) {
        const { error: bizError } = await supabase.from('businesses').insert({
          owner_auth_id: data.user.id,
          name: businessName,
          type: businessType,
          owner_name: ownerName || null,
        })
        if (bizError) throw bizError
      }
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-shell">
      {/* Header */}
      <div className="auth-brand">
        <button onClick={() => navigate('/')} className="auth-brand-name block">
          StockTracer
        </button>
        <p className="auth-brand-tagline">Create your free account</p>
      </div>

      {/* Progress */}
      {step < 2 && (
        <div className="w-full mb-6" style={{ maxWidth: '26rem' }}>
          <div className="flex items-center gap-2">
            {STEPS.slice(0, 2).map((label, i) => (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className={`auth-step-dot ${i < step ? 'auth-step-dot--done' : i === step ? 'auth-step-dot--active' : ''}`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`auth-step-label flex-1 ${i === step ? 'auth-step-label--active' : ''}`}>{label}</span>
                {i < 1 && <div className={`auth-step-rule ${i < step ? 'auth-step-rule--done' : ''}`} />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="auth-card">
        <div className="auth-card-inner">

          {/* STEP 0 — Business info */}
          {step === 0 && (
            <form onSubmit={(e) => { e.preventDefault(); setStep(1) }}>
              <h2 className="font-semibold mb-4">Tell us about your business</h2>

              <label className="auth-field">
                <span className="auth-field-label">Business name</span>
                <input
                  required
                  className="auth-input"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Fred's Shop"
                  autoFocus
                />
              </label>

              <label className="auth-field">
                <span className="auth-field-label">Your name (optional)</span>
                <input
                  className="auth-input"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Fred Ssaazi"
                />
              </label>

              <label className="auth-field">
                <span className="auth-field-label">Type of business</span>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {BUSINESS_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setBusinessType(t.value)}
                      className={`auth-chip ${businessType === t.value ? 'auth-chip--active' : ''}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </label>

              <button
                type="submit"
                disabled={!businessName || !businessType}
                className="auth-btn-primary mt-2"
              >
                Continue →
              </button>
            </form>
          )}

          {/* STEP 1 — Account */}
          {step === 1 && (
            <form onSubmit={handleCreateAccount}>
              <div className="mb-4">
                <h2 className="font-semibold">Create your account</h2>
                <p className="auth-muted text-xs mt-1">Setting up <strong>{businessName}</strong></p>
              </div>

              <label className="auth-field">
                <span className="auth-field-label">Email address</span>
                <input
                  required
                  type="email"
                  className="auth-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </label>

              <label className="auth-field">
                <span className="auth-field-label">Password</span>
                <div className="relative">
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    minLength={6}
                    className="auth-input pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="auth-toggle-visibility"
                  >
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
              </label>

              {error && <p className="auth-error mb-4">{error}</p>}

              <button type="submit" disabled={busy} className="auth-btn-primary">
                {busy ? 'Creating your account…' : 'Create account & start free trial'}
              </button>

              <button type="button" onClick={() => setStep(0)} className="auth-muted w-full text-xs text-center mt-3 hover:underline">
                ← Back
              </button>
            </form>
          )}

          {/* STEP 2 — Done */}
          {step === 2 && (
            <div className="text-center">
              {needsConfirmation ? (
                <>
                  <div className="text-4xl mb-3">📧</div>
                  <h2 className="font-semibold text-lg mb-2">Check your email</h2>
                  <p className="auth-muted text-sm">
                    We sent a confirmation link to <strong style={{ color: '#E7EDE9' }}>{email}</strong>. Click it to verify your account, then come back and sign in.
                  </p>
                  <p className="auth-muted text-xs mt-3">
                    Your business <strong style={{ color: '#E7EDE9' }}>{businessName}</strong> will be set up automatically when you sign in for the first time.
                  </p>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-3">🎉</div>
                  <h2 className="font-semibold text-lg mb-2">You're all set!</h2>
                  <p className="auth-muted text-sm">
                    <strong style={{ color: '#E7EDE9' }}>{businessName}</strong> is ready. Start by adding your products and staff.
                  </p>
                </>
              )}

              <button onClick={() => navigate('/login')} className="auth-btn-primary mt-5">
                Go to sign in →
              </button>
            </div>
          )}

          <p className="auth-muted text-xs text-center mt-5">
            Already have an account?{' '}
            <Link to="/login" className="auth-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
