import { Component } from 'react'
import { logError } from '../lib/errorLog'

// If any screen crashes, show a calm recovery page instead of a blank white screen,
// and report the crash so it can be fixed.
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    logError(error, { source: 'react', componentStack: String(info?.componentStack || '').slice(0, 1500) })
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-3">
          <div className="text-4xl">😕</div>
          <h1 className="font-display text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted">
            Your sales and stock are safe. We have been told about the problem. Reload to carry on.
          </p>
          <div className="flex gap-2 justify-center">
            <button className="btn-primary" onClick={() => window.location.reload()}>Reload</button>
            <button className="btn-secondary" onClick={() => { window.location.href = '/dashboard' }}>Go to Dashboard</button>
          </div>
        </div>
      </div>
    )
  }
}
