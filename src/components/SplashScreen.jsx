import { useEffect, useState } from 'react'

// Shown once per browser session, right when the app finishes loading the
// signed-in business — a brief personal welcome before the dashboard/staff
// picker appears. Auto-dismisses on its own, or on tap.
export default function SplashScreen({ name, onDone }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const leaveTimer = setTimeout(() => setLeaving(true), 1400)
    const doneTimer = setTimeout(onDone, 1750)
    return () => {
      clearTimeout(leaveTimer)
      clearTimeout(doneTimer)
    }
  }, [onDone])

  function skip() {
    setLeaving(true)
    setTimeout(onDone, 300)
  }

  return (
    <div
      onClick={skip}
      className={`min-h-screen flex flex-col items-center justify-center bg-brand-dark text-white px-6 cursor-pointer transition-opacity duration-300 ${leaving ? 'opacity-0' : 'opacity-100'
        }`}
    >
      <div className="font-display text-2xl font-semibold tracking-tight mb-2">StockTracer</div>
      <div className="text-white/80 text-sm text-center">
        {name ? `${name} welcomes you to StockTracer` : 'Welcome to StockTracer'}
      </div>
    </div>
  )
}
