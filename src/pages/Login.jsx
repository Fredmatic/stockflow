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
        if (error) throw error
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
          <div className="font-display text-2xl font-semibold text-brand-dark">StockFlow</div>
          <p className="text-muted text-sm mt-1">Know what's in, what's out, what's lacking.</p>
        </div>

        <div className="bg-paper-raised border border-line rounded-lg p-6">
          <div className="flex gap-1 mb-6 bg-paper rounded-md p-1">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`flex-1 text-sm font-medium py-1.5 rounded ${
                mode === 'signin' ? 'bg-paper-raised shadow-sm text-ink' : 'text-muted'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 text-sm font-medium py-1.5 rounded ${
                mode === 'signup' ? 'bg-paper-raised shadow-sm text-ink' : 'text-muted'
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
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
              />
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
