import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import BackdateControl from '../components/BackdateControl'

function displayName(item) {
  return item.variant_name ? `${item.product_name} — ${item.variant_name}` : item.product_name
}

export default function StockIn() {
  const { business, activeStaff, setBusiness } = useAuth()
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
  const [backdateAt, setBackdateAt] = useState('')
  const [showBackdate, setShowBackdate] = useState(false)
  const isOwner = activeStaff?.role === 'owner'

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
    const backdateISO = isOwner && backdateAt ? new Date(backdateAt).toISOString() : null
    await supabase.from('stock_movements').insert({
      product_id: selected.product_id,
      variant_id: selected.variant_id || null,
      business_id: business.id,
      type: 'restock',
      quantity: Number(quantity),
      unit_cost: unitCost ? Number(unitCost) : null,
      supplier_id: supplierId || null,
      note: note ? (backdateISO ? `${note} (backdated)` : note) : (backdateISO ? 'Backdated restock' : null),
      staff_user_id: activeStaff?.id || null,
      ...(backdateISO ? { created_at: backdateISO } : {}),
    })

    // If a cost was entered and differs from the product's current cost price, update it
    if (unitCost && Number(unitCost) > 0) {
      const table = selected.variant_id ? 'product_variants' : 'products'
      const idField = selected.variant_id ? selected.variant_id : selected.product_id
      await supabase.from(table).update({ cost_price: Number(unitCost) }).eq('id', idField)
    }

    // A cost was entered — deduct what was just spent from the capital
    // balance and log it, so the owner can see exactly what their money
    // went to (and the Spending tab's Today/Yesterday/etc totals pick it up).
    let newBalance = null
    const totalCost = unitCost && Number(unitCost) > 0 ? Number(unitCost) * Number(quantity) : 0
    if (totalCost > 0 && business) {
      newBalance = Number(business.capital_balance || 0) - totalCost
      await supabase.from('businesses').update({ capital_balance: newBalance }).eq('id', business.id)
      await supabase.from('capital_transactions').insert({
        business_id: business.id,
        type: 'stock_purchase',
        amount: -totalCost,
        product_id: selected.product_id,
        variant_id: selected.variant_id || null,
        note: `Restock: ${quantity} x ${displayName(selected)}${backdateISO ? ' (backdated)' : ''}`,
        staff_user_id: activeStaff?.id || null,
        ...(backdateISO ? { created_at: backdateISO } : {}),
      })
      setBusiness({ ...business, capital_balance: newBalance })
    }

    const supplierName = suppliers.find((s) => s.id === supplierId)?.name
    const addedLine = `Added ${quantity} of ${displayName(selected)} to stock${supplierName ? ` from ${supplierName}` : ''}.`
    setMessage(
      totalCost > 0
        ? `${addedLine} You've used UGX ${totalCost.toLocaleString()} on ${displayName(selected)} — capital balance UGX ${newBalance.toLocaleString()}.`
        : addedLine
    )
    setSelected(null)
    setQuantity('')
    setUnitCost('')
    setSupplierId('')
    setNote('')
    setSearch('')
    setBackdateAt('')
    setShowBackdate(false)
    setBusy(false)
    loadProducts()
    setTimeout(() => setMessage(''), 6000)
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

      {business && (
        activeStaff?.role === 'owner' ? (
          <Link
            to="/spending"
            className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${Number(business.capital_balance || 0) < 0 ? 'bg-brick/10 text-brick' : 'bg-paper-raised border border-line'
              }`}
          >
            <span className="text-muted">Capital balance</span>
            <span className="font-mono font-semibold">UGX {Number(business.capital_balance || 0).toLocaleString()} →</span>
          </Link>
        ) : (
          <div className="flex items-center justify-between rounded-md px-3 py-2 text-sm bg-paper-raised border border-line">
            <span className="text-muted">Capital balance</span>
            <span className="font-mono font-semibold">UGX {Number(business.capital_balance || 0).toLocaleString()}</span>
          </div>
        )
      )}

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

          {isOwner && (
            <BackdateControl
              show={showBackdate} onToggle={() => setShowBackdate((v) => !v)} value={backdateAt} onChange={setBackdateAt}
              linkLabel="Forgot to log this earlier? Backdate this restock"
              prompt="When did this restock actually happen?"
              hint="This restock — and the capital spent on it — will be recorded with that date/time instead of now."
            />
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Saving…' : 'Add to stock'}
          </button>
        </form>
      )}

      {showHistory && (
        <SuppliersPanel business={business} suppliers={suppliers} activeStaff={activeStaff} onClose={() => setShowHistory(false)} onChanged={loadSuppliers} />
      )}
    </div>
  )
}

function SuppliersPanel({ business, suppliers, activeStaff, onClose, onChanged }) {
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
      ; (data || []).forEach((m) => {
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
            activeStaff={activeStaff}
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

function SupplierHistory({ business, supplier, onBack, activeStaff }) {
  const [movements, setMovements] = useState([])
  const [debts, setDebts] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('debts') // 'debts' | 'history'

  // Debt form
  const [showDebtForm, setShowDebtForm] = useState(false)
  const [debtAmount, setDebtAmount] = useState('')
  const [debtNote, setDebtNote] = useState('')
  const [debtBusy, setDebtBusy] = useState(false)

  // Payment
  const [payingDebtId, setPayingDebtId] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')
  const [payBusy, setPayBusy] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: moves }, { data: debtData }] = await Promise.all([
      supabase.from('stock_movements')
        .select('id, quantity, unit_cost, note, created_at, products(name), product_variants(name)')
        .eq('business_id', business.id).eq('supplier_id', supplier.id).eq('type', 'restock')
        .order('created_at', { ascending: false }),
      supabase.from('supplier_debts')
        .select('*, supplier_payments(id, amount, note, paid_at)')
        .eq('business_id', business.id).eq('supplier_id', supplier.id)
        .order('created_at', { ascending: false }),
    ])
    setMovements(moves || [])
    setDebts(debtData || [])
    setLoading(false)
  }

  async function addDebt(e) {
    e.preventDefault()
    if (!debtAmount) return
    setDebtBusy(true)
    await supabase.from('supplier_debts').insert({
      business_id: business.id,
      supplier_id: supplier.id,
      total_amount: Number(debtAmount),
      amount_paid: 0,
      note: debtNote || null,
    })
    setDebtAmount(''); setDebtNote(''); setShowDebtForm(false)
    load()
    setDebtBusy(false)
  }

  async function recordPayment(debt) {
    const amt = Number(payAmount)
    if (!amt || amt <= 0) return
    setPayBusy(true)
    const newPaid = Math.min(Number(debt.amount_paid) + amt, Number(debt.total_amount))
    await Promise.all([
      supabase.from('supplier_payments').insert({
        business_id: business.id, supplier_id: supplier.id,
        debt_id: debt.id, amount: amt,
        note: payNote || null, staff_user_id: activeStaff?.id || null,
      }),
      supabase.from('supplier_debts').update({ amount_paid: newPaid }).eq('id', debt.id),
    ])
    setPayAmount(''); setPayNote(''); setPayingDebtId(null)
    load()
    setPayBusy(false)
  }

  const totalSpent = movements.reduce((s, m) => s + (Number(m.unit_cost) || 0) * Number(m.quantity), 0)
  const totalOwed = debts.reduce((s, d) => s + Math.max(0, Number(d.total_amount) - Number(d.amount_paid)), 0)

  return (
    <div>
      <button onClick={onBack} className="text-xs text-brand-dark font-medium mb-3">← All suppliers</button>
      <div className="mb-3">
        <div className="font-medium">{supplier.name}</div>
        <div className="text-xs text-muted">{supplier.phone || 'No phone saved'}</div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="card px-3 py-2">
          <div className="text-xs text-muted mb-0.5">Total spent</div>
          <div className="font-mono font-semibold text-sm">UGX {totalSpent.toLocaleString()}</div>
        </div>
        <div className={`card px-3 py-2 ${totalOwed > 0 ? 'border-brick/40 bg-brick/5' : ''}`}>
          <div className="text-xs text-muted mb-0.5">Still owe them</div>
          <div className={`font-mono font-semibold text-sm ${totalOwed > 0 ? 'text-brick' : 'text-brand'}`}>
            UGX {totalOwed.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-paper rounded-md p-1 border border-line mb-4">
        {[['debts', 'Debts & Payments'], ['history', 'Restock History']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${tab === key ? 'bg-paper-raised shadow-sm text-ink border border-line' : 'text-muted'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-muted">Loading…</p> : tab === 'history' ? (
        // ── Restock history tab ──
        movements.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">No restocks from this supplier yet.</p>
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
        )
      ) : (
        // ── Debts tab ──
        <div className="space-y-3">
          {/* Add debt button */}
          {!showDebtForm && (
            <button onClick={() => setShowDebtForm(true)}
              className="btn-primary w-full text-sm">
              + Record debt from this supplier
            </button>
          )}

          {showDebtForm && (
            <form onSubmit={addDebt} className="card p-3 space-y-2">
              <div className="text-xs font-semibold text-muted">New supplier debt</div>
              <label className="block">
                <span className="text-xs text-muted block mb-1">Total amount owed (UGX)</span>
                <input required type="number" min="1" className="input font-mono"
                  placeholder="e.g. 500000" value={debtAmount}
                  onChange={e => setDebtAmount(e.target.value)} autoFocus />
              </label>
              <label className="block">
                <span className="text-xs text-muted block mb-1">Note (optional)</span>
                <input className="input" placeholder="e.g. 10 phones on credit"
                  value={debtNote} onChange={e => setDebtNote(e.target.value)} />
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowDebtForm(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
                <button type="submit" disabled={debtBusy} className="btn-primary flex-1 text-sm">
                  {debtBusy ? 'Saving…' : 'Save debt'}
                </button>
              </div>
            </form>
          )}

          {/* Debt list */}
          {debts.length === 0 ? (
            <p className="text-sm text-muted text-center py-6">No debts recorded for this supplier.</p>
          ) : debts.map(debt => {
            const paid = Number(debt.amount_paid)
            const total = Number(debt.total_amount)
            const remaining = total - paid
            const pct = Math.min(100, Math.round((paid / total) * 100))
            const isPaying = payingDebtId === debt.id
            const isSettled = remaining <= 0

            return (
              <div key={debt.id} className="card p-3">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-sm font-medium">
                      {isSettled ? '✅ Settled' : `UGX ${remaining.toLocaleString()} remaining`}
                    </div>
                    {debt.note && <div className="text-xs text-muted mt-0.5">{debt.note}</div>}
                    <div className="text-xs text-muted">{new Date(debt.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isSettled ? 'bg-brand-light text-brand' : 'bg-brick/10 text-brick'}`}>
                    {isSettled ? 'Paid' : 'Owing'}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs text-muted mb-1">
                    <span>Paid: UGX {paid.toLocaleString()}</span>
                    <span>Total: UGX {total.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-line rounded-full overflow-hidden">
                    <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-muted mt-1">{pct}% paid</div>
                </div>

                {/* Payment history */}
                {(debt.supplier_payments || []).length > 0 && (
                  <div className="border-t border-line pt-2 mb-2">
                    <div className="text-xs text-muted mb-1 font-medium">Payment history</div>
                    {(debt.supplier_payments || []).map(p => (
                      <div key={p.id} className="flex justify-between text-xs text-muted py-0.5">
                        <span>{new Date(p.paid_at).toLocaleDateString()}{p.note ? ` · ${p.note}` : ''}</span>
                        <span className="font-mono">UGX {Number(p.amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Record payment */}
                {!isSettled && (
                  isPaying ? (
                    <div className="space-y-2 pt-2 border-t border-line">
                      <input type="number" min="1" className="input font-mono text-sm"
                        placeholder="Amount paid today (UGX)"
                        value={payAmount} onChange={e => setPayAmount(e.target.value)} autoFocus />
                      <input className="input text-sm"
                        placeholder="Note e.g. mobile money (optional)"
                        value={payNote} onChange={e => setPayNote(e.target.value)} />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setPayingDebtId(null); setPayAmount(''); setPayNote('') }}
                          className="btn-secondary flex-1 text-sm">Cancel</button>
                        <button type="button" onClick={() => recordPayment(debt)}
                          disabled={payBusy || !payAmount}
                          className="btn-primary flex-1 text-sm">
                          {payBusy ? '…' : 'Record payment'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setPayingDebtId(debt.id); setPayAmount('') }}
                      className="btn-primary w-full text-sm mt-1">
                      Record payment to supplier
                    </button>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}