export const BIRTHDAY_MONTH = 7 // July
export const BIRTHDAY_DAY = 17

// Midnight at the start of the birthday, in the current (or next) year.
export function getBirthdayTarget(now = new Date()) {
  const target = new Date(now.getFullYear(), BIRTHDAY_MONTH - 1, BIRTHDAY_DAY, 0, 0, 0, 0)
  return target
}

// Whole days remaining until the birthday (0 on the day itself, negative after).
export function getDaysRemaining(now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = getBirthdayTarget(now)
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((target - today) / msPerDay)
}

// Milliseconds remaining until midnight of the birthday (can go negative once it passes).
export function getMsRemaining(now = new Date()) {
  return getBirthdayTarget(now).getTime() - now.getTime()
}

export function formatHMS(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}
