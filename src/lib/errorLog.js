import { supabase } from './supabase'

// Lightweight error monitoring with no third-party account: crashes are saved to the
// client_errors table (migration 016). It must NEVER cause an error itself, never
// slow the app down, and never flood the database.

export const APP_VERSION = '2.1.0'
const MAX_PER_SESSION = 10
const DEDUPE_MS = 60 * 1000

let sent = 0
const recent = new Map() // message -> last time it was logged
let currentBusinessId = null

export function setErrorContext({ businessId }) {
  currentBusinessId = businessId || null
}

/** Cut anything that looks like a secret out of text before it is stored. */
export function scrub(text) {
  return String(text ?? '')
    .replace(/(eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,})/g, '[token]')
    .replace(/(password|pin|apikey|api_key|secret)(["'\s:=]+)[^\s"',&]+/gi, '$1$2[hidden]')
    .slice(0, 4000)
}

export function shouldLog(message, now = Date.now()) {
  if (sent >= MAX_PER_SESSION) return false
  const last = recent.get(message)
  if (last !== undefined && now - last < DEDUPE_MS) return false
  recent.set(message, now)
  return true
}

export function resetErrorLogForTests() {
  sent = 0
  recent.clear()
  currentBusinessId = null
}

export async function logError(error, context = {}) {
  try {
    const message = scrub(error?.message || error || 'Unknown error').slice(0, 500)
    if (!shouldLog(message)) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    sent += 1
    const { data } = await supabase.auth.getSession()
    if (!data?.session) return // the table only accepts signed-in users
    await supabase.from('client_errors').insert({
      user_id: data.session.user.id,
      business_id: currentBusinessId,
      message,
      stack: scrub(error?.stack || ''),
      url: typeof location !== 'undefined' ? location.pathname : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : null,
      app_version: APP_VERSION,
      context,
    })
  } catch {
    // Monitoring must never break the app.
  }
}

/** Catch crashes React never sees: errors in event handlers, timers and un-awaited promises. */
export function installGlobalErrorHandlers() {
  window.addEventListener('error', (e) => logError(e.error || e.message, { source: 'window.error' }))
  window.addEventListener('unhandledrejection', (e) => logError(e.reason, { source: 'unhandledrejection' }))
}
