import { useState, useEffect, useRef } from 'react'
import { getDaysRemaining } from '../lib/birthday'

const STORAGE_KEY = 'birthdayPopupLastShown'
const AUTO_DISMISS_MS = 15000

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

// Shown once per day, on the first app open of the day, from now through
// July 17th. Auto-dismisses after 15 seconds if the button isn't clicked.
// Counts down the days remaining; shows the birthday photo on the day itself.
export default function BirthdayPopup({ name }) {
  const daysRemaining = getDaysRemaining()
  const isBirthday = daysRemaining === 0
  const inWindow = daysRemaining >= 0

  const alreadyShownToday = typeof window !== 'undefined'
    ? window.localStorage.getItem(STORAGE_KEY) === todayKey()
    : true

  const [visible, setVisible] = useState(inWindow && !alreadyShownToday)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!visible) return
    window.localStorage.setItem(STORAGE_KEY, todayKey())
    timerRef.current = setTimeout(() => setVisible(false), AUTO_DISMISS_MS)
    return () => clearTimeout(timerRef.current)
  }, [visible])

  if (!visible) return null

  function close() {
    clearTimeout(timerRef.current)
    setVisible(false)
  }

  const buttonLabel = name
    ? `Thank you for using StockTracer, ${name}`
    : 'Thank you for using StockTracer'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-paper-raised w-full max-w-sm rounded-lg overflow-hidden relative shadow-2xl text-center">
        <button
          onClick={close}
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

        <button onClick={close} className="btn-primary w-full rounded-none py-3">
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}
