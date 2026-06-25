const STORAGE_KEY = 'stockflow_tutorial_dismissed'

// Returns true if this specific staff member has permanently dismissed the
// tutorial before. Stored in localStorage (not sessionStorage) so the choice
// survives closing and reopening the app — but it's still per-person, keyed
// by their staff_users id, so one person dismissing it doesn't hide it for
// everyone else sharing the same device.
export function hasTutorialBeenDismissed(staffId) {
  if (!staffId) return false
  try {
    const dismissed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return dismissed.includes(staffId)
  } catch {
    return false
  }
}

export function dismissTutorialForever(staffId) {
  if (!staffId) return
  try {
    const dismissed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!dismissed.includes(staffId)) {
      dismissed.push(staffId)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed))
    }
  } catch {
    // localStorage unavailable — tutorial will just show again next time,
    // which is a safe fallback rather than a broken app.
  }
}
