import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function displayName(item) {
  return item.variant_name ? `${item.product_name} — ${item.variant_name}` : item.product_name
}

export default function StockIn() {
  const { business, activeStaff } = useAuth()
  const [items, setItems] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newSupplierPhone, setNewSupplierPhone] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (business) {
      loadProducts()
      loadSuppliers()
    }
  }, [business])

  async function loadProducts() {
    const { data } = await supabase
      .from('product_stock')
      .select('product_id, variant_id, product_name, variant_name, sku, cost_price')
      .eq('business_id', business.id)
    setItems(data || [])
  }

  async function loadSuppliers() {
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('name')
    setSuppliers(data || [])
  }

  const filtered = items.filter((p) =>
    displayName(p).toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase())
  )

  async function addSupplier() {
    if (!newSupplierName.trim()) return
    const { data, error } = await supabase
      .from('suppliers')
      .insert({ business_id: business.id, name: newSupplierName.trim(), phone: newSupplierPhone.trim() || null })
      .select()
      .single()
    if (!error && data) {
      setSuppliers((s) => [...s, data].sort((a, b) => a.name.localeCompare(b.name)))
      setSupplierId(data.id)
      setShowNewSupplier(false)
      setNewSupplierName('')
      setNewSupplierPhone('')
    }
  }

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
      unit_cost: unitCost ? Number(unitCost) : null,
      supplier_id: supplierId || null,
      note: note || null,
      staff_user_id: activeStaff?.id || null,
    })

    // If a cost was entered and differs from the product's current cost price, update it
    if (unitCost && Number(unitCost) > 0) {
      const table = selected.variant_id ? 'product_variants' : 'products'
      const idField = selected.variant_id ? selected.variant_id : selected.product_id
      await supabase.from(table).update({ cost_price: Number(unitCost) }).eq('id', idField)
    }

    const supplierName = suppliers.find((s) => s.id === supplierId)?.name
    setMessage(
      `Added ${quantity} of ${displayName(selected)} to stock${supplierName ? ` from ${supplierName}` : ''}.`
    )
    setSelected(null)
    setQuantity('')
    setUnitCost('')
    setSupplierId('')
    setNote('')
    setSearch('')
    setBusy(false)
    loadProducts()
    setTimeout(() => setMessage(''), 4000)
  }

  return (
    <div className="max-w-md space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Stock In</h1>
          <p className="text-muted text-sm">Record new stock arriving from a supplier.</p>
        </div>
        <button onClick={() => setShowHistory(true)} className="text-xs text-brand-dark font-medium whitespace-nowrap">
          Suppliers →
        </button>
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
                onClick={() => { setSelected(p); setUnitCost(p.cost_price || '') }}
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
            <span className="text-xs font-medium text-muted mb-1 block">Cost price per unit (optional)</span>
            <input
              type="number"
              min="0"
              className="input font-mono"
              placeholder="e.g. 2000"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
            />
            {unitCost && quantity && (
              <span className="text-xs text-muted mt-1 block">
                Total cost: UGX {(Number(unitCost) * Number(quantity)).toLocaleString()}
              </span>
            )}
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted mb-1 block">Supplier (optional)</span>
            {!showNewSupplier ? (
              <div className="flex gap-2">
                <select className="input flex-1" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">— No supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setShowNewSupplier(true)} className="btn-secondary px-3 text-sm whitespace-nowrap">
                  + New
                </button>
              </div>
            ) : (
              <div className="space-y-2 border border-line rounded-md p-3">
                <input
                  className="input"
                  placeholder="Supplier name"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  autoFocus
                />
                <input
                  className="input"
                  placeholder="Phone (optional)"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowNewSupplier(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
                  <button type="button" onClick={addSupplier} className="btn-primary flex-1 text-sm">Save supplier</button>
                </div>
              </div>
            )}
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted mb-1 block">Note (optional)</span>
            <input className="input" placeholder="e.g. invoice number" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Saving…' : 'Add to stock'}
          </button>
        </form>
      )}

      {showHistory && (
        <SuppliersPanel business={business} suppliers={suppliers} onClose={() => setShowHistory(false)} onChanged={loadSuppliers} />
      )}
    </div>
  )
}

