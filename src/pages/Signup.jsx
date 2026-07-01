import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Header */}
      <div className="text-center mb-8">
        <button onClick={() => navigate('/')} className="font-display text-2xl font-semibold text-brand-dark mb-1 block">
          StockTracer
        </button>
        <p className="text-muted text-sm">Create your free account</p>
      </div>

      {/* Progress */}
      {step < 2 && (
        <div className="w-full max-w-sm mb-6">
          <div className="flex items-center gap-2">
            {STEPS.slice(0, 2).map((label, i) => (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center flex-shrink-0 ${i < step ? 'bg-brand-dark text-white' : i === step ? 'bg-brand text-white' : 'bg-line text-muted'
                  }`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`text-xs flex-1 ${i === step ? 'text-ink font-medium' : 'text-muted'}`}>{label}</span>
                {i < 1 && <div className={`h-px flex-1 ${i < step ? 'bg-brand-dark' : 'bg-line'}`} />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="w-full max-w-sm">

        {/* STEP 0 — Business info */}
        {step === 0 && (
          <form
            onSubmit={(e) => { e.preventDefault(); setStep(1) }}
            className="bg-paper-raised border border-line rounded-lg p-6 space-y-4"
          >
            <h2 className="font-display font-semibold">Tell us about your business</h2>

            <Field label="Business name">
              <input
                required
                className="input"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Fred's Shop"
                autoFocus
              />
            </Field>

            <Field label="Your name (optional)">
              <input
                className="input"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Fred Ssaazi"
              />
            </Field>

            <Field label="Type of business">
              <div className="grid grid-cols-2 gap-2 mt-1">
                {BUSINESS_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setBusinessType(t.value)}
                    className={`text-left text-xs px-3 py-2 rounded-md border transition-colors ${businessType === t.value
                      ? 'border-brand bg-brand-light text-brand-dark font-medium'
                      : 'border-line text-muted hover:border-brand-light'
                      }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </Field>

            <button
              type="submit"
              disabled={!businessName || !businessType}
              className="btn-primary w-full py-3"
            >
              Continue →
            </button>
          </form>
        )}

        {/* STEP 1 — Account */}
        {step === 1 && (
          <form onSubmit={handleCreateAccount} className="bg-paper-raised border border-line rounded-lg p-6 space-y-4">
            <div>
              <h2 className="font-display font-semibold">Create your account</h2>
              <p className="text-xs text-muted mt-1">Setting up <strong>{businessName}</strong></p>
            </div>

            <Field label="Email address">
              <input
                required
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </Field>

            <Field label="Password">
              <div className="relative">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  minLength={6}
                  className="input pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-muted hover:text-ink"
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </Field>

            {error && <p className="text-brick text-sm">{error}</p>}

            <button type="submit" disabled={busy} className="btn-primary w-full py-3">
              {busy ? 'Creating your account…' : 'Create account & start free trial'}
            </button>

            <button type="button" onClick={() => setStep(0)} className="w-full text-xs text-muted text-center hover:text-ink">
              ← Back
            </button>
          </form>
        )}

        {/* STEP 2 — Done */}
        {step === 2 && (
          <div className="bg-paper-raised border border-line rounded-lg p-8 text-center space-y-4">
            {needsConfirmation ? (
              <>
                <div className="text-4xl">📧</div>
                <h2 className="font-display font-semibold text-lg">Check your email</h2>
                <p className="text-sm text-muted">
                  We sent a confirmation link to <strong>{email}</strong>. Click it to verify your account, then come back and sign in.
                </p>
                <p className="text-xs text-muted">
                  Your business <strong>{businessName}</strong> will be set up automatically when you sign in for the first time.
                </p>
              </>
            ) : (
              <>
                <div className="text-4xl">🎉</div>
                <h2 className="font-display font-semibold text-lg">You're all set!</h2>
                <p className="text-sm text-muted">
                  <strong>{businessName}</strong> is ready. Start by adding your products and staff.
                </p>
              </>
            )}

            <button onClick={() => navigate('/login')} className="btn-primary w-full py-3 mt-2">
              Go to sign in →
            </button>
          </div>
        )}

        <p className="text-xs text-muted text-center mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-dark font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted mb-1 block">{label}</span>
      {children}
    </label>
  )
}
