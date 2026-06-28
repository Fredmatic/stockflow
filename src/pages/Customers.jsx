import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { canAccess } from '../lib/permissions'

// Returns { days, overdue } relative to today
function getDeadlineStatus(dueDateStr) {
  if (!dueDateStr) return null
  const due = new Date(dueDateStr)
  due.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffMs = due - today
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return { days, overdue: days < 0 }
}

function DeadlineBadge({ customer }) {
  const status = getDeadlineStatus(customer.payment_due_date)
  if (!status || Number(customer.balance) <= 0) return null

  if (status.overdue) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-white bg-brick rounded-full px-2 py-0.5">
        ⚠ {Math.abs(status.days)}d overdue
      </span>
    )
  }
  if (status.days === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-white bg-amber-500 rounded-full px-2 py-0.5">
        ⏰ Due today
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-dark bg-brand-light rounded-full px-2 py-0.5">
      ⏱ {status.days}d left
    </span>
  )
}

export default function Customers() {
  const { business, activeStaff } = useAuth()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (business) load()
  }, [business])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('debtor_summary')
      .select('*')
      .eq('business_id', business.id)
      .order('balance', { ascending: false })

    // Fetch deadline fields separately since debtor_summary view may not include them
    const ids = (data || []).map((c) => c.customer_id)
    let deadlineMap = {}
    if (ids.length > 0) {
      const { data: cust } = await supabase
        .from('customers')
        .select('id, payment_due_date, penalty_amount, penalty_note')
        .in('id', ids)
      ;(cust || []).forEach((c) => {
        deadlineMap[c.id] = c
      })
    }

    const merged = (data || []).map((c) => ({
      ...c,
      ...(deadlineMap[c.customer_id] || {}),
    }))

    setCustomers(merged)
    setLoading(false)
  }

  const totalOwed = customers.reduce((sum, c) => sum + Math.max(0, Number(c.balance) || 0), 0)
  const debtorsCount = customers.filter((c) => Number(c.balance) > 0).length
  const overdueCount = customers.filter((c) => {
    const s = getDeadlineStatus(c.payment_due_date)
    return s?.overdue && Number(c.balance) > 0
  }).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Customers</h1>
          <p className="text-muted text-sm">Track who owes you and record payments.</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary">+ Add customer</button>
      </div>

      <div className="card px-4 py-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted">Total owed to you</div>
          <div className="font-mono text-2xl font-semibold text-brick">UGX {totalOwed.toLocaleString()}</div>
        </div>
        <div className="text-right text-xs text-muted space-y-1">
          <div>{debtorsCount} customer{debtorsCount === 1 ? '' : 's'} with a balance</div>
          {overdueCount > 0 && (
            <div className="text-brick font-medium">⚠ {overdueCount} overdue</div>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : customers.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-muted">
          No customers yet. Add one, or pick "Credit" when completing a sale.
        </p>
      ) : (
        <div className="card divide-y divide-line">
          {customers.map((c) => (
            <button
              key={c.customer_id}
              onClick={() => setSelected(c)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-paper"
            >
              <div className="space-y-1">
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-xs text-muted">{c.phone || 'No phone saved'}</div>
                <DeadlineBadge customer={c} />
              </div>
              <div className="text-right">
                <div className={`font-mono text-sm ${Number(c.balance) > 0 ? 'text-brick' : 'text-brand-dark'}`}>
                  UGX {Number(c.balance).toLocaleString()}
                </div>
                <div className="text-xs text-muted">{Number(c.balance) > 0 ? 'owes' : 'settled'}</div>
                {c.penalty_amount > 0 && Number(c.balance) > 0 && getDeadlineStatus(c.payment_due_date)?.overdue && (
                  <div className="text-xs text-brick font-mono">+{Number(c.penalty_amount).toLocaleString()} penalty</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {showNew && (
        <NewCustomerForm
          business={business}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load() }}
        />
      )}

      {selected && (
        <CustomerDetail
          business={business}
          activeStaff={activeStaff}
          customer={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { load() }}
        />
      )}
    </div>
  )
}

function NewCustomerForm({ business, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { data: customer, error: err } = await supabase
        .from('customers')
        .insert({ business_id: business.id, name, phone: phone || null, note: note || null })
        .select()
        .single()
      if (err) throw err

      if (Number(openingBalance) > 0) {
        await supabase.from('debt_transactions').insert({
          business_id: business.id,
          customer_id: customer.id,
          type: 'credit_sale',
          amount: Number(openingBalance),
          note: 'Opening balance',
        })
      }
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
      <div className="bg-paper-raised w-full md:max-w-sm rounded-t-lg md:rounded-lg p-6">
        <h2 className="font-display font-semibold mb-4">New customer</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-muted mb-1 block">Name</span>
            <input required className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mama Esther" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted mb-1 block">Phone (optional)</span>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xxxxxxxx" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted mb-1 block">Already owes you (optional)</span>
            <input
              type="number" min="0"
              className="input font-mono"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted mb-1 block">Note (optional)</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {error && <p className="text-brick text-sm">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CustomerDetail({ business, activeStaff, customer, onClose, onChanged }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [balance, setBalance] = useState(Number(customer.balance) || 0)
  const [showDeadlineForm, setShowDeadlineForm] = useState(false)
  const [dueDate, setDueDate] = useState(customer.payment_due_date || '')
  const [penaltyAmount, setPenaltyAmount] = useState(customer.penalty_amount || '')
  const [penaltyNote, setPenaltyNote] = useState(customer.penalty_note || '')
  const [deadlineBusy, setDeadlineBusy] = useState(false)

  const canManageDeadline = activeStaff?.role === 'owner' || activeStaff?.role === 'manager'
  const deadlineStatus = getDeadlineStatus(dueDate)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('debt_transactions')
      .select('*')
      .eq('customer_id', customer.customer_id)
      .order('created_at', { ascending: false })
    setTransactions(data || [])
    const newBalance = (data || []).reduce(
      (sum, t) => sum + (t.type === 'credit_sale' ? Number(t.amount) : -Number(t.amount)),
      0
    )
    setBalance(newBalance)
    setLoading(false)
  }

  async function recordPayment(e) {
    e.preventDefault()
    if (!paymentAmount || Number(paymentAmount) <= 0) return
    setBusy(true)
    setError('')
    try {
      const { error: err } = await supabase.from('debt_transactions').insert({
        business_id: business.id,
        customer_id: customer.customer_id,
        type: 'payment',
        amount: Number(paymentAmount),
        note: paymentNote || null,
        staff_user_id: activeStaff?.id || null,
      })
      if (err) throw err
      setPaymentAmount('')
      setPaymentNote('')
      await load()
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveDeadline(e) {
    e.preventDefault()
    setDeadlineBusy(true)
    try {
      const { error: err } = await supabase
        .from('customers')
        .update({
          payment_due_date: dueDate || null,
          penalty_amount: penaltyAmount ? Number(penaltyAmount) : null,
          penalty_note: penaltyNote || null,
        })
        .eq('id', customer.customer_id)
      if (err) throw err
      setShowDeadlineForm(false)
      onChanged()
    } catch (err) {
      alert(err.message)
    } finally {
      setDeadlineBusy(false)
    }
  }

  async function clearDeadline() {
    if (!confirm('Remove payment deadline for this customer?')) return
    await supabase.from('customers').update({
      payment_due_date: null,
      penalty_amount: null,
      penalty_note: null,
    }).eq('id', customer.customer_id)
    setDueDate('')
    setPenaltyAmount('')
    setPenaltyNote('')
    onChanged()
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
      <div className="bg-paper-raised w-full md:max-w-md rounded-t-lg md:rounded-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-semibold">{customer.name}</h2>
          <button onClick={onClose} className="text-muted text-sm" aria-label="Close">✕</button>
        </div>
        <p className="text-xs text-muted mb-4">{customer.phone || 'No phone saved'}</p>

        {/* Balance */}
        <div className="card px-4 py-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-muted">Current balance</span>
          <span className={`font-mono text-lg font-semibold ${balance > 0 ? 'text-brick' : 'text-brand-dark'}`}>
            UGX {balance.toLocaleString()}
          </span>
        </div>

        {/* Deadline section */}
        {balance > 0 && (
          <div className="card px-4 py-3 mb-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">Payment deadline</span>
              {canManageDeadline && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeadlineForm((v) => !v)}
                    className="text-xs text-brand-dark font-medium"
                  >
                    {dueDate ? 'Edit' : '+ Set deadline'}
                  </button>
                  {dueDate && (
                    <button onClick={clearDeadline} className="text-xs text-muted">
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>

            {dueDate ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {new Date(dueDate).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  {deadlineStatus && (
                    deadlineStatus.overdue ? (
                      <span className="text-xs font-medium text-white bg-brick rounded-full px-2 py-0.5">
                        ⚠ {Math.abs(deadlineStatus.days)} day{Math.abs(deadlineStatus.days) !== 1 ? 's' : ''} overdue
                      </span>
                    ) : deadlineStatus.days === 0 ? (
                      <span className="text-xs font-medium text-white bg-amber-500 rounded-full px-2 py-0.5">
                        ⏰ Due today!
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-brand-dark bg-brand-light rounded-full px-2 py-0.5">
                        ⏱ {deadlineStatus.days} day{deadlineStatus.days !== 1 ? 's' : ''} remaining
                      </span>
                    )
                  )}
                </div>

                {penaltyAmount > 0 && (
                  <div className={`text-xs ${deadlineStatus?.overdue ? 'text-brick font-medium' : 'text-muted'}`}>
                    Penalty: UGX {Number(penaltyAmount).toLocaleString()}
                    {penaltyNote ? ` · ${penaltyNote}` : ''}
                    {deadlineStatus?.overdue ? ' (NOW APPLICABLE)' : ' (if overdue)'}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted italic">No deadline set</p>
            )}

            {showDeadlineForm && canManageDeadline && (
              <form onSubmit={saveDeadline} className="space-y-2 pt-2 border-t border-line mt-2">
                <label className="block">
                  <span className="text-xs font-medium text-muted mb-1 block">Promise-to-pay date</span>
                  <input
                    required
                    type="date"
                    className="input"
                    value={dueDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-muted mb-1 block">Penalty amount if overdue (UGX)</span>
                  <input
                    type="number" min="0"
                    className="input font-mono"
                    placeholder="e.g. 10000"
                    value={penaltyAmount}
                    onChange={(e) => setPenaltyAmount(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-muted mb-1 block">Penalty note (optional)</span>
                  <input
                    className="input"
                    placeholder="e.g. Late fee agreed by customer"
                    value={penaltyNote}
                    onChange={(e) => setPenaltyNote(e.target.value)}
                  />
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowDeadlineForm(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
                  <button type="submit" disabled={deadlineBusy} className="btn-primary flex-1 text-sm">
                    {deadlineBusy ? 'Saving…' : 'Save deadline'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Record payment */}
        <form onSubmit={recordPayment} className="space-y-2 mb-5">
          <div className="text-xs font-medium text-muted">Record a payment</div>
          <div className="flex gap-2">
            <input
              type="number" min="0"
              className="input font-mono flex-1"
              placeholder="Amount paid"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
            <button type="submit" disabled={busy || !paymentAmount} className="btn-primary px-4">
              {busy ? '…' : 'Add'}
            </button>
          </div>
          <input
            className="input"
            placeholder="Note (optional)"
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
          />
          {error && <p className="text-brick text-sm">{error}</p>}
        </form>

        {/* History */}
        <div className="text-xs font-medium text-muted mb-2">History</div>
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-muted">No transactions yet.</p>
        ) : (
          <div className="card divide-y divide-line">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <div>
                  <div>{t.type === 'credit_sale' ? 'Credit given' : 'Payment received'}</div>
                  <div className="text-xs text-muted">
                    {new Date(t.created_at).toLocaleDateString()} {t.note ? `· ${t.note}` : ''}
                  </div>
                </div>
                <span className={`font-mono ${t.type === 'credit_sale' ? 'text-brick' : 'text-brand-dark'}`}>
                  {t.type === 'credit_sale' ? '+' : '−'}{Number(t.amount).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
