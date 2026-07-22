import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ScannerModal, ScanIcon } from '../components/Scanner'
import { enqueueSale, getQueue, removeFromQueue, markSyncFailed, getFailedSales, clearFailedSales, queueCount } from '../lib/offlineQueue'

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

async function pushSaleToServer(business, saleData) {
  const productIds = saleData.items.filter((i) => !i.variant_id).map((i) => i.product_id)
  const variantIds = saleData.items.filter((i) => i.variant_id).map((i) => i.variant_id)

  let currentStock = []
  if (productIds.length > 0) {
    const { data } = await supabase
      .from('product_stock')
      .select('product_id, variant_id, quantity_on_hand')
      .eq('business_id', business.id)
      .is('variant_id', null)
      .in('product_id', productIds)
    currentStock = currentStock.concat(data || [])
  }
  if (variantIds.length > 0) {
    const { data } = await supabase
      .from('product_stock')
      .select('product_id, variant_id, quantity_on_hand')
      .eq('business_id', business.id)
      .in('variant_id', variantIds)
    currentStock = currentStock.concat(data || [])
  }

  const stockShortfalls = []
  for (const item of saleData.items) {
    const key = item.variant_id || item.product_id
    const stockRow = currentStock.find((s) => (s.variant_id || s.product_id) === key)
    const available = stockRow?.quantity_on_hand ?? 0
    if (available < item.quantity) {
      stockShortfalls.push({ name: item.displayName, available, needed: item.quantity })
    }
  }

  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      business_id: business.id,
      staff_user_id: saleData.staff_user_id,
      total_amount: saleData.total,
      is_credit: saleData.is_credit,
      customer_id: saleData.customer_id,
      ...(saleData.sale_date ? { created_at: new Date(saleData.sale_date).toISOString() } : {}),
    })
    .select()
    .single()
  if (saleError) throw saleError

  const saleItems = saleData.items.map((i) => ({
    sale_id: sale.id,
    product_id: i.product_id,
    variant_id: i.variant_id || null,
    quantity: i.quantity,
    unit_price: i.unit_price,
    unit_cost: i.unit_cost || 0,
  }))
  const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)
  if (itemsError) throw itemsError

  const movements = saleData.items.map((i) => ({
    product_id: i.product_id,
    variant_id: i.variant_id || null,
    business_id: business.id,
    type: 'sale',
    quantity: -i.quantity,
    staff_user_id: saleData.staff_user_id,
    note: `Sale ${sale.id}${saleData.queuedOffline ? ' (synced from offline)' : ''}${saleData.sale_date ? ' (backdated)' : ''}`,
    ...(saleData.sale_date ? { created_at: new Date(saleData.sale_date).toISOString() } : {}),
  }))
  const { error: moveError } = await supabase.from('stock_movements').insert(movements)
  if (moveError) throw moveError

  if (saleData.is_credit) {
    const { error: debtError } = await supabase.from('debt_transactions').insert({
      business_id: business.id,
      customer_id: saleData.customer_id,
      sale_id: sale.id,
      type: 'credit_sale',
      amount: saleData.total,
      staff_user_id: saleData.staff_user_id,
      note: 'Credit sale',
    })
    if (debtError) throw debtError
  }

  return { sale, stockShortfalls }
}

// Lets the owner record a sale as having happened earlier — e.g. they
// forgot to log yesterday's sale. Only rendered for owners; staff/cashiers
// never see it, so every sale they record is timestamped "now" as usual.
function BackdateControl({ show, onToggle, value, onChange }) {
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  return (
    <div className="mb-4">
      {!show ? (
        <button
          type="button"
          onClick={onToggle}
          className="text-xs text-muted underline decoration-dotted"
        >
          Forgot to log this earlier? Backdate this sale
        </button>
      ) : (
        <div className="card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">When did this sale actually happen?</span>
            <button type="button" onClick={() => { onToggle(); onChange('') }} className="text-xs text-muted">Cancel</button>
          </div>
          <input
            type="datetime-local"
            className="input font-mono text-sm"
            max={nowLocal}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <p className="text-[11px] text-muted">This sale will be recorded with that date/time instead of now, and stock will still be deducted.</p>
        </div>
      )}
    </div>
  )
}

