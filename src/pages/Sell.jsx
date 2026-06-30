import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ScannerModal, ScanIcon } from '../components/Scanner'

function lineId(item) {
  return item.variant_id || item.product_id
}

function displayName(item) {
  if (!item.variant_name) return item.product_name
  const label = item.variant_sub_name
    ? `${item.variant_name} → ${item.variant_sub_name}`
    : item.variant_name
  return `${item.product_name} — ${label}`
}

function buildReceiptText(receipt) {
  const lines = []
  lines.push(`*${receipt.businessName}*`)
  lines.push(receipt.date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }))
  lines.push('')
  receipt.items.forEach((it) => {
    const lineTotal = it.quantity * it.unitPrice
    lines.push(`${it.quantity} x ${it.name} — UGX ${lineTotal.toLocaleString()}`)
  })
  lines.push('')
  lines.push(`*Total: UGX ${receipt.total.toLocaleString()}*`)
  lines.push(
    receipt.paymentMethod === 'credit'
      ? `Payment: On credit${receipt.customerName ? ` (${receipt.customerName})` : ''}`
      : 'Payment: Cash'
  )
  lines.push('')
  lines.push('Thank you for your business!')
  return lines.join('\n')
}

function shareReceiptWhatsApp(receipt) {
  const text = buildReceiptText(receipt)
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`
  window.open(url, '_blank')
}

export default function Sell() {
  const { business, activeStaff } = useAuth()
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([]) // {item, quantity, manualPrice}
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [lastReceipt, setLastReceipt] = useState(null)

  const canSeeProfit = activeStaff?.role === 'owner'
  const [scanning, setScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState('')

  const [paymentMethod, setPaymentMethod] = useState('cash') // 'cash' | 'credit'
  const [customers, setCustomers] = useState([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [addingCustomer, setAddingCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [customerBusy, setCustomerBusy] = useState(false)

  useEffect(() => {
    if (business) {
      supabase
        .from('product_stock')
        .select('product_id, variant_id, product_name, variant_name, sku, barcode, selling_price, cost_price, quantity_on_hand')
        .eq('business_id', business.id)
        .then(({ data }) => setItems(data || []))
      loadCustomers()
    }
  }, [business])

  async function loadCustomers() {
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('name')
    setCustomers(data || [])
  }

  async function createCustomer() {
    if (!newCustomerName.trim()) return
    setCustomerBusy(true)
    const { data, error: err } = await supabase
      .from('customers')
      .insert({ business_id: business.id, name: newCustomerName.trim(), phone: newCustomerPhone || null })
      .select()
      .single()
    setCustomerBusy(false)
    if (err) {
      setMessage(`Error: ${err.message}`)
      return
    }
    setCustomers((c) => [...c, data])
    setSelectedCustomer(data)
    setAddingCustomer(false)
    setNewCustomerName('')
    setNewCustomerPhone('')
  }

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  )

  function setPaymentMethodSafe(method) {
    setPaymentMethod(method)
    if (method === 'cash') {
      setSelectedCustomer(null)
      setCustomerSearch('')
      setAddingCustomer(false)
    }
  }

  const filtered = items.filter((p) =>
    displayName(p).toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase())
  )

  function addToCart(item) {
    const hasPrice = Number(item.selling_price) > 0
    const available = item.quantity_on_hand ?? 0
    setCart((c) => {
      const existing = c.find((i) => lineId(i.item) === lineId(item))
      if (existing) {
        if (existing.quantity >= available) {
          setMessage(`Error: only ${available} of ${displayName(item)} in stock.`)
          return c
        }
        return c.map((i) => (lineId(i.item) === lineId(item) ? { ...i, quantity: i.quantity + 1 } : i))
      }
      if (available <= 0) {
        setMessage(`Error: ${displayName(item)} is out of stock.`)
        return c
      }
      return [...c, { item, quantity: 1, manualPrice: hasPrice ? null : '' }]
    })
  }

  function setManualPrice(id, value) {
    setCart((c) => c.map((i) => (lineId(i.item) === id ? { ...i, manualPrice: value } : i)))
  }

  function unitPriceFor(i) {
    if (i.manualPrice !== null && i.manualPrice !== undefined) {
      return Number(i.manualPrice) || 0
    }
    return Number(i.item.selling_price) || 0
  }

  function handleScan(code) {
    const match = items.find((p) => p.barcode && p.barcode === code)
    setScanning(false)
    if (match) {
      const available = match.quantity_on_hand ?? 0
      const inCart = cart.find((i) => lineId(i.item) === lineId(match))
      const alreadyInCart = inCart?.quantity ?? 0
      if (alreadyInCart >= available) {
        setScanMessage(`${displayName(match)} is out of stock — can't add more.`)
      } else {
        addToCart(match)
        setScanMessage(`Added: ${displayName(match)}`)
      }
    } else {
      setScanMessage(`No product matches code "${code}". Add it in Products first.`)
    }
    setTimeout(() => setScanMessage(''), 4000)
  }

  function updateQty(id, qty) {
    setCart((c) =>
      c
        .map((i) => {
          if (lineId(i.item) !== id) return i
          const available = i.item.quantity_on_hand ?? 0
          if (qty > available) {
            setMessage(`Error: only ${available} of ${displayName(i.item)} in stock.`)
            return i
          }
          return { ...i, quantity: qty }
        })
        .filter((i) => i.quantity > 0)
    )
  }

  const total = cart.reduce((sum, i) => sum + i.quantity * unitPriceFor(i), 0)
  const totalProfit = cart.reduce(
    (sum, i) => sum + i.quantity * (unitPriceFor(i) - (i.item.cost_price || 0)),
    0
  )

  async function completeSale() {
    if (cart.length === 0) return
    const missingPrice = cart.find((i) => unitPriceFor(i) <= 0)
    if (missingPrice) {
      setMessage(`Error: enter a price for ${displayName(missingPrice.item)} before completing the sale.`)
      return
    }
    if (paymentMethod === 'credit' && !selectedCustomer) {
      setMessage('Error: pick or add a customer for this credit sale.')
      return
    }
    setBusy(true)
    try {
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          business_id: business.id,
          staff_user_id: activeStaff?.id || null,
          total_amount: total,
          is_credit: paymentMethod === 'credit',
          customer_id: paymentMethod === 'credit' ? selectedCustomer.id : null,
        })
        .select()
        .single()
      if (saleError) throw saleError

      const saleItems = cart.map((i) => ({
        sale_id: sale.id,
        product_id: i.item.product_id,
        variant_id: i.item.variant_id || null,
        quantity: i.quantity,
        unit_price: unitPriceFor(i),
        unit_cost: i.item.cost_price || 0,
      }))
      const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)
      if (itemsError) throw itemsError

      const movements = cart.map((i) => ({
        product_id: i.item.product_id,
        variant_id: i.item.variant_id || null,
        business_id: business.id,
        type: 'sale',
        quantity: -i.quantity,
        staff_user_id: activeStaff?.id || null,
        note: `Sale ${sale.id}`,
      }))
      const { error: moveError } = await supabase.from('stock_movements').insert(movements)
      if (moveError) throw moveError

      if (paymentMethod === 'credit') {
        const { error: debtError } = await supabase.from('debt_transactions').insert({
          business_id: business.id,
          customer_id: selectedCustomer.id,
          sale_id: sale.id,
          type: 'credit_sale',
          amount: total,
          staff_user_id: activeStaff?.id || null,
          note: 'Credit sale',
        })
        if (debtError) throw debtError
      }

      setMessage(
        paymentMethod === 'credit'
          ? `Credit sale recorded for ${selectedCustomer.name} — UGX ${total.toLocaleString()}`
          : canSeeProfit
            ? `Sale completed — UGX ${total.toLocaleString()} (profit UGX ${totalProfit.toLocaleString()})`
            : `Sale completed — UGX ${total.toLocaleString()}`
      )
      setLastReceipt({
        businessName: business?.name || 'Shop',
        items: cart.map((i) => ({
          name: displayName(i.item),
          quantity: i.quantity,
          unitPrice: unitPriceFor(i),
        })),
        total,
        paymentMethod,
        customerName: paymentMethod === 'credit' ? selectedCustomer.name : null,
        date: new Date(),
      })
      setCart([])
      setPaymentMethod('cash')
      setSelectedCustomer(null)
      setCustomerSearch('')
      setTimeout(() => { setMessage(''); setLastReceipt(null) }, 15000)
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
                key={lineId(p)}
                onClick={() => addToCart(p)}
                disabled={qty <= 0}
                className="w-full text-left px-4 py-3 text-sm flex items-center justify-between hover:bg-paper disabled:opacity-40"
              >
                <div>
                  <div className="font-medium">{displayName(p)}</div>
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

        {message && (
          <div className="mb-3 bg-brand-light rounded-md px-3 py-2 space-y-2">
            <p className="text-sm text-brand-dark">{message}</p>
            {lastReceipt && !message.startsWith('Error') && (
              <button
                onClick={() => shareReceiptWhatsApp(lastReceipt)}
                className="text-xs font-medium text-white bg-[#25D366] rounded-md px-3 py-1.5 inline-flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.74.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.92 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.2 8.2 0 0 1 5.83 2.42 8.2 8.2 0 0 1 2.41 5.83c0 4.55-3.7 8.23-8.25 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.76-1.85-.2-.48-.41-.42-.56-.42-.14 0-.31-.01-.47-.01a.9.9 0 0 0-.66.31c-.23.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.17 1.74 2.66 4.22 3.73.59.25 1.05.4 1.41.52.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z"/>
                </svg>
                Share receipt on WhatsApp
              </button>
            )}
          </div>
        )}

        {cart.length === 0 ? (
          <p className="card px-4 py-8 text-center text-sm text-muted">No items added yet.</p>
        ) : (
          <div className="card divide-y divide-line mb-4">
            {cart.map((i) => {
              const id = lineId(i.item)
              const isManual = i.manualPrice !== null && i.manualPrice !== undefined
              const unitPrice = unitPriceFor(i)
              const lineProfit = i.quantity * (unitPrice - (i.item.cost_price || 0))
              const available = i.item.quantity_on_hand ?? 0
              const atMax = i.quantity >= available
              return (
                <div key={id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{displayName(i.item)}</div>
                      {!isManual && (
                        <div className="text-xs text-muted font-mono">
                          UGX {Number(unitPrice).toLocaleString()} each
                          {canSeeProfit && <span className="text-amber ml-2">+{lineProfit.toLocaleString()} profit</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(id, i.quantity - 1)} className="btn-secondary px-2 py-1 text-xs">−</button>
                      <span className="font-mono w-6 text-center">{i.quantity}</span>
                      <button
                        onClick={() => updateQty(id, i.quantity + 1)}
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
                        onChange={(e) => setManualPrice(id, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {cart.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-medium text-muted mb-2">Payment</div>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setPaymentMethodSafe('cash')}
                className={`flex-1 ${paymentMethod === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Cash
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethodSafe('credit')}
                className={`flex-1 ${paymentMethod === 'credit' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Credit (pay later)
              </button>
            </div>

            {paymentMethod === 'credit' && (
              <div className="card p-3 space-y-2">
                {selectedCustomer ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{selectedCustomer.name}</div>
                      {selectedCustomer.phone && <div className="text-xs text-muted">{selectedCustomer.phone}</div>}
                    </div>
                    <button type="button" onClick={() => setSelectedCustomer(null)} className="text-xs text-muted">
                      Change
                    </button>
                  </div>
                ) : addingCustomer ? (
                  <div className="space-y-2">
                    <input
                      autoFocus
                      className="input"
                      placeholder="Customer name"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                    />
                    <input
                      className="input"
                      placeholder="Phone (optional)"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setAddingCustomer(false)} className="btn-secondary flex-1 text-sm">
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={createCustomer}
                        disabled={customerBusy || !newCustomerName.trim()}
                        className="btn-primary flex-1 text-sm"
                      >
                        {customerBusy ? 'Saving…' : 'Add customer'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <input
                      className="input"
                      placeholder="Search customer…"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                    />
                    <div className="max-h-32 overflow-y-auto">
                      {filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCustomer(c)}
                          className="w-full text-left text-sm px-2 py-1.5 hover:bg-paper rounded"
                        >
                          {c.name} {c.phone && <span className="text-muted text-xs">· {c.phone}</span>}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setAddingCustomer(true); setNewCustomerName(customerSearch) }}
                      className="text-xs text-brand-dark font-medium"
                    >
                      + Add new customer
                    </button>
                  </>
                )}
              </div>
            )}
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

        <button
          onClick={completeSale}
          disabled={busy || cart.length === 0 || (paymentMethod === 'credit' && !selectedCustomer)}
          className="btn-primary w-full"
        >
          {busy ? 'Completing…' : paymentMethod === 'credit' ? 'Record credit sale' : 'Complete sale'}
        </button>
      </div>

      {scanning && <ScannerModal onResult={handleScan} onClose={() => setScanning(false)} />}
    </div>
  )
}
