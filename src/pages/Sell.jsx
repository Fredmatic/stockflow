import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ScannerModal, ScanIcon } from '../components/Scanner'

export default function Sell() {
  const { business, activeStaff } = useAuth()
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([]) // {product, quantity}
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const canSeeProfit = activeStaff?.role === 'owner'
  const [scanning, setScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState('')

  useEffect(() => {
    if (business) {
      Promise.all([
        supabase
          .from('products')
          .select('id, name, sku, barcode, selling_price, cost_price')
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
    const hasPrice = Number(product.selling_price) > 0
    const available = product.quantity_on_hand ?? 0
    setCart((c) => {
      const existing = c.find((i) => i.product.id === product.id)
      if (existing) {
        if (existing.quantity >= available) {
          setMessage(`Error: only ${available} of ${product.name} in stock.`)
          return c
        }
        return c.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      if (available <= 0) {
        setMessage(`Error: ${product.name} is out of stock.`)
        return c
      }
      return [...c, { product, quantity: 1, manualPrice: hasPrice ? null : '' }]
    })
  }

  function setManualPrice(productId, value) {
    setCart((c) => c.map((i) => i.product.id === productId ? { ...i, manualPrice: value } : i))
  }

  function unitPriceFor(item) {
    if (item.manualPrice !== null && item.manualPrice !== undefined) {
      return Number(item.manualPrice) || 0
    }
    return Number(item.product.selling_price) || 0
  }

  function handleScan(code) {
    const match = products.find((p) => p.barcode && p.barcode === code)
    setScanning(false)
    if (match) {
      const available = match.quantity_on_hand ?? 0
      const inCart = cart.find((i) => i.product.id === match.id)
      const alreadyInCart = inCart?.quantity ?? 0
      if (alreadyInCart >= available) {
        setScanMessage(`${match.name} is out of stock — can't add more.`)
      } else {
        addToCart(match)
        setScanMessage(`Added: ${match.name}`)
      }
    } else {
      setScanMessage(`No product matches code "${code}". Add it in Products first.`)
    }
    setTimeout(() => setScanMessage(''), 4000)
  }

  function updateQty(productId, qty) {
    setCart((c) =>
      c
        .map((i) => {
          if (i.product.id !== productId) return i
          const available = i.product.quantity_on_hand ?? 0
          if (qty > available) {
            setMessage(`Error: only ${available} of ${i.product.name} in stock.`)
            return i
          }
          return { ...i, quantity: qty }
        })
        .filter((i) => i.quantity > 0)
    )
  }

  const total = cart.reduce((sum, i) => sum + i.quantity * unitPriceFor(i), 0)
  const totalProfit = cart.reduce(
    (sum, i) => sum + i.quantity * (unitPriceFor(i) - (i.product.cost_price || 0)),
    0
  )

  async function completeSale() {
    if (cart.length === 0) return
    const missingPrice = cart.find((i) => unitPriceFor(i) <= 0)
    if (missingPrice) {
      setMessage(`Error: enter a price for ${missingPrice.product.name} before completing the sale.`)
      return
    }
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
        unit_price: unitPriceFor(i),
        unit_cost: i.product.cost_price || 0,
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

      setMessage(
        canSeeProfit
          ? `Sale completed — UGX ${total.toLocaleString()} (profit UGX ${totalProfit.toLocaleString()})`
          : `Sale completed — UGX ${total.toLocaleString()}`
      )
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
        <p className="text-muted text-sm mb-4">Tap a product to add it, or scan its code.</p>
        <div className="flex gap-2 mb-3">
          <input
            className="input flex-1"
            placeholder="Search product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" onClick={() => setScanning(true)} className="btn-secondary px-3" aria-label="Scan code">
            <ScanIcon />
          </button>
        </div>
        {scanMessage && <p className="text-sm text-brand-dark bg-brand-light rounded-md px-3 py-2 mb-3">{scanMessage}</p>}
        <div className="card divide-y divide-line max-h-[28rem] overflow-y-auto">
          {filtered.map((p) => {
            const qty = p.quantity_on_hand ?? 0
            const noPrice = !p.selling_price || Number(p.selling_price) <= 0
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={qty <= 0}
                className="w-full text-left px-4 py-3 text-sm flex items-center justify-between hover:bg-paper disabled:opacity-40"
              >
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted">
                    {noPrice ? (
                      <span className="text-brick">No saved price — you'll enter one</span>
                    ) : (
                      `UGX ${Number(p.selling_price).toLocaleString()}`
                    )}{' '}
                    · {qty} in stock
                  </div>
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
            {cart.map((i) => {
              const isManual = i.manualPrice !== null && i.manualPrice !== undefined
              const unitPrice = unitPriceFor(i)
              const lineProfit = i.quantity * (unitPrice - (i.product.cost_price || 0))
              const available = i.product.quantity_on_hand ?? 0
              const atMax = i.quantity >= available
              return (
                <div key={i.product.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{i.product.name}</div>
                      {!isManual && (
                        <div className="text-xs text-muted font-mono">
                          UGX {Number(unitPrice).toLocaleString()} each
                          {canSeeProfit && <span className="text-amber ml-2">+{lineProfit.toLocaleString()} profit</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(i.product.id, i.quantity - 1)} className="btn-secondary px-2 py-1 text-xs">−</button>
                      <span className="font-mono w-6 text-center">{i.quantity}</span>
                      <button
                        onClick={() => updateQty(i.product.id, i.quantity + 1)}
                        disabled={atMax}
                        className="btn-secondary px-2 py-1 text-xs disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  {isManual && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-brick whitespace-nowrap">No saved price — enter sale price:</span>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        placeholder="e.g. 5000"
                        className="input font-mono py-1 text-sm"
                        value={i.manualPrice}
                        onChange={(e) => setManualPrice(i.product.id, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className={`flex items-center justify-between px-1 ${canSeeProfit ? 'mb-1' : 'mb-4'}`}>
          <span className="text-sm font-medium">Total</span>
          <span className="font-mono text-lg font-semibold">UGX {total.toLocaleString()}</span>
        </div>
        {canSeeProfit && (
          <div className="flex items-center justify-between mb-4 px-1">
            <span className="text-xs text-muted">Profit</span>
            <span className="font-mono text-sm text-amber">UGX {totalProfit.toLocaleString()}</span>
          </div>
        )}

        <button onClick={completeSale} disabled={busy || cart.length === 0} className="btn-primary w-full">
          {busy ? 'Completing…' : 'Complete sale'}
        </button>
      </div>

      {scanning && <ScannerModal onResult={handleScan} onClose={() => setScanning(false)} />}
    </div>
  )
}