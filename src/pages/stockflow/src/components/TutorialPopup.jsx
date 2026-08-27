import { useState } from 'react'
import { canAccess } from '../lib/permissions'
import { dismissTutorialForever } from '../lib/tutorialStorage'

const STEPS = [
  {
    route: null,
    title: 'Welcome to StockTracer',
    body: "Here's a quick look at how everything fits together — takes about a minute.",
    icon: '👋',
  },
  {
    route: '/',
    title: 'Dashboard',
    body: "Your home screen. Shows today's sales total and which products are running low on stock.",
    icon: '◧',
  },
  {
    route: '/products',
    title: 'Products',
    body: 'Add what you sell here — name, buying price, selling price, and starting stock. Scan a barcode to fill it in instead of typing.',
    icon: '▤',
  },
  {
    route: '/stock-in',
    title: 'Stock In',
    body: 'Restocking something you already added? Log it here so your stock count stays accurate.',
    icon: '↓',
  },
  {
    route: '/sell',
    title: 'Sell',
    body: "Tap a product (or scan its code) to add it to a sale. Adjust quantity, then Complete sale when you're done.",
    icon: '↑',
  },
  {
    route: '/sales',
    title: 'Sales & Expenses',
    body: 'Sales shows your revenue, profit, and best-selling products. Expenses tracks costs like rent and transport, separate from cost of goods.',
    icon: '◫',
  },
  {
    route: null,
    title: "You're set",
    body: 'You can always come back to this later — just ask whoever set up the app.',
    icon: '✓',
  },
]

export default function TutorialPopup({ staffId, activeStaff, onClose }) {
  const steps = STEPS.filter((s) => !s.route || canAccess(s.route, activeStaff))
  const [step, setStep] = useState(0)
  const isLast = step === steps.length - 1
  const current = steps[step]

  function handleClose(remember) {
    if (remember) dismissTutorialForever(staffId)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
      <div className="bg-paper-raised w-full md:max-w-sm rounded-t-lg md:rounded-lg p-6 relative">
        <button
          onClick={() => handleClose(false)}
          aria-label="Close"
          className="absolute top-3 right-3 text-muted hover:text-ink text-lg leading-none w-7 h-7 flex items-center justify-center"
        >
          ×
        </button>
        <div className="text-4xl mb-3 text-center">{current.icon}</div>
        <h2 className="font-display text-lg font-semibold mb-2 text-center">{current.title}</h2>
        <p className="text-sm text-muted text-center mb-6">{current.body}</p>

        <div className="flex justify-center gap-1.5 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-brand' : 'w-1.5 bg-line'}`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)} className="btn-secondary flex-1">
              Back
            </button>
          )}
          {isLast ? (
            <button onClick={() => handleClose(false)} className="btn-primary flex-1">
              Got it
            </button>
          ) : (
            <button onClick={() => setStep((s) => s + 1)} className="btn-primary flex-1">
              Next
            </button>
          )}
        </div>

        <button onClick={() => handleClose(true)} className="text-xs text-muted block mx-auto pt-4">
          Don't show this again
        </button>
      </div>
    </div>
  )
}
