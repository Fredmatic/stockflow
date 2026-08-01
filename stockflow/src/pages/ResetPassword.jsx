import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Two modes:
//   'request' — user enters their email and we send a reset link
//   'update'  — user arrived via the reset link; they set a new password
export default function ResetPassword() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('request')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  // Supabase sends a PKCE recovery link that lands the user back at the app
  // with an auth event of type PASSWORD_RECOVERY. Detect that here and
  // switch to the "set new password" form.
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('update')
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleRequest(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdate(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="text-center mb-8">
        <button onClick={() => navigate('/')} className="font-display text-2xl font-semibold text-brand-dark mb-1 block">
          StockTracer
        </button>
        <p className="text-muted text-sm">
          {mode === 'request' ? 'Reset your password' : 'Set a new password'}
        </p>
      </div>

      <div className="w-full max-w-sm bg-paper-raised border border-line rounded-lg p-6">

        {done ? (
          <div className="text-center space-y-3 py-4">
            <div className="text-4xl">{mode === 'request' ? '📧' : '✅'}</div>
            <h2 className="font-display font-semibold">
              {mode === 'request' ? 'Check your email' : 'Password updated!'}
            </h2>
            <p className="text-sm text-muted">
              {mode === 'request'
                ? `We sent a reset link to ${email}. Click it to set a new password.`
                : 'Your password has been updated. Redirecting you to sign in…'}
            </p>
            {mode === 'request' && (
              <Link to="/login" className="btn-secondary w-full block text-center py-2 text-sm mt-2">
                Back to sign in
              </Link>
            )}
          </div>
        ) : mode === 'request' ? (
          <form onSubmit={handleRequest} className="space-y-4">
            <div>
              <h2 className="font-display font-semibold mb-1">Forgot your password?</h2>
              <p className="text-xs text-muted">Enter your email and we'll send you a reset link.</p>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-muted mb-1 block">Email address</span>
              <input
                required
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </label>

            {error && <p className="text-brick text-sm">{error}</p>}

            <button type="submit" disabled={busy} className="btn-primary w-full py-3">
              {busy ? 'Sending…' : 'Send reset link'}
            </button>

            <Link to="/login" className="block text-center text-xs text-muted hover:text-ink">
              ← Back to sign in
            </Link>
          </form>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <h2 className="font-display font-semibold mb-1">Set a new password</h2>
              <p className="text-xs text-muted">Choose something you'll remember.</p>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-muted mb-1 block">New password</span>
              <div className="relative">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  minLength={6}
                  className="input pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-muted hover:text-ink"
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </label>

            {error && <p className="text-brick text-sm">{error}</p>}

            <button type="submit" disabled={busy} className="btn-primary w-full py-3">
              {busy ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
