// Signup fix: when the project requires email confirmation, there is no login
// session yet, so the business cannot be saved at signup (the database refuses it
// until the person is signed in). We keep the details on this device instead, and
// create the business automatically the first time they sign in with that email.
//
// Only a matching email can claim it, so details typed by one person are never
// attached to someone else's account on a shared phone.

const KEY = 'stocktracer_pending_business'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // a week is plenty to confirm an email

export function savePendingBusiness({ email, name, type, ownerName }, now = Date.now()) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ email: String(email).trim().toLowerCase(), name, type, ownerName, savedAt: now }))
  } catch {
    // Storage blocked — the app will still ask them to set the business up on first login.
  }
}

/** The saved details if they belong to `email` and are fresh; otherwise null. */
export function readPendingBusiness(email, now = Date.now()) {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (!p?.name || !p?.type || !p?.email) return null
    if (now - (p.savedAt || 0) > MAX_AGE_MS) return null
    if (p.email !== String(email || '').trim().toLowerCase()) return null
    return p
  } catch {
    return null
  }
}

export function clearPendingBusiness() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing to clear
  }
}
