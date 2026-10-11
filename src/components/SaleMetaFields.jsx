import { getProfile } from '../lib/businessTypes'

// The extra questions a till asks for THIS kind of business: table number for a
// restaurant, patient name for a pharmacy, delivery details for hardware, etc.
// Fields come from the business profile — this component has no business-specific code.
export function initialSaleMeta(business) {
  const meta = {}
  for (const f of getProfile(business).sale.fields) {
    if (f.default !== undefined) meta[f.key] = f.default
  }
  return meta
}

function visible(field, meta, hasRx) {
  if (field.showWhenRx && !hasRx) return false
  if (field.showWhen) {
    return Object.entries(field.showWhen).every(([k, v]) => meta[k] === v)
  }
  return true
}

/** Returns an error message if a required field is missing, else null. */
export function validateSaleMeta(business, meta, hasRx) {
  for (const f of getProfile(business).sale.fields) {
    if (f.requiredWhenRx && hasRx && !String(meta[f.key] || '').trim()) {
      return `Enter the ${f.label.toLowerCase()} — this cart has a prescription-only medicine.`
    }
  }
  return null
}

/** Only keep values for fields that are actually showing, trimmed, non-empty. */
export function cleanSaleMeta(business, meta, hasRx) {
  const out = {}
  for (const f of getProfile(business).sale.fields) {
    if (!visible(f, meta, hasRx)) continue
    const v = typeof meta[f.key] === 'string' ? meta[f.key].trim() : meta[f.key]
    if (v) out[f.key] = v
  }
  return out
}

export default function SaleMetaFields({ business, meta, setMeta, hasRx = false }) {
  const fields = getProfile(business).sale.fields.filter((f) => visible(f, meta, hasRx))
  if (fields.length === 0) return null

  const set = (key, value) => setMeta((m) => ({ ...m, [key]: value }))

  return (
    <div className="space-y-3 mb-4">
      {fields.map((f) => (
        <div key={f.key}>
          <span className="text-xs font-medium text-muted mb-1 block">
            {f.label}{f.requiredWhenRx && hasRx ? ' *' : ''}
          </span>
          {f.type === 'chips' ? (
            <div className="flex gap-2 flex-wrap">
              {f.options.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => set(f.key, o)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
                    meta[f.key] === o ? 'bg-brand-light text-brand-dark border-brand' : 'border-line text-muted hover:bg-paper'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          ) : (
            <input
              className="input"
              value={meta[f.key] || ''}
              placeholder={f.placeholder || ''}
              onChange={(e) => set(f.key, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  )
}
