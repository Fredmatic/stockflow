import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Products() {
  const { business } = useAuth()
  const [products, setProducts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (business) load()
  }, [business])

  async function load() {
    setLoading(true)
    const [{ data: productsData }, { data: stockData }] = await Promise.all([
      supabase
        .from('products')
        .select('*')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('product_stock')
        .select('product_id, quantity_on_hand, status')
        .eq('business_id', business.id),
    ])
    const stockMap = Object.fromEntries((stockData || []).map((s) => [s.product_id, s]))
    const merged = (productsData || []).map((p) => ({
      ...p,
      stock: stockMap[p.id] || { quantity_on_hand: 0, status: 'out_of_stock' },
    }))
    setProducts(merged)
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(p) {
    setEditing(p)
    setShowForm(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Products</h1>
          <p className="text-muted text-sm">{business?.type === 'electronics' ? 'Electronics & phones' : business?.type === 'supermarket' ? 'Supermarket items' : 'Retail items'}</p>
        </div>
        <button onClick={openNew} className="btn-primary">+ Add product</button>
      </div>

      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : products.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-muted">
          No products yet. Add your first one to start tracking stock.
        </p>
      ) : (
        <div className="card divide-y divide-line">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => openEdit(p)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-paper"
            >
              <div>
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs text-muted">
                  {p.sku ? `SKU ${p.sku} · ` : ''}UGX {Number(p.selling_price).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm">{p.stock.quantity_on_hand}</div>
                <StatusLabel status={p.stock.status} />
              </div>
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <ProductForm
          business={business}
          product={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}

function StatusLabel({ status }) {
  const map = {
    in_stock: { text: 'In stock', color: 'var(--color-brand-dark)' },
    low_stock: { text: 'Low stock', color: 'var(--color-amber)' },
    out_of_stock: { text: 'Out of stock', color: 'var(--color-brick)' },
  }
  const s = map[status] || map.in_stock
  return <div className="text-xs" style={{ color: s.color }}>{s.text}</div>
}

function ProductForm({ business, product, onClose, onSaved }) {
  const isElectronics = business?.type === 'electronics'
  const isSupermarket = business?.type === 'supermarket'

  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    barcode: product?.barcode || '',
    cost_price: product?.cost_price || '',
    selling_price: product?.selling_price || '',
    reorder_level: product?.reorder_level ?? 5,
    starting_quantity: 0,
    imei: product?.attributes?.imei || '',
    warranty_months: product?.attributes?.warranty_months || '',
    expiry_date: product?.attributes?.expiry_date || '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const attributes = {}
    if (isElectronics) {
      if (form.imei) attributes.imei = form.imei
      if (form.warranty_months) attributes.warranty_months = Number(form.warranty_months)
    }
    if (isSupermarket && form.expiry_date) attributes.expiry_date = form.expiry_date

    const payload = {
      business_id: business.id,
      name: form.name,
      sku: form.sku || null,
      barcode: form.barcode || null,
      cost_price: Number(form.cost_price) || 0,
      selling_price: Number(form.selling_price) || 0,
      reorder_level: Number(form.reorder_level) || 0,
      attributes,
    }

    try {
      if (product) {
        const { error } = await supabase.from('products').update(payload).eq('id', product.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('products').insert(payload).select().single()
        if (error) throw error
        if (Number(form.starting_quantity) > 0) {
          await supabase.from('stock_movements').insert({
            product_id: data.id,
            business_id: business.id,
            type: 'restock',
            quantity: Number(form.starting_quantity),
            note: 'Starting stock',
          })
        }
      }
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDeactivate() {
    if (!product) return
    setBusy(true)
    await supabase.from('products').update({ is_active: false }).eq('id', product.id)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
      <div className="bg-paper-raised w-full md:max-w-md rounded-t-lg md:rounded-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="font-display font-semibold mb-4">{product ? 'Edit product' : 'New product'}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Name">
            <input required className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU">
              <input className="input" value={form.sku} onChange={(e) => set('sku', e.target.value)} />
            </Field>
            <Field label="Barcode">
              <input className="input" value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cost price (UGX)">
              <input type="number" min="0" className="input font-mono" value={form.cost_price} onChange={(e) => set('cost_price', e.target.value)} />
            </Field>
            <Field label="Selling price (UGX)">
              <input type="number" min="0" className="input font-mono" value={form.selling_price} onChange={(e) => set('selling_price', e.target.value)} />
            </Field>
          </div>
          <Field label="Reorder level (alert when stock falls to this or below)">
            <input type="number" min="0" className="input font-mono" value={form.reorder_level} onChange={(e) => set('reorder_level', e.target.value)} />
          </Field>

          {!product && (
            <Field label="Starting quantity">
              <input type="number" min="0" className="input font-mono" value={form.starting_quantity} onChange={(e) => set('starting_quantity', e.target.value)} />
            </Field>
          )}

          {isElectronics && (
            <>
              <Field label="IMEI / Serial (optional)">
                <input className="input font-mono" value={form.imei} onChange={(e) => set('imei', e.target.value)} />
              </Field>
              <Field label="Warranty (months)">
                <input type="number" min="0" className="input" value={form.warranty_months} onChange={(e) => set('warranty_months', e.target.value)} />
              </Field>
            </>
          )}

          {isSupermarket && (
            <Field label="Expiry date">
              <input type="date" className="input" value={form.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} />
            </Field>
          )}

          {error && <p className="text-brick text-sm">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? 'Saving…' : 'Save'}</button>
          </div>
          {product && (
            <button type="button" onClick={handleDeactivate} className="text-xs text-brick block mx-auto pt-2">
              Remove product
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted mb-1 block">{label}</span>
      {children}
    </label>
  )
}