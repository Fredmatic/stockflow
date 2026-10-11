import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

// Stock count: walk the shelves, type what you actually counted, and see the
// difference against what the system thinks you have. Shortages and surpluses
// are saved as stock adjustments, so the books match the shelf again.
// (Bars, pharmacies, supermarkets and hardware stores use this to catch loss.)
export default function StockCount() {
  const { business, activeStaff } = useAuth()
  const [rows, setRows] = useState([])
  const [counts, setCounts] = useState({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!business) return
    setLoading(true)
    setCounts({})
    supabase
      .from('product_stock')
      .select('product_id, variant_id, product_name, variant_name, quantity_on_hand, cost_price')
      .eq('business_id', business.id)
      .order('product_name')
      .then(({ data }) => {
        setRows(data || [])
        setLoading(false)
      })
  }, [business])

  const keyOf = (r) => r.variant_id || r.product_id
  const name = (r) => (r.variant_name ? `${r.product_name} — ${r.variant_name}` : r.product_name)

  const differences = useMemo(
    () =>
      rows
        .filter((r) => counts[keyOf(r)] !== undefined && counts[keyOf(r)] !== '')
        .map((r) => ({ ...r, diff: Number(counts[keyOf(r)]) - Number(r.quantity_on_hand) }))
        .filter((r) => r.diff !== 0),
    [rows, counts]
  )
  const lossValue = differences.filter((d) => d.diff < 0).reduce((n, d) => n + Math.abs(d.diff) * Number(d.cost_price || 0), 0)

  async function apply() {
    if (differences.length === 0) return
    setSaving(true)
    const { error } = await supabase.from('stock_movements').insert(
      differences.map((d) => ({
        product_id: d.product_id,
        variant_id: d.variant_id || null,
        business_id: business.id,
        type: 'adjustment',
        quantity: d.diff,
        note: `Stock count: system ${d.quantity_on_hand}, counted ${Number(d.quantity_on_hand) + d.diff}`,
        staff_user_id: activeStaff?.id || null,
      }))
    )
    setSaving(false)
    if (error) return setMessage(`Error: ${error.message}`)
    setMessage(`Stock count saved — ${differences.length} item${differences.length === 1 ? '' : 's'} adjusted.`)
    setCounts({})
    const { data } = await supabase
      .from('product_stock')
      .select('product_id, variant_id, product_name, variant_name, quantity_on_hand, cost_price')
      .eq('business_id', business.id)
      .order('product_name')
    setRows(data || [])
  }

  const shown = rows.filter((r) => name(r).toLowerCase().includes(search.toLowerCase()))
  const isOwner = activeStaff?.role === 'owner'

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-xl font-semibold">Stock count</h1>
        <p className="text-muted text-sm">Count what is really on the shelf. Leave an item blank to skip it.</p>
      </div>

      {message && (
        <p className={`text-sm rounded-md px-3 py-2 ${message.startsWith('Error') ? 'text-brick bg-brick-light' : 'text-brand-dark bg-brand-light'}`}>{message}</p>
      )}

      <input className="input" placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} />

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-muted">Nothing to count yet.</p>
      ) : (
        <div className="card divide-y divide-line">
          {shown.map((r) => {
            const c = counts[keyOf(r)]
            const diff = c === undefined || c === '' ? null : Number(c) - Number(r.quantity_on_hand)
            return (
              <div key={keyOf(r)} className="flex items-center justify-between gap-3 px-4 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{name(r)}</div>
                  <div className="text-xs text-muted">System: {r.quantity_on_hand}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {diff !== null && diff !== 0 && (
                    <span className={`text-xs font-mono ${diff < 0 ? 'text-brick' : 'text-brand-dark'}`}>{diff > 0 ? '+' : ''}{diff}</span>
                  )}
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    className="input font-mono w-24 py-1"
                    placeholder="Counted"
                    value={c ?? ''}
                    onChange={(e) => setCounts((m) => ({ ...m, [keyOf(r)]: e.target.value }))}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {differences.length > 0 && (
        <div className="card p-4 space-y-2 sticky bottom-20 md:bottom-4">
          <div className="text-sm">
            {differences.length} item{differences.length === 1 ? '' : 's'} differ from the system.
            {isOwner && lossValue > 0 && <> Missing stock is worth about <span className="font-mono font-semibold text-brick">UGX {lossValue.toLocaleString()}</span> at cost.</>}
          </div>
          <button onClick={apply} disabled={saving} className="btn-primary w-full">{saving ? 'Saving…' : 'Save count & adjust stock'}</button>
        </div>
      )}
    </div>
  )
}
