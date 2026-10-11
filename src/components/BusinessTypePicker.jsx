import { BUSINESS_TYPE_LIST } from '../lib/businessTypes'

// Grid of business types, each with a one-line description so the owner can
// tell "Barbershop" from "Salon" and "Retail shop" from "Wholesale" at a glance.
// `variant="dark"` matches the dark auth screens (Signup); default matches the app.
export default function BusinessTypePicker({ value, onChange, variant = 'app' }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
      {BUSINESS_TYPE_LIST.map((t) => {
        const active = value === t.value
        if (variant === 'dark') {
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange(t.value)}
              className={`auth-chip ${active ? 'auth-chip--active' : ''}`}
              style={{ textAlign: 'left' }}
            >
              <span>{t.icon} {t.label}</span>
              <span style={{ display: 'block', fontSize: '0.7rem', opacity: 0.7, marginTop: 2 }}>{t.blurb}</span>
            </button>
          )
        }
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={`text-left rounded-md border px-3 py-2 ${
              active ? 'bg-brand-light border-brand text-brand-dark' : 'border-line hover:bg-paper'
            }`}
          >
            <div className="text-sm font-medium">{t.icon} {t.label}</div>
            <div className="text-xs text-muted mt-0.5">{t.blurb}</div>
          </button>
        )
      })}
    </div>
  )
}
