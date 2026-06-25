import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ScannerModal, ScanIcon } from '../components/Scanner'

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
        .select('product_id, variant_id, quantity_on_hand, status, selling_price')
        .eq('business_id', business.id),
    ])

    // Group sellable rows (simple products, or each variant) by parent product.
    const byProduct = {}
    for (const s of stockData || []) {
      if (!byProduct[s.product_id]) byProduct[s.product_id] = []
      byProduct[s.product_id].push(s)
    }

    const merged = (productsData || []).map((p) => {
      const rows = byProduct[p.id] || []
      const totalQty = rows.reduce((sum, r) => sum + (r.quantity_on_hand || 0), 0)
      let status = 'out_of_stock'
      if (rows.some((r) => r.status === 'in_stock')) status = 'in_stock'
      else if (rows.some((r) => r.status === 'low_stock')) status = 'low_stock'
      const prices = rows.map((r) => Number(r.selling_price) || 0)
      return {
        ...p,
        stock: { quantity_on_hand: totalQty, status },
        variantCount: rows.length,
        priceRange: prices.length ? [Math.min(...prices), Math.max(...prices)] : [0, 0],
      }
    })
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
                <div className="text-sm font-medium">
                  {p.name}
                  {p.has_variants && (
                    <span className="ml-2 text-xs text-brand-dark bg-brand-light rounded-full px-2 py-0.5">
                      {p.variantCount} type{p.variantCount === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted">
                  {p.has_variants ? (
                    p.priceRange[0] === p.priceRange[1]
                      ? `UGX ${p.priceRange[0].toLocaleString()}`
                      : `UGX ${p.priceRange[0].toLocaleString()}–${p.priceRange[1].toLocaleString()}`
                  ) : (
                    <>{p.sku ? `SKU ${p.sku} · ` : ''}UGX {Number(p.selling_price).toLocaleString()}</>
                  )}
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

let tempIdCounter = 0
function tempId() {
  tempIdCounter += 1
  return `tmp-${tempIdCounter}`
}

function ProductForm({ business, product, onClose, onSaved }) {
  const isElectronics = business?.type === 'electronics'
  const isSupermarket = business?.type === 'supermarket'
  const isEditing = !!product

  const [hasVariants, setHasVariants] = useState(product?.has_variants || false)
  const [variants, setVariants] = useState([]) // existing variants, when editing
  const [newVariantRows, setNewVariantRows] = useState([
    { key: tempId(), name: '', cost_price: '', selling_price: '', starting_quantity: '' },
  ])
  const [loadingVariants, setLoadingVariants] = useState(isEditing && product?.has_variants)

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
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    if (isEditing && product?.has_variants) {
      supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', product.id)
        .eq('is_active', true)
        .order('created_at')
        .then(({ data }) => {
          setVariants(data || [])
          setLoadingVariants(false)
        })
    }
  }, [isEditing, product])

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleScan(code) {
    set('barcode', code)
    setScanning(false)
  }

  function addNewVariantRow() {
    setNewVariantRows((rows) => [
      ...rows,
      { key: tempId(), name: '', cost_price: '', selling_price: '', starting_quantity: '' },
    ])
  }

  function removeNewVariantRow(key) {
    setNewVariantRows((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows))
  }

  function setNewVariantField(key, field, value) {
    setNewVariantRows((rows) => rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)))
  }

  function setExistingVariantField(id, field, value) {
    setVariants((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  async function removeExistingVariant(id) {
    setBusy(true)
    await supabase.from('product_variants').update({ is_active: false }).eq('id', id)
    setVariants((rows) => rows.filter((r) => r.id !== id))
    setBusy(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (hasVariants && !isEditing) {
      const cleanRows = newVariantRows.filter((r) => r.name.trim())
      if (cleanRows.length === 0) {
        setError('Add at least one type (e.g. Ceramic) with a name.')
        return
      }
      const missingPrice = cleanRows.find((r) => !r.selling_price)
      if (missingPrice) {
        setError(`Enter a selling price for "${missingPrice.name}".`)
        return
      }
    }

    setBusy(true)
    const attributes = {}
    if (isElectronics) {
      if (form.imei) attributes.imei = form.imei
      if (form.warranty_months) attributes.warranty_months = Number(form.warranty_months)
    }
    if (isSupermarket && form.expiry_date) attributes.expiry_date = form.expiry_date

    const payload = {
      business_id: business.id,
      name: form.name,
      sku: hasVariants ? null : (form.sku || null),
      barcode: hasVariants ? null : (form.barcode || null),
      cost_price: hasVariants ? 0 : (Number(form.cost_price) || 0),
      selling_price: hasVariants ? 0 : (Number(form.selling_price) || 0),
      reorder_level: hasVariants ? 5 : (Number(form.reorder_level) || 0),
      attributes,
      has_variants: hasVariants,
    }

    try {
      if (product) {
        const { error: err } = await supabase.from('products').update(payload).eq('id', product.id)
        if (err) throw err

        if (hasVariants) {
          // Save edits to existing variants.
          for (const v of variants) {
            const { error: vErr } = await supabase
              .from('product_variants')
              .update({
                name: v.name,
                cost_price: Number(v.cost_price) || 0,
                selling_price: Number(v.selling_price) || 0,
                reorder_level: Number(v.reorder_level) || 5,
                sku: v.sku || null,
                barcode: v.barcode || null,
              })
              .eq('id', v.id)
            if (vErr) throw vErr
          }
          // Insert any newly added type rows.
          const cleanRows = newVariantRows.filter((r) => r.name.trim())
          for (const r of cleanRows) {
            const { data: createdVariant, error: vErr } = await supabase
              .from('product_variants')
              .insert({
                product_id: product.id,
                business_id: business.id,
                name: r.name,
                cost_price: Number(r.cost_price) || 0,
                selling_price: Number(r.selling_price) || 0,
              })
              .select()
              .single()
            if (vErr) throw vErr
            if (Number(r.starting_quantity) > 0) {
              await supabase.from('stock_movements').insert({
                product_id: product.id,
                variant_id: createdVariant.id,
                business_id: business.id,
                type: 'restock',
                quantity: Number(r.starting_quantity),
                note: 'Starting stock',
              })
            }
          }
        }
      } else {
        const { data, error: err } = await supabase.from('products').insert(payload).select().single()
        if (err) throw err

        if (hasVariants) {
          const cleanRows = newVariantRows.filter((r) => r.name.trim())
          for (const r of cleanRows) {
            const { data: createdVariant, error: vErr } = await supabase
              .from('product_variants')
              .insert({
                product_id: data.id,
                business_id: business.id,
                name: r.name,
                cost_price: Number(r.cost_price) || 0,
                selling_price: Number(r.selling_price) || 0,
              })
              .select()
              .single()
            if (vErr) throw vErr
            if (Number(r.starting_quantity) > 0) {
              await supabase.from('stock_movements').insert({
                product_id: data.id,
                variant_id: createdVariant.id,
                business_id: business.id,
                type: 'restock',
                quantity: Number(r.starting_quantity),
                note: 'Starting stock',
              })
            }
          }
        } else if (Number(form.starting_quantity) > 0) {
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
            <input required className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Screen Guard" />
          </Field>

          <label className="flex items-center gap-2 text-sm py-1">
            <input
              type="checkbox"
              checked={hasVariants}
              disabled={isEditing}
              onChange={(e) => setHasVariants(e.target.checked)}
              className="w-4 h-4"
            />
            <span>
              Has types/variants (e.g. Ceramic, Full Glue, Matte)
              {isEditing && <span className="text-muted text-xs"> — set when created</span>}
            </span>
          </label>

          {!hasVariants && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="SKU">
                  <input className="input" value={form.sku} onChange={(e) => set('sku', e.target.value)} />
                </Field>
                <Field label="Barcode">
                  <div className="flex gap-2">
                    <input className="input flex-1" value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
                    <button type="button" onClick={() => setScanning(true)} className="btn-secondary px-3" aria-label="Scan barcode">
                      <ScanIcon />
                    </button>
                  </div>
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
            </>
          )}

          {hasVariants && (
            <div className="space-y-3 pt-1">
              <div className="text-xs font-medium text-muted">
                Types — each has its own cost &amp; selling price
              </div>

              {loadingVariants ? (
                <p className="text-xs text-muted">Loading types…</p>
              ) : (
                variants.map((v) => (
                  <div key={v.id} className="rounded-md border border-line p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        className="input flex-1"
                        placeholder="Type name e.g. Ceramic"
                        value={v.name}
                        onChange={(e) => setExistingVariantField(v.id, 'name', e.target.value)}
                      />
                      <button type="button" onClick={() => removeExistingVariant(v.id)} className="text-xs text-brick whitespace-nowrap">
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number" min="0"
                        className="input font-mono text-sm"
                        placeholder="Cost price"
                        value={v.cost_price}
                        onChange={(e) => setExistingVariantField(v.id, 'cost_price', e.target.value)}
                      />
                      <input
                        type="number" min="0"
                        className="input font-mono text-sm"
                        placeholder="Selling price"
                        value={v.selling_price}
                        onChange={(e) => setExistingVariantField(v.id, 'selling_price', e.target.value)}
                      />
                    </div>
                  </div>
                ))
              )}

              <div className="text-xs font-medium text-muted pt-1">
                {variants.length > 0 ? 'Add another type' : 'Add types'}
              </div>
              {newVariantRows.map((r) => (
                <div key={r.key} className="rounded-md border border-line border-dashed p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      className="input flex-1"
                      placeholder="Type name e.g. Ceramic"
                      value={r.name}
                      onChange={(e) => setNewVariantField(r.key, 'name', e.target.value)}
                    />
                    {newVariantRows.length > 1 && (
                      <button type="button" onClick={() => removeNewVariantRow(r.key)} className="text-xs text-brick whitespace-nowrap">
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number" min="0"
                      className="input font-mono text-sm"
                      placeholder="Cost price"
                      value={r.cost_price}
                      onChange={(e) => setNewVariantField(r.key, 'cost_price', e.target.value)}
                    />
                    <input
                      type="number" min="0"
                      className="input font-mono text-sm"
                      placeholder="Selling price"
                      value={r.selling_price}
                      onChange={(e) => setNewVariantField(r.key, 'selling_price', e.target.value)}
                    />
                    <input
                      type="number" min="0"
                      className="input font-mono text-sm"
                      placeholder="Starting qty"
                      value={r.starting_quantity}
                      onChange={(e) => setNewVariantField(r.key, 'starting_quantity', e.target.value)}
                    />
                  </div>
                </div>
              ))}
              <button type="button" onClick={addNewVariantRow} className="btn-secondary w-full text-sm">
                + Add another type
              </button>
            </div>
          )}

          {isElectronics && !hasVariants && (
            <>
              <Field label="IMEI / Serial (optional)">
                <input className="input font-mono" value={form.imei} onChange={(e) => set('imei', e.target.value)} />
              </Field>
              <Field label="Warranty (months)">
                <input type="number" min="0" className="input" value={form.warranty_months} onChange={(e) => set('warranty_months', e.target.value)} />
              </Field>
            </>
          )}

          {isSupermarket && !hasVariants && (
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

      {scanning && (
        <ScannerModal
          onResult={handleScan}
          onClose={() => setScanning(false)}
          instructions="Point the camera at the product's barcode or QR code to fill it in automatically."
        />
      )}
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
