import { useState } from 'react'

const BIRTHDAY_MONTH = 7 // July
const BIRTHDAY_DAY = 17


// Shown to every user on every app open, every day, from now through July
// 17th. Counts down the days remaining and shows a photo every day (not
// just on the day itself) — the photo can be swapped daily by dropping a
// new file named for that date into public/birthday/, e.g. 2026-07-05.jpg.
// If no image exists for today, it falls back to fred.jpg.
// Intentionally has no "don't show again" — meant to be seen every open.
export default function BirthdayPopup({ name }) {
  const [dismissed, setDismissed] = useState(false)

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(now.getFullYear(), BIRTHDAY_MONTH - 1, BIRTHDAY_DAY)
  const msPerDay = 24 * 60 * 60 * 1000
  const daysRemaining = Math.round((target - today) / msPerDay)
  const isBirthday = daysRemaining === 0
  const inWindow = daysRemaining >= 0

  if (!inWindow || dismissed) return null

  const buttonLabel = name
    ? `Thank you for using StockTracer, ${name}`
    : 'Thank you for using StockTracer'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-paper-raised w-full max-w-sm rounded-lg overflow-hidden relative shadow-2xl text-center">
        <button
          onClick={() => setDismissed(true)}
          aria-label="Close"
          className="absolute top-3 right-3 text-white/90 hover:text-white text-lg leading-none w-7 h-7 flex items-center justify-center bg-black/30 rounded-full z-10"
        >
          ×
        </button>

        <img
          src={isBirthday ? '/birthday/bday.jpg' : '/birthday/fred.jpg'}
          alt={isBirthday ? 'Happy Birthday Fred' : "Counting down to Fred's birthday"}
          className="w-full h-56 object-cover"
        />

        <div className="p-6">
          {isBirthday ? (
            <>
              <div className="text-4xl mb-2">🎉🎂🎉</div>
              <h2 className="font-display text-xl font-semibold mb-2">Happy Birthday, Fred!</h2>
              <p className="text-sm text-muted">
                Today is the founder's birthday — wishing Fred a fantastic year ahead, from everyone at StockTracer!
              </p>
            </>
          ) : (
            <>
              <div className="text-4xl mb-3">🎈</div>
              <h2 className="font-display text-lg font-semibold mb-2">Fred's Birthday is Coming Up!</h2>
              <p className="text-sm text-muted mb-4">
                {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left until Fred's birthday on July 17.
              </p>
              <div className="text-xs text-muted uppercase tracking-wide">Mark your calendar 🎉</div>
            </>
          )}
        </div>

        <button onClick={() => setDismissed(true)} className="btn-primary w-full rounded-none py-3">
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}
