import { useState, useEffect } from 'react'

const BIRTHDAY_MONTH = 7 // July
const BIRTHDAY_DAY = 17

// Shown to every user on every app open from July 1st through July 17th.
// Counts down the days remaining until the 17th, then switches to a
// celebration screen with a photo on the day itself. Intentionally has no
// "don't show again" — this is meant to be seen every time during the window.
export default function BirthdayPopup() {
  const [dismissed, setDismissed] = useState(false)

  const now = new Date()
  const isJuly = now.getMonth() + 1 === BIRTHDAY_MONTH
  const day = now.getDate()
  const inWindow = isJuly && day >= 1 && day <= BIRTHDAY_DAY
  const isBirthday = isJuly && day === BIRTHDAY_DAY
  const daysRemaining = BIRTHDAY_DAY - day

  if (!inWindow || dismissed) return null

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

        {isBirthday ? (
          <>
            <img
              src="/birthday/fred.jpg"
              alt="Happy Birthday Fred"
              className="w-full h-56 object-cover"
            />
            <div className="p-6">
              <div className="text-4xl mb-2">🎉🎂🎉</div>
              <h2 className="font-display text-xl font-semibold mb-2">Happy Birthday, Fred!</h2>
              <p className="text-sm text-muted">
                Today is the founder's birthday — wishing Fred a fantastic year ahead, from everyone at StockTracer!
              </p>
            </div>
          </>
        ) : (
          <div className="p-6">
            <div className="text-4xl mb-3">🎈</div>
            <h2 className="font-display text-lg font-semibold mb-2">Fred's Birthday is Coming Up!</h2>
            <p className="text-sm text-muted mb-4">
              {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left until Fred's birthday on July 17.
            </p>
            <div className="text-xs text-muted uppercase tracking-wide">Mark your calendar 🎉</div>
          </div>
        )}

        <button onClick={() => setDismissed(true)} className="btn-primary w-full rounded-none py-3">
          {isBirthday ? 'Thanks for the wishes 🎂' : 'Got it'}
        </button>
      </div>
    </div>
  )
}
