import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import '../styles/auth-card.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
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
    <div className="auth-shell">
      <div className="auth-brand">
        <button onClick={() => navigate('/')} className="auth-brand-name block">
          StockTracer
        </button>
        <p className="auth-brand-tagline">Sign in to your business account</p>
      </div>

      <div className={`auth-card${expanded ? ' auth-card--expanded' : ''}`}>
        <button
          type="button"
          className="auth-card-collapsed"
          onClick={() => setExpanded(true)}
          aria-expanded={expanded}
        >
          <span aria-hidden="true">🔒</span>
          <span>Login</span>
        </button>

        <div className="auth-card-expand-wrap">
          <div className="auth-card-expand-track">
            <div className="auth-card-inner">
              <form onSubmit={handleSubmit}>
                <label className="auth-field">
                  <span className="auth-field-label">Email address</span>
                  <input
                    required
                    type="email"
                    className="auth-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>

                <label className="auth-field">
                  <span className="auth-field-label">Password</span>
                  <div className="relative">
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      className="auth-input pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                  {busy ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <p className="auth-muted text-xs text-center mt-5">
                Don't have an account?{' '}
                <Link to="/signup" className="auth-link">
                  Start free trial
                </Link>
              </p>
              <p className="auth-muted text-xs text-center mt-2">
                <Link to="/reset-password" className="auth-link">
                  Forgot your password?
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}