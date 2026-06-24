import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Sell() {
  const { business, activeStaff } = useAuth()
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([]) // {product, quantity}
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (business) {
      Promise.all([
        supabase
          .from('products')
          .select('id, name, sku, selling_price')
          .eq('business_id', business.id)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('product_stock')
          .select('product_id, quantity_on_hand')
          .eq('business_id', business.id),
      ]).then(([{ data: productsData }, { data: stockData }]) => {
        const stockMap = Object.fromEntries((stockData || []).map((s) => [s.product_id, s.quantity_on_hand]))
        setProducts((productsData || []).map((p) => ({ ...p, quantity_on_hand: stockMap[p.id] ?? 0 })))
      })
    }
  }, [business])

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase())
  )

  function addToCart(product) {
    setCart((c) => {
      const existing = c.find((i) => i.product.id === product.id)
      if (existing) {
        return c.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...c, { product, quantity: 1 }]
    })
  }

  function updateQty(productId, qty) {
    setCart((c) => c.map((i) => i.product.id === productId ? { ...i, quantity: qty } : i).filter((i) => i.quantity > 0))
  }

  const total = cart.reduce((sum, i) => sum + i.quantity * i.product.selling_price, 0)

  async function completeSale() {
    if (cart.length === 0) return
    setBusy(true)
    try {
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({ business_id: business.id, staff_user_id: activeStaff?.id || null, total_amount: total })
        .select()
        .single()
      if (saleError) throw saleError

      const saleItems = cart.map((i) => ({
        sale_id: sale.id,
        product_id: i.product.id,
        quantity: i.quantity,
        unit_price: i.product.selling_price,
      }))
      const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)
      if (itemsError) throw itemsError

      const movements = cart.map((i) => ({
        product_id: i.product.id,
        business_id: business.id,
        type: 'sale',
        quantity: -i.quantity,
        staff_user_id: activeStaff?.id || null,
        note: `Sale ${sale.id}`,
      }))
      const { error: moveError } = await supabase.from('stock_movements').insert(movements)
      if (moveError) throw moveError

      setMessage(`Sale completed — UGX ${total.toLocaleString()}`)
      setCart([])
      setTimeout(() => setMessage(''), 4000)
    } catch (err) {
      setMessage(`Error: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <h1 className="font-display text-xl font-semibold mb-1">Sell</h1>
        <p className="text-muted text-sm mb-4">Tap a product to add it to the sale.</p>
        <input
          className="input mb-3"
          placeholder="Search product…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="card divide-y divide-line max-h-[28rem] overflow-y-auto">
          {filtered.map((p) => {
            const qty = p.quantity_on_hand ?? 0
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={qty <= 0}
                className="w-full text-left px-4 py-3 text-sm flex items-center justify-between hover:bg-paper disabled:opacity-40"
              >
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted">UGX {Number(p.selling_price).toLocaleString()} · {qty} in stock</div>
                </div>
                <span className="font-mono text-brand-dark">+</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="mb-3 pb-2 ledger-rule">
          <h2 className="font-display text-sm font-semibold">Current sale</h2>
        </div>

        {message && <p className="text-sm text-brand-dark bg-brand-light rounded-md px-3 py-2 mb-3">{message}</p>}

        {cart.length === 0 ? (
          <p className="card px-4 py-8 text-center text-sm text-muted">No items added yet.</p>
        ) : (
          <div className="card divide-y divide-line mb-4">
            {cart.map((i) => (
              <div key={i.product.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium">{i.product.name}</div>
                  <div className="text-xs text-muted font-mono">UGX {Number(i.product.selling_price).toLocaleString()} each</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(i.product.id, i.quantity - 1)} className="btn-secondary px-2 py-1 text-xs">−</button>
                  <span className="font-mono w-6 text-center">{i.quantity}</span>
                  <button onClick={() => updateQty(i.product.id, i.quantity + 1)} className="btn-secondary px-2 py-1 text-xs">+</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mb-4 px-1">
          <span className="text-sm font-medium">Total</span>
          <span className="font-mono text-lg font-semibold">UGX {total.toLocaleString()}</span>
        </div>

        <button onClick={completeSale} disabled={busy || cart.length === 0} className="btn-primary w-full">
          {busy ? 'Completing…' : 'Complete sale'}
        </button>
      </div>
    </div>
  )
}