function SuppliersPanel({ business, suppliers, onClose, onChanged }) {
  const [supplierTotals, setSupplierTotals] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedSupplier, setSelectedSupplier] = useState(null)

  useEffect(() => { loadTotals() }, [])

  async function loadTotals() {
    setLoading(true)
    const { data } = await supabase
      .from('stock_movements')
      .select('supplier_id, quantity, unit_cost, created_at')
      .eq('business_id', business.id)
      .eq('type', 'restock')
      .not('supplier_id', 'is', null)

    const totals = {}
    ;(data || []).forEach((m) => {
      if (!totals[m.supplier_id]) totals[m.supplier_id] = { totalSpent: 0, totalQty: 0, lastDate: null }
      const cost = (Number(m.unit_cost) || 0) * Number(m.quantity)
      totals[m.supplier_id].totalSpent += cost
      totals[m.supplier_id].totalQty += Number(m.quantity)
      if (!totals[m.supplier_id].lastDate || new Date(m.created_at) > new Date(totals[m.supplier_id].lastDate)) {
        totals[m.supplier_id].lastDate = m.created_at
      }
    })
    setSupplierTotals(totals)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
      <div className="bg-paper-raised w-full md:max-w-md rounded-t-lg md:rounded-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold">Suppliers</h2>
          <button onClick={onClose} className="text-muted text-sm" aria-label="Close">✕</button>
        </div>

        {selectedSupplier ? (
          <SupplierHistory
            business={business}
            supplier={selectedSupplier}
            onBack={() => setSelectedSupplier(null)}
          />
        ) : loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : suppliers.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">No suppliers yet. Add one when recording your next stock-in.</p>
        ) : (
          <div className="card divide-y divide-line">
            {suppliers.map((s) => {
              const t = supplierTotals[s.id]
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedSupplier(s)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-paper"
                >
                  <div>
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-xs text-muted">{s.phone || 'No phone saved'}</div>
                  </div>
                  <div className="text-right">
                    {t ? (
                      <>
                        <div className="font-mono text-sm">UGX {t.totalSpent.toLocaleString()}</div>
                        <div className="text-xs text-muted">{t.totalQty} units total</div>
                      </>
                    ) : (
                      <div className="text-xs text-muted">No restocks yet</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function SupplierHistory({ business, supplier, onBack }) {
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('stock_movements')
      .select('id, quantity, unit_cost, note, created_at, products(name), product_variants(name)')
      .eq('business_id', business.id)
      .eq('supplier_id', supplier.id)
      .eq('type', 'restock')
      .order('created_at', { ascending: false })
    setMovements(data || [])
    setLoading(false)
  }

  const totalSpent = movements.reduce((sum, m) => sum + (Number(m.unit_cost) || 0) * Number(m.quantity), 0)

  return (
    <div>
      <button onClick={onBack} className="text-xs text-brand-dark font-medium mb-3">← All suppliers</button>
      <div className="mb-1">
        <div className="font-medium">{supplier.name}</div>
        <div className="text-xs text-muted">{supplier.phone || 'No phone saved'}</div>
      </div>
      <div className="card px-4 py-3 my-3 flex items-center justify-between">
        <span className="text-sm text-muted">Total spent with this supplier</span>
        <span className="font-mono font-semibold">UGX {totalSpent.toLocaleString()}</span>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : movements.length === 0 ? (
        <p className="text-sm text-muted text-center py-6">No restocks recorded from this supplier yet.</p>
      ) : (
        <div className="card divide-y divide-line">
          {movements.map((m) => (
            <div key={m.id} className="px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span>{m.product_variants?.name ? `${m.products?.name} — ${m.product_variants.name}` : m.products?.name}</span>
                <span className="font-mono">{m.quantity} units</span>
              </div>
              <div className="text-xs text-muted mt-0.5">
                {new Date(m.created_at).toLocaleDateString()}
                {m.unit_cost ? ` · UGX ${Number(m.unit_cost).toLocaleString()}/unit · Total UGX ${(Number(m.unit_cost) * m.quantity).toLocaleString()}` : ''}
                {m.note ? ` · ${m.note}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