// ── Cart Drawer (mobile only) ───────────────────────────────────────────────
function CartDrawer({
  open, onClose, cart, updateQty, setManualPrice, unitPriceFor, displayName, lineId,
  canSeeProfit, total, totalProfit, paymentMethod, setPaymentMethodSafe,
  selectedCustomer, setSelectedCustomer, customers, customerSearch,
  setCustomerSearch, filteredCustomers, addingCustomer, setAddingCustomer,
  newCustomerName, setNewCustomerName, newCustomerPhone, setNewCustomerPhone,
  createCustomer, customerBusy, completeSale, busy, message, lastReceipt,
  isOwner, showBackdate, setShowBackdate, backdateAt, setBackdateAt,
}) {
  if (!open) return null
  return (
    <div className="sell-drawer-overlay" onClick={onClose}>
      <div className="sell-drawer" onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div className="sell-drawer-handle" />

        <div className="sell-drawer-header">
          <h2 className="font-display text-base font-semibold">Current sale</h2>
          <button onClick={onClose} className="sell-drawer-close">✕</button>
        </div>

        <div className="sell-drawer-body">
          {message && (
            <div className="mb-3 bg-brand-light rounded-md px-3 py-2 space-y-2">
              <p className="text-sm text-brand-dark">{message}</p>
              {lastReceipt && !message.startsWith('Error') && (
                <button
                  onClick={() => shareReceiptWhatsApp(lastReceipt)}
                  className="text-xs font-medium text-white bg-[#25D366] rounded-md px-3 py-1.5 inline-flex items-center gap-1.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.74.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.92 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.2 8.2 0 0 1 5.83 2.42 8.2 8.2 0 0 1 2.41 5.83c0 4.55-3.7 8.23-8.25 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.76-1.85-.2-.48-.41-.42-.56-.42-.14 0-.31-.01-.47-.01a.9.9 0 0 0-.66.31c-.23.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.17 1.74 2.66 4.22 3.73.59.25 1.05.4 1.41.52.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z" />
                  </svg>
                  Share receipt on WhatsApp
                </button>
              )}
            </div>
          )}

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
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{displayName(i.item)}</div>
                      {!isManual && (
                        <div className="text-xs text-muted font-mono">
                          UGX {Number(unitPrice).toLocaleString()} each
                          {canSeeProfit && <span className="text-amber ml-2">+{lineProfit.toLocaleString()} profit</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => updateQty(id, i.quantity - 1)} className="btn-secondary px-2 py-1 text-xs">−</button>
                      <span className="font-mono w-6 text-center">{i.quantity}</span>
                      <button onClick={() => updateQty(id, i.quantity + 1)} disabled={atMax} className="btn-secondary px-2 py-1 text-xs disabled:opacity-40">+</button>
                    </div>
                  </div>
                  {isManual && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-brick whitespace-nowrap">No saved price:</span>
                      <input type="number" min="0" inputMode="numeric" placeholder="e.g. 5000"
                        className="input font-mono py-1 text-sm flex-1"
                        value={i.manualPrice}
                        onChange={(e) => setManualPrice(id, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Payment method */}
          <div className="mb-4">
            <div className="text-xs font-medium text-muted mb-2">Payment</div>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => setPaymentMethodSafe('cash')}
                className={`flex-1 ${paymentMethod === 'cash' ? 'btn-primary' : 'btn-secondary'}`}>Cash</button>
              <button type="button" onClick={() => setPaymentMethodSafe('credit')}
                className={`flex-1 ${paymentMethod === 'credit' ? 'btn-primary' : 'btn-secondary'}`}>Credit</button>
              <button type="button" onClick={() => setPaymentMethodSafe('installments')}
                className={`flex-1 ${paymentMethod === 'installments' ? 'btn-primary' : 'btn-secondary'}`}>Installments</button>
            </div>

            {paymentMethod === 'installments' && (
              <div className="card p-3 space-y-2">
                {!selectedCustomer ? (
                  <>
                    <div className="text-xs font-medium text-muted">Select customer</div>
                    <input className="input" placeholder="Search customer…" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
                    <div className="max-h-28 overflow-y-auto">
                      {filteredCustomers.map((c) => (
                        <button key={c.id} type="button" onClick={() => setSelectedCustomer(c)}
                          className="w-full text-left text-sm px-2 py-1.5 hover:bg-paper rounded">
                          {c.name} {c.phone && <span className="text-muted text-xs">· {c.phone}</span>}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => { setAddingCustomer(true); setNewCustomerName(customerSearch) }}
                      className="text-xs text-brand-dark font-medium">+ Add new customer</button>
                    {addingCustomer && (
                      <div className="space-y-2 pt-2 border-t border-line">
                        <input autoFocus className="input" placeholder="Customer name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
                        <input className="input" placeholder="Phone (optional)" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setAddingCustomer(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
                          <button type="button" onClick={createCustomer} disabled={customerBusy || !newCustomerName.trim()} className="btn-primary flex-1 text-sm">{customerBusy ? 'Saving…' : 'Add'}</button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <div><div className="text-sm font-medium">{selectedCustomer.name}</div></div>
                    <button type="button" onClick={() => setSelectedCustomer(null)} className="text-xs text-muted">Change</button>
                  </div>
                )}
                <div className="border-t border-line pt-2 space-y-2">
                  <div className="text-xs font-medium text-muted">Installment details</div>
                  <label className="block">
                    <span className="text-xs text-muted block mb-1">Amount per installment (UGX)</span>
                    <input type="number" min="1" className="input font-mono" placeholder="e.g. 50000"
                      value={installmentAmount} onChange={e => setInstallmentAmount(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted block mb-1">Frequency</span>
                    <select className="input" value={installmentFrequency} onChange={e => setInstallmentFrequency(e.target.value)}>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted block mb-1">First payment due</span>
                    <input type="date" className="input" min={new Date().toISOString().slice(0, 10)}
                      value={installmentFirstDue} onChange={e => setInstallmentFirstDue(e.target.value)} />
                  </label>
                </div>
              </div>
            )}

            {paymentMethod === 'credit' && (
              <div className="card p-3 space-y-2">
                {selectedCustomer ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{selectedCustomer.name}</div>
                      {selectedCustomer.phone && <div className="text-xs text-muted">{selectedCustomer.phone}</div>}
                    </div>
                    <button type="button" onClick={() => setSelectedCustomer(null)} className="text-xs text-muted">Change</button>
                  </div>
                ) : addingCustomer ? (
                  <div className="space-y-2">
                    <input autoFocus className="input" placeholder="Customer name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
                    <input className="input" placeholder="Phone (optional)" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setAddingCustomer(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
                      <button type="button" onClick={createCustomer} disabled={customerBusy || !newCustomerName.trim()} className="btn-primary flex-1 text-sm">
                        {customerBusy ? 'Saving…' : 'Add customer'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <input className="input" placeholder="Search customer…" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
                    <div className="max-h-32 overflow-y-auto">
                      {filteredCustomers.map((c) => (
                        <button key={c.id} type="button" onClick={() => setSelectedCustomer(c)}
                          className="w-full text-left text-sm px-2 py-1.5 hover:bg-paper rounded">
                          {c.name} {c.phone && <span className="text-muted text-xs">· {c.phone}</span>}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => { setAddingCustomer(true); setNewCustomerName(customerSearch) }}
                      className="text-xs text-brand-dark font-medium">+ Add new customer</button>
                  </>
                )}
              </div>
            )}
          </div>

          {isOwner && (
            <BackdateControl show={showBackdate} onToggle={() => setShowBackdate((v) => !v)} value={backdateAt} onChange={setBackdateAt} />
          )}

          {/* Total */}
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

          <button onClick={completeSale}
            disabled={busy || cart.length === 0 || ((paymentMethod === 'credit' || paymentMethod === 'installments') && !selectedCustomer)}
            className="btn-primary w-full py-3 text-base">
            {busy ? 'Completing…' : paymentMethod === 'credit' ? 'Record credit sale' : paymentMethod === 'installments' ? 'Record installment sale' : 'Complete sale — UGX ' + total.toLocaleString()}
          </button>
        </div>
      </div>

      <style>{`
        .sell-drawer-overlay {
          position: fixed; inset: 0; z-index: 50;
          background: rgba(0,0,0,0.4);
          display: flex; align-items: flex-end;
          animation: fadeIn 150ms ease;
        }
        .sell-drawer {
          width: 100%; max-height: 90vh;
          background: var(--color-paper-raised);
          border-radius: 20px 20px 0 0;
          display: flex; flex-direction: column;
          animation: slideUp 200ms ease;
        }
        .sell-drawer-handle {
          width: 40px; height: 4px; border-radius: 2px;
          background: var(--color-line); margin: 10px auto 4px;
          flex-shrink: 0;
        }
        .sell-drawer-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 20px 12px; flex-shrink: 0;
          border-bottom: 1px solid var(--color-line);
        }
        .sell-drawer-close {
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--color-paper); border: 1px solid var(--color-line);
          color: var(--color-muted); font-size: 12px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
        }
        .sell-drawer-body {
          flex: 1; overflow-y: auto; padding: 16px 16px 32px;
        }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function Sell() {
  const { business, activeStaff } = useAuth()
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [lastReceipt, setLastReceipt] = useState(null)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [pendingCount, setPendingCount] = useState(0)
  const [failedSales, setFailedSales] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [showCartDrawer, setShowCartDrawer] = useState(false)

  const canSeeProfit = activeStaff?.role === 'owner'
  const [scanning, setScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState('')
  const [justAddedId, setJustAddedId] = useState(null)
  const cartSectionRef = useRef(null)

  // Owner-only: record a sale that actually happened earlier (e.g. forgot
  // to log yesterday's sale). Empty string means "now", the normal case.
  const [backdateAt, setBackdateAt] = useState('')
  const [showBackdate, setShowBackdate] = useState(false)
  const isOwner = activeStaff?.role === 'owner'

  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [installmentAmount, setInstallmentAmount] = useState('')
  const [installmentFrequency, setInstallmentFrequency] = useState('monthly')
  const [installmentFirstDue, setInstallmentFirstDue] = useState('')
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

  useEffect(() => {
    setPendingCount(queueCount())
    setFailedSales(getFailedSales())
    function handleOnline() { setIsOnline(true); syncOfflineQueue() }
    function handleOffline() { setIsOnline(false) }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    if (navigator.onLine) syncOfflineQueue()
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [business])

  async function syncOfflineQueue() {
    if (!business || syncing) return
    // Only try entries that haven't permanently failed
    const queue = getQueue().filter(e => !e.permanentlyFailed)
    if (queue.length === 0) {
      setFailedSales(getFailedSales())
      return
    }
    setSyncing(true)
    const shortfallMessages = []
    let synced = 0
    for (const entry of queue) {
      try {
        const { stockShortfalls } = await pushSaleToServer(business, entry.saleData)
        removeFromQueue(entry.localId)
        synced++
        if (stockShortfalls.length > 0) {
          shortfallMessages.push(...stockShortfalls.map((s) => `${s.name}: only ${s.available} left but ${s.needed} were sold offline.`))
        }
      } catch (err) {
        // Mark this entry as a failed attempt — after 3 attempts it becomes permanently failed
        markSyncFailed(entry.localId)
        console.error('Offline sale sync failed:', err)
        // Don't break — keep trying the next entries
      }
    }
    setPendingCount(queueCount())
    setFailedSales(getFailedSales())
    setSyncing(false)
    if (shortfallMessages.length > 0) {
      setMessage(`⚠ Synced, but please check stock: ${shortfallMessages.join(' ')}`)
    } else if (synced > 0) {
      setMessage(`✓ Synced ${synced} offline sale${synced === 1 ? '' : 's'}.`)
      setTimeout(() => setMessage(''), 5000)
    }
  }

  async function loadCustomers() {
    const { data } = await supabase
      .from('customers').select('id, name, phone')
      .eq('business_id', business.id).eq('is_active', true).order('name')
    setCustomers(data || [])
  }

  async function createCustomer() {
    if (!newCustomerName.trim()) return
    setCustomerBusy(true)
    const { data, error: err } = await supabase
      .from('customers')
      .insert({ business_id: business.id, name: newCustomerName.trim(), phone: newCustomerPhone || null })
      .select().single()
    setCustomerBusy(false)
    if (err) { setMessage(`Error: ${err.message}`); return }
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
      setSelectedCustomer(null); setCustomerSearch(''); setAddingCustomer(false)
      setInstallmentAmount(''); setInstallmentFirstDue('')
    }
  }

  const filtered = items.filter((p) =>
    displayName(p).toLowerCase().includes(search.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(search.toLowerCase())
  )

  function addToCart(item) {
    const hasPrice = Number(item.selling_price) > 0
    const available = item.quantity_on_hand ?? 0
    let added = false
    setCart((c) => {
      const existing = c.find((i) => lineId(i.item) === lineId(item))
      if (existing) {
        if (existing.quantity >= available) {
          setMessage(`Error: only ${available} of ${displayName(item)} in stock.`)
          return c
        }
        added = true
        return c.map((i) => lineId(i.item) === lineId(item) ? { ...i, quantity: i.quantity + 1 } : i)
      }
      if (available <= 0) { setMessage(`Error: ${displayName(item)} is out of stock.`); return c }
      added = true
      return [...c, { item, quantity: 1, manualPrice: hasPrice ? null : '' }]
    })
    if (added) {
      const id = lineId(item)
      setJustAddedId(id)
      setTimeout(() => setJustAddedId((cur) => cur === id ? null : cur), 900)
    }
  }

  function setManualPrice(id, value) {
    setCart((c) => c.map((i) => lineId(i.item) === id ? { ...i, manualPrice: value } : i))
  }

  function unitPriceFor(i) {
    if (i.manualPrice !== null && i.manualPrice !== undefined) return Number(i.manualPrice) || 0
    return Number(i.item.selling_price) || 0
  }

  function handleScan(code) {
    const match = items.find((p) => p.barcode && p.barcode === code)
    setScanning(false)
    if (match) {
      const available = match.quantity_on_hand ?? 0
      const inCart = cart.find((i) => lineId(i.item) === lineId(match))
      if ((inCart?.quantity ?? 0) >= available) {
        setScanMessage(`${displayName(match)} is out of stock.`)
      } else {
        addToCart(match)
        setScanMessage(`Added: ${displayName(match)}`)
      }
    } else {
      setScanMessage(`No product matches "${code}".`)
    }
    setTimeout(() => setScanMessage(''), 4000)
  }

  function updateQty(id, qty) {
    setCart((c) =>
      c.map((i) => {
        if (lineId(i.item) !== id) return i
        const available = i.item.quantity_on_hand ?? 0
        if (qty > available) { setMessage(`Error: only ${available} in stock.`); return i }
        return { ...i, quantity: qty }
      }).filter((i) => i.quantity > 0)
    )
  }

  const total = cart.reduce((sum, i) => sum + i.quantity * unitPriceFor(i), 0)
  const totalProfit = cart.reduce((sum, i) => sum + i.quantity * (unitPriceFor(i) - (i.item.cost_price || 0)), 0)
  const totalQty = cart.reduce((sum, i) => sum + i.quantity, 0)

  async function completeSale() {
    if (cart.length === 0) return
    const missingPrice = cart.find((i) => unitPriceFor(i) <= 0)
    if (missingPrice) { setMessage(`Error: enter a price for ${displayName(missingPrice.item)}.`); return }
    if ((paymentMethod === 'credit' || paymentMethod === 'installments') && !selectedCustomer) { setMessage('Error: pick or add a customer.'); return }
    if (paymentMethod === 'installments' && (!installmentAmount || !installmentFirstDue)) { setMessage('Error: fill in installment amount and first due date.'); return }
    setBusy(true)

    const saleData = {
      staff_user_id: activeStaff?.id || null,
      total,
      is_credit: paymentMethod === 'credit' || paymentMethod === 'installments',
      customer_id: (paymentMethod === 'credit' || paymentMethod === 'installments') ? selectedCustomer.id : null,
      is_installment: paymentMethod === 'installments',
      sale_date: isOwner && backdateAt ? backdateAt : null,
      items: cart.map((i) => ({
        product_id: i.item.product_id,
        variant_id: i.item.variant_id || null,
        displayName: displayName(i.item),
        quantity: i.quantity,
        unit_price: unitPriceFor(i),
        unit_cost: i.item.cost_price || 0,
      })),
    }

    const receiptData = {
      businessName: business?.name || 'Shop',
      items: cart.map((i) => ({ name: displayName(i.item), quantity: i.quantity, unitPrice: unitPriceFor(i) })),
      total, paymentMethod,
      customerName: paymentMethod === 'credit' ? selectedCustomer.name : null,
      date: saleData.sale_date ? new Date(saleData.sale_date) : new Date(),
    }

    async function createInstallmentPlan(saleId) {
      if (paymentMethod !== 'installments') return
      await supabase.from('installment_plans').insert({
        business_id: business.id,
        customer_id: selectedCustomer.id,
        sale_id: saleId,
        total_amount: total,
        amount_paid: 0,
        installment_amount: Number(installmentAmount),
        frequency: installmentFrequency,
        next_due_date: installmentFirstDue,
        note: `Sale installment plan`,
      })
      setInstallmentAmount(''); setInstallmentFrequency('monthly'); setInstallmentFirstDue('')
    }

    function onSuccess(shortfalls) {
      if (shortfalls.length > 0) {
        setMessage(`⚠ Sale done, but check stock: ${shortfalls.map((s) => s.name).join(', ')}.`)
      } else {
        setMessage(
          paymentMethod === 'credit'
            ? `Credit sale for ${selectedCustomer.name} — UGX ${total.toLocaleString()}`
            : canSeeProfit
              ? `Sale done — UGX ${total.toLocaleString()} (profit UGX ${totalProfit.toLocaleString()})`
              : `Sale done — UGX ${total.toLocaleString()}`
        )
      }
      setLastReceipt(receiptData)
      setCart([]); setPaymentMethod('cash'); setSelectedCustomer(null); setCustomerSearch('')
      setShowCartDrawer(false)
      setBackdateAt(''); setShowBackdate(false)
      setTimeout(() => { setMessage(''); setLastReceipt(null) }, 15000)
    }

    function onOffline() {
      enqueueSale(saleData)
      setPendingCount(queueCount())
      setMessage(`📴 No connection — sale saved and will sync automatically (UGX ${total.toLocaleString()}).`)
      setLastReceipt(receiptData)
      setCart([]); setPaymentMethod('cash'); setSelectedCustomer(null); setCustomerSearch('')
      setShowCartDrawer(false)
      setBackdateAt(''); setShowBackdate(false)
      setTimeout(() => { setMessage(''); setLastReceipt(null) }, 15000)
    }

    if (!navigator.onLine) { onOffline(); setBusy(false); return }

    try {
      const { stockShortfalls, sale } = await pushSaleToServer(business, saleData)
      await createInstallmentPlan(sale?.id)
      onSuccess(stockShortfalls)
    } catch {
      onOffline()
    } finally {
      setBusy(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      <div className="grid md:grid-cols-2 gap-6">
        {(!isOnline || pendingCount > 0) && (
          <div className="md:col-span-2 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-700 rounded-md px-4 py-2 text-sm font-medium">
            <span>{!isOnline ? '📴' : '🔄'}</span>
            <span>
              {!isOnline
                ? `Offline${pendingCount > 0 ? ` — ${pendingCount} sale${pendingCount === 1 ? '' : 's'} waiting to sync` : ' — sales will be saved on this device'}`
                : syncing ? 'Syncing offline sales…'
                  : `${pendingCount} offline sale${pendingCount === 1 ? '' : 's'} waiting to sync`}
            </span>
          </div>
        )}

        {failedSales.length > 0 && (
          <div className="md:col-span-2 bg-brick/10 border border-brick/30 text-brick rounded-md px-4 py-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold mb-1">⚠ {failedSales.length} sale{failedSales.length > 1 ? 's' : ''} failed to sync</div>
                <p className="text-xs opacity-80 mb-2">
                  These sales were recorded offline but could not be saved to the server after 3 attempts.
                  Please record them manually or contact support.
                </p>
                <div className="space-y-1">
                  {failedSales.map(entry => (
                    <div key={entry.localId} className="text-xs font-mono bg-brick/10 rounded px-2 py-1">
                      {new Date(entry.queuedAt).toLocaleString('en-UG', { dateStyle: 'short', timeStyle: 'short' })}
                      {' · '}UGX {Number(entry.saleData?.total || 0).toLocaleString()}
                      {entry.saleData?.items?.length > 0 && ` · ${entry.saleData.items.length} item${entry.saleData.items.length > 1 ? 's' : ''}`}
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => { clearFailedSales(); setFailedSales([]) }}
                className="text-xs font-medium underline shrink-0 mt-0.5"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ── Products column ── */}
        <div>
          <h1 className="font-display text-xl font-semibold mb-1">Sell</h1>
          <p className="text-muted text-sm mb-4">Tap a product to add it to the sale.</p>

          {message && (
            <div className="mb-3 bg-brand-light rounded-md px-3 py-2 space-y-2 md:hidden">
              <p className="text-sm text-brand-dark">{message}</p>
              {lastReceipt && !message.startsWith('Error') && (
                <button onClick={() => shareReceiptWhatsApp(lastReceipt)}
                  className="text-xs font-medium text-white bg-[#25D366] rounded-md px-3 py-1.5 inline-flex items-center gap-1.5">
                  Share receipt on WhatsApp
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2 mb-3">
            <input className="input flex-1" placeholder="Search product…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
            <button type="button" onClick={() => setScanning(true)} className="btn-secondary px-3" aria-label="Scan code">
              <ScanIcon />
            </button>
          </div>

          {scanMessage && (
            <p className="text-sm text-brand-dark bg-brand-light rounded-md px-3 py-2 mb-3">{scanMessage}</p>
          )}

          <div className="card divide-y divide-line overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            {filtered.map((p) => {
              const qty = p.quantity_on_hand ?? 0
              const noPrice = !p.selling_price || Number(p.selling_price) <= 0
              const justAdded = justAddedId === lineId(p)
              const inCart = cart.find(i => lineId(i.item) === lineId(p))
              return (
                <button key={lineId(p)} onClick={() => addToCart(p)} disabled={qty <= 0}
                  style={justAdded ? { backgroundColor: 'var(--color-brand-light)' } : undefined}
                  className="w-full text-left px-4 py-3 text-sm flex items-center justify-between md:hover:bg-paper disabled:opacity-40 transition-colors duration-200">
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="font-medium truncate">{displayName(p)}</div>
                    <div className="text-xs text-muted">
                      {noPrice
                        ? <span className="text-brick">No saved price</span>
                        : `UGX ${Number(p.selling_price).toLocaleString()}`
                      }
                      {' · '}{qty} in stock
                      {inCart && <span className="ml-2 text-brand font-semibold">(in cart: {inCart.quantity})</span>}
                    </div>
                  </div>
                  <span className={`font-mono w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all duration-200 shrink-0 ${justAdded ? 'bg-brand text-white scale-110' : 'bg-paper border border-line text-brand-dark'
                    }`}>
                    {justAdded ? '✓' : '+'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Desktop cart column (hidden on mobile) ── */}
        <div ref={cartSectionRef} className="hidden md:block scroll-mt-4">
          <div className="mb-3 pb-2 ledger-rule">
            <h2 className="font-display text-sm font-semibold">Current sale</h2>
          </div>

          {message && (
            <div className="mb-3 bg-brand-light rounded-md px-3 py-2 space-y-2">
              <p className="text-sm text-brand-dark">{message}</p>
              {lastReceipt && !message.startsWith('Error') && (
                <button onClick={() => shareReceiptWhatsApp(lastReceipt)}
                  className="text-xs font-medium text-white bg-[#25D366] rounded-md px-3 py-1.5 inline-flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.74.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.92 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.2 8.2 0 0 1 5.83 2.42 8.2 8.2 0 0 1 2.41 5.83c0 4.55-3.7 8.23-8.25 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.76-1.85-.2-.48-.41-.42-.56-.42-.14 0-.31-.01-.47-.01a.9.9 0 0 0-.66.31c-.23.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.17 1.74 2.66 4.22 3.73.59.25 1.05.4 1.41.52.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z" />
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
                        <button onClick={() => updateQty(id, i.quantity + 1)} disabled={atMax} className="btn-secondary px-2 py-1 text-xs disabled:opacity-40">+</button>
                      </div>
                    </div>
                    {isManual && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-brick whitespace-nowrap">No saved price — enter sale price:</span>
                        <input type="number" min="0" inputMode="numeric" placeholder="e.g. 5000"
                          className="input font-mono py-1 text-sm"
                          value={i.manualPrice}
                          onChange={(e) => setManualPrice(id, e.target.value)} />
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
                <button type="button" onClick={() => setPaymentMethodSafe('cash')}
                  className={`flex-1 ${paymentMethod === 'cash' ? 'btn-primary' : 'btn-secondary'}`}>Cash</button>
                <button type="button" onClick={() => setPaymentMethodSafe('credit')}
                  className={`flex-1 ${paymentMethod === 'credit' ? 'btn-primary' : 'btn-secondary'}`}>Credit</button>
                <button type="button" onClick={() => setPaymentMethodSafe('installments')}
                  className={`flex-1 ${paymentMethod === 'installments' ? 'btn-primary' : 'btn-secondary'}`}>Installments</button>
              </div>
              {paymentMethod === 'installments' && (
                <div className="card p-3 space-y-2">
                  {!selectedCustomer ? (
                    <>
                      <div className="text-xs font-medium text-muted">Select customer</div>
                      <input className="input" placeholder="Search customer…" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
                      <div className="max-h-28 overflow-y-auto">
                        {filteredCustomers.map((c) => (
                          <button key={c.id} type="button" onClick={() => setSelectedCustomer(c)}
                            className="w-full text-left text-sm px-2 py-1.5 hover:bg-paper rounded">
                            {c.name} {c.phone && <span className="text-muted text-xs">· {c.phone}</span>}
                          </button>
                        ))}
                      </div>
                      <button type="button" onClick={() => { setAddingCustomer(true); setNewCustomerName(customerSearch) }}
                        className="text-xs text-brand-dark font-medium">+ Add new customer</button>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div><div className="text-sm font-medium">{selectedCustomer.name}</div></div>
                      <button type="button" onClick={() => setSelectedCustomer(null)} className="text-xs text-muted">Change</button>
                    </div>
                  )}
                  <div className="border-t border-line pt-2 space-y-2">
                    <div className="text-xs font-medium text-muted">Installment details</div>
                    <label className="block">
                      <span className="text-xs text-muted block mb-1">Amount per installment (UGX)</span>
                      <input type="number" min="1" className="input font-mono" placeholder="e.g. 50000"
                        value={installmentAmount} onChange={e => setInstallmentAmount(e.target.value)} />
                    </label>
                    <label className="block">
                      <span className="text-xs text-muted block mb-1">Frequency</span>
                      <select className="input" value={installmentFrequency} onChange={e => setInstallmentFrequency(e.target.value)}>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs text-muted block mb-1">First payment due</span>
                      <input type="date" className="input" min={new Date().toISOString().slice(0, 10)}
                        value={installmentFirstDue} onChange={e => setInstallmentFirstDue(e.target.value)} />
                    </label>
                  </div>
                </div>
              )}
              {paymentMethod === 'credit' && (
                <div className="card p-3 space-y-2">
                  {selectedCustomer ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{selectedCustomer.name}</div>
                        {selectedCustomer.phone && <div className="text-xs text-muted">{selectedCustomer.phone}</div>}
                      </div>
                      <button type="button" onClick={() => setSelectedCustomer(null)} className="text-xs text-muted">Change</button>
                    </div>
                  ) : addingCustomer ? (
                    <div className="space-y-2">
                      <input autoFocus className="input" placeholder="Customer name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
                      <input className="input" placeholder="Phone (optional)" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setAddingCustomer(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
                        <button type="button" onClick={createCustomer} disabled={customerBusy || !newCustomerName.trim()} className="btn-primary flex-1 text-sm">
                          {customerBusy ? 'Saving…' : 'Add customer'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <input className="input" placeholder="Search customer…" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
                      <div className="max-h-32 overflow-y-auto">
                        {filteredCustomers.map((c) => (
                          <button key={c.id} type="button" onClick={() => setSelectedCustomer(c)}
                            className="w-full text-left text-sm px-2 py-1.5 hover:bg-paper rounded">
                            {c.name} {c.phone && <span className="text-muted text-xs">· {c.phone}</span>}
                          </button>
                        ))}
                      </div>
                      <button type="button" onClick={() => { setAddingCustomer(true); setNewCustomerName(customerSearch) }}
                        className="text-xs text-brand-dark font-medium">+ Add new customer</button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {isOwner && (
            <BackdateControl show={showBackdate} onToggle={() => setShowBackdate((v) => !v)} value={backdateAt} onChange={setBackdateAt} />
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
          <button onClick={completeSale}
            disabled={busy || cart.length === 0 || ((paymentMethod === 'credit' || paymentMethod === 'installments') && !selectedCustomer)}
            className="btn-primary w-full">
            {busy ? 'Completing…' : paymentMethod === 'credit' ? 'Record credit sale' : paymentMethod === 'installments' ? 'Record installment sale' : 'Complete sale'}
          </button>
        </div>
      </div>

      {/* ── Mobile cart bar (always visible when cart has items) ── */}
      {cart.length > 0 && (
        <button type="button" onClick={() => setShowCartDrawer(true)}
          className="md:hidden fixed bottom-16 left-0 right-0 z-30 mx-3 mb-1 rounded-xl shadow-lg overflow-hidden"
          style={{ background: 'var(--color-brand)' }}>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold">
                {totalQty}
              </span>
              <span className="text-white font-medium text-sm">View sale</span>
            </div>
            <span className="text-white font-mono font-semibold">UGX {total.toLocaleString()}</span>
          </div>
        </button>
      )}

      {/* ── Mobile cart drawer ── */}
      <CartDrawer
        open={showCartDrawer}
        onClose={() => setShowCartDrawer(false)}
        cart={cart}
        updateQty={updateQty}
        setManualPrice={setManualPrice}
        unitPriceFor={unitPriceFor}
        displayName={displayName}
        lineId={lineId}
        canSeeProfit={canSeeProfit}
        total={total}
        totalProfit={totalProfit}
        paymentMethod={paymentMethod}
        setPaymentMethodSafe={setPaymentMethodSafe}
        selectedCustomer={selectedCustomer}
        setSelectedCustomer={setSelectedCustomer}
        customers={customers}
        customerSearch={customerSearch}
        setCustomerSearch={setCustomerSearch}
        filteredCustomers={filteredCustomers}
        addingCustomer={addingCustomer}
        setAddingCustomer={setAddingCustomer}
        newCustomerName={newCustomerName}
        setNewCustomerName={setNewCustomerName}
        newCustomerPhone={newCustomerPhone}
        setNewCustomerPhone={setNewCustomerPhone}
        createCustomer={createCustomer}
        customerBusy={customerBusy}
        completeSale={completeSale}
        isOwner={isOwner}
        showBackdate={showBackdate}
        setShowBackdate={setShowBackdate}
        backdateAt={backdateAt}
        setBackdateAt={setBackdateAt}
        busy={busy}
        message={message}
        lastReceipt={lastReceipt}
      />

      {scanning && <ScannerModal onResult={handleScan} onClose={() => setScanning(false)} />}
    </>
  )
}