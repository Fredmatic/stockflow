import { useState, useEffect } from 'react'
import { getMsRemaining, formatHMS, getDaysRemaining } from '../lib/birthday'

// Small ticking countdown to Fred's birthday (July 17), meant to sit on the
// right side of the dashboard header. Updates every second; hides itself
// once the birthday has passed.
export default function BirthdayCountdown() {
  const [ms, setMs] = useState(getMsRemaining())

  useEffect(() => {
    const interval = setInterval(() => setMs(getMsRemaining()), 1000)
    return () => clearInterval(interval)
  }, [])

  if (ms <= -24 * 60 * 60 * 1000) return null // hide the day after

  const days = getDaysRemaining()
  const isBirthday = days === 0

  return (
    <div className="text-right">
      <div className="text-xs text-muted">
        {isBirthday ? "It's Fred's birthday! 🎂" : "Fred's birthday in"}
      </div>
      <div className="font-mono text-sm font-semibold text-brand-dark">
        {isBirthday ? '🎉 Today 🎉' : formatHMS(ms)}
      </div>
    </div>
  )
}
