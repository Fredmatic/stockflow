import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function displayName(item) {
  return item.variant_name ? `${item.product_name} — ${item.variant_name}` : item.product_name
}

export default function StockIn() {
  const { business, activeStaff } = useAuth()
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (business) {
      supabase
        .from('product_stock')
        .select('product_id, variant_id, product_name, variant_name, sku')
        .eq('business_id', business.id)
        .then(({ data }) => setItems(data || []))
    }
  }, [business])

  const filtered = items.filter((p) =>
    displayName(p).toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selected || !quantity) return
    setBusy(true)
    await supabase.from('stock_movements').insert({
      product_id: selected.product_id,
      variant_id: selected.variant_id || null,
      business_id: business.id,
      type: 'restock',
      quantity: Number(quantity),
      note: note || null,
      staff_user_id: activeStaff?.id || null,
    })
    setMessage(`Added ${quantity} of ${displayName(selected)} to stock.`)
    setSelected(null)
    setQuantity('')
    setNote('')
    setSearch('')
    setBusy(false)
    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Stock In</h1>
        <p className="text-muted text-sm">Record new stock arriving from a supplier.</p>
      </div>

      {message && <p className="text-sm text-brand-dark bg-brand-light rounded-md px-3 py-2">{message}</p>}

      {!selected ? (
        <div>
          <input
            className="input mb-3"
            placeholder="Search product by name or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="card divide-y divide-line max-h-80 overflow-y-auto">
            {filtered.map((p) => (
              <button
                key={p.variant_id || p.product_id}
                onClick={() => setSelected(p)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-paper"
              >
                {displayName(p)} {p.sku && <span className="text-muted text-xs">· {p.sku}</span>}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-4 py-6 text-sm text-muted text-center">No products found.</p>}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{displayName(selected)}</span>
            <button type="button" onClick={() => setSelected(null)} className="text-xs text-muted">Change</button>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-muted mb-1 block">Quantity received</span>
            <input
              required
              autoFocus
              type="number"
              min="1"
              className="input font-mono"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted mb-1 block">Note (optional)</span>
            <input className="input" placeholder="e.g. supplier name" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Saving…' : 'Add to stock'}
          </button>
        </form>
      )}
    </div>
  )
}
