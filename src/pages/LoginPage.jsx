import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      // AuthContext will pick up the session and Gate will redirect into the app
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
        <p className="text-muted text-sm">Sign in to your business account</p>
      </div>

      <div className="w-full max-w-sm bg-paper-raised border border-line rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <label className="block">
            <span className="text-xs font-medium text-muted mb-1 block">Password</span>
            <div className="relative">
              <input
                required
                type={showPassword ? 'text' : 'password'}
                className="input pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-xs text-muted text-center mt-5">
          Don't have an account?{' '}
          <Link to="/signup" className="text-brand-dark font-medium hover:underline">
            Start free trial
          </Link>
        </p>
        <p className="text-xs text-muted text-center mt-2">
          <Link to="/reset-password" className="hover:underline">
            Forgot your password?
          </Link>
        </p>
      </div>
    </div>
  )
}
