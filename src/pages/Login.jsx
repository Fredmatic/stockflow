import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('retail')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) {
          if (error.status === 422 || error.message?.toLowerCase().includes('already registered') || error.message?.toLowerCase().includes('user already')) {
            throw new Error('This email is already registered. Please sign in instead, or use a different email.')
          }
          throw error
        }

        if (!data.session) {
          // Email confirmation is required before there's an authenticated
          // session — inserting the business row now would fail Row Level
          // Security (it requires auth.uid() to match owner_auth_id), so
          // there's nothing safe to do here except tell the person clearly
          // what to do next, instead of silently leaving them with an
          // account that has no business attached to it.
          setError(
            'Account created — check your email and click the confirmation link, then sign in. Your business will be set up the first time you sign in after confirming.'
          )
          setBusy(false)
          return
        }

        if (data.user) {
          const { error: bizError } = await supabase.from('businesses').insert({
            owner_auth_id: data.user.id,
            name: businessName,
            type: businessType,
          })
          if (bizError) throw bizError
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-display text-2xl font-semibold text-brand-dark">StockTracer</div>
          <p className="text-muted text-sm mt-1">We aim to maximize profits by preventing stockouts while minimizing excess stock that drains cash flow.
          </p>
        </div>

        <div className="bg-paper-raised border border-line rounded-lg p-6">
          <div className="flex gap-1 mb-6 bg-paper rounded-md p-1">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`flex-1 text-sm font-medium py-1.5 rounded ${mode === 'signin' ? 'bg-paper-raised shadow-sm text-ink' : 'text-muted'
                }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 text-sm font-medium py-1.5 rounded ${mode === 'signup' ? 'bg-paper-raised shadow-sm text-ink' : 'text-muted'
                }`}
            >
              Create business
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <Field label="Business name">
                  <input
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Fred's Electronics"
                    className="input"
                  />
                </Field>
                <Field label="Business type">
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="input"
                  >
                    <option value="retail">Retail shop</option>
                    <option value="electronics">Electronics / Phones</option>
                    <option value="supermarket">Supermarket</option>
                    <option value="restaurant">Restaurant / Cafe</option>
                    <option value="barbershop">Barbershop / Salon</option>
                    <option value="clothing">Clothing / Fashion</option>
                    <option value="wholesale">Wholesale / Distributor</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
              </>
            )}
            <Field label="Email">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-muted hover:text-ink"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </Field>

            {error && <p className="text-brick text-sm">{error}</p>}

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create business'}
            </button>
          </form>
        </div>

        <p className="text-xs text-muted text-center mt-6">
          This login is for the business owner only. Staff and cashiers pick their name
          and PIN once they're in.
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

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.5 18.5 0 0 1 4.22-5.06M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M1 1l22 22" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
