import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Money collected from a customer paying down credit/installments is cash
// in hand, same as a cash sale — so it flows back into the capital balance
// (logged as 'debt_payment' so the Spending tab can show it distinctly
// from cash sales and top-ups).
async function creditCapitalBalance(business, setBusiness, amount, note, staffId) {
  if (!business || !amount || amount <= 0) return
  const { data: biz } = await supabase.from('businesses').select('capital_balance').eq('id', business.id).single()
  const newBalance = Number(biz?.capital_balance || 0) + Number(amount)
  await supabase.from('businesses').update({ capital_balance: newBalance }).eq('id', business.id)
  await supabase.from('capital_transactions').insert({
    business_id: business.id,
    type: 'debt_payment',
    amount: Number(amount),
    note,
    staff_user_id: staffId || null,
  })
  setBusiness((prev) => (prev ? { ...prev, capital_balance: newBalance } : prev))
}
import { canAccess } from '../lib/permissions'

function normalizePhone(phone) {
  if (!phone) return null
  let digits = phone.replace(/[^\d+]/g, '')
  if (digits.startsWith('0')) digits = '256' + digits.slice(1) // Uganda default
  if (digits.startsWith('+')) digits = digits.slice(1)
  return digits
}

function buildReminderMessage(customer, business) {
  const status = getDeadlineStatus(customer.payment_due_date)
  const balance = Number(customer.balance).toLocaleString()
  const shopName = business?.name || 'us'

  if (status?.overdue) {
    const daysLate = Math.abs(status.days)
    let msg = `Hello ${customer.name}, this is a reminder from ${shopName}. Your balance of UGX ${balance} was due on ${new Date(customer.payment_due_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'long' })} and is now ${daysLate} day${daysLate !== 1 ? 's' : ''} overdue.`
    if (customer.penalty_amount > 0) {
      msg += ` A penalty of UGX ${Number(customer.penalty_amount).toLocaleString()} now applies.`
    }
    msg += ' Kindly arrange payment as soon as possible. Thank you.'
    return msg
  }

  return `Hello ${customer.name}, this is a friendly reminder from ${shopName} that your balance of UGX ${balance} is due${customer.payment_due_date ? ` on ${new Date(customer.payment_due_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'long' })}` : ''}. Thank you for your continued business.`
}

function sendWhatsAppReminder(customer, business) {
  const phone = normalizePhone(customer.phone)
  const text = buildReminderMessage(customer, business)
  const url = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`
  window.open(url, '_blank')
}

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
        ; (cust || []).forEach((c) => {
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
                <div className="flex items-center gap-2 flex-wrap">
                  <DeadlineBadge customer={c} />
                  {getDeadlineStatus(c.payment_due_date)?.overdue && Number(c.balance) > 0 && (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); sendWhatsAppReminder(c, business) }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-white bg-[#25D366] rounded-full px-2 py-0.5"
                    >
                      💬 Remind
                    </span>
                  )}
                </div>
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
  const contactPickerSupported = typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window

  async function pickFromContacts() {
    try {
      const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false })
      if (contacts && contacts.length > 0) {
        const contact = contacts[0]
        if (contact.name && contact.name[0]) setName(contact.name[0])
        if (contact.tel && contact.tel[0]) setPhone(contact.tel[0].replace(/\s+/g, ''))
      }
    } catch (err) {
      // User cancelled or permission denied — silently ignore
    }
  }

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
            <input required className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mama Fred" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted mb-1 block">Phone (optional)</span>
            <div className="flex gap-2">
              <input className="input flex-1" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xxxxxxxx" />
              {contactPickerSupported && (
                <button
                  type="button"
                  onClick={pickFromContacts}
                  title="Pick from contacts"
                  className="btn-secondary px-3 flex items-center gap-1 text-sm shrink-0"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Contacts
                </button>
              )}
            </div>
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
  const { setBusiness } = useAuth()
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

  // Installment plans
  const [plans, setPlans] = useState([])
  const [showNewPlan, setShowNewPlan] = useState(false)
  const [planTotal, setPlanTotal] = useState('')
  const [planInstallment, setPlanInstallment] = useState('')
  const [planFrequency, setPlanFrequency] = useState('monthly')
  const [planFirstDue, setPlanFirstDue] = useState('')
  const [planNote, setPlanNote] = useState('')
  const [planBusy, setPlanBusy] = useState(false)
  const [payingPlanId, setPayingPlanId] = useState(null)
  const [planPayAmount, setPlanPayAmount] = useState('')
  const [planPayBusy, setPlanPayBusy] = useState(false)

  const canManageDeadline = activeStaff?.role === 'owner' || activeStaff?.role === 'manager'
  const deadlineStatus = getDeadlineStatus(dueDate)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: txns }, { data: plansData }] = await Promise.all([
      supabase.from('debt_transactions').select('*').eq('customer_id', customer.customer_id).order('created_at', { ascending: false }),
      supabase.from('installment_plans').select('*').eq('customer_id', customer.customer_id).eq('is_complete', false).order('created_at', { ascending: false }),
    ])
    setTransactions(txns || [])
    setPlans(plansData || [])
    const newBalance = (txns || []).reduce(
      (sum, t) => sum + (t.type === 'credit_sale' ? Number(t.amount) : -Number(t.amount)),
      0
    )
    setBalance(newBalance)
    setLoading(false)
  }

  function nextDueDate(frequency, from) {
    const d = new Date(from)
    if (frequency === 'daily') d.setDate(d.getDate() + 1)
    else if (frequency === 'weekly') d.setDate(d.getDate() + 7)
    else d.setMonth(d.getMonth() + 1)
    return d.toISOString().slice(0, 10)
  }

  async function createPlan(e) {
    e.preventDefault()
    if (!planTotal || !planInstallment || !planFirstDue) return
    setPlanBusy(true)
    try {
      await supabase.from('installment_plans').insert({
        business_id: business.id,
        customer_id: customer.customer_id,
        total_amount: Number(planTotal),
        amount_paid: 0,
        installment_amount: Number(planInstallment),
        frequency: planFrequency,
        next_due_date: planFirstDue,
        note: planNote || null,
      })
      setPlanTotal(''); setPlanInstallment(''); setPlanFirstDue(''); setPlanNote('')
      setShowNewPlan(false)
      load()
    } catch (err) {
      alert(err.message)
    } finally {
      setPlanBusy(false)
    }
  }

  async function recordInstallment(plan) {
    const amt = Number(planPayAmount)
    if (!amt || amt <= 0) return
    setPlanPayBusy(true)
    try {
      const newPaid = Number(plan.amount_paid) + amt
      const remaining = Number(plan.total_amount) - newPaid
      const isComplete = remaining <= 0
      const newNextDue = isComplete ? plan.next_due_date : nextDueDate(plan.frequency, plan.next_due_date)
      await Promise.all([
        supabase.from('installment_payments').insert({
          plan_id: plan.id, business_id: business.id,
          customer_id: customer.customer_id, amount: amt,
          staff_user_id: activeStaff?.id || null,
        }),
        supabase.from('installment_plans').update({
          amount_paid: newPaid, next_due_date: newNextDue, is_complete: isComplete,
        }).eq('id', plan.id),
        supabase.from('debt_transactions').insert({
          business_id: business.id, customer_id: customer.customer_id,
          type: 'payment', amount: amt, note: `Installment payment (${plan.frequency})`,
        }),
      ])
      await creditCapitalBalance(business, setBusiness, amt, `Installment payment — ${customer.name}`, activeStaff?.id)
      setPlanPayAmount(''); setPayingPlanId(null)
      load(); onChanged()
    } catch (err) {
      alert(err.message)
    } finally {
      setPlanPayBusy(false)
    }
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
      await creditCapitalBalance(business, setBusiness, Number(paymentAmount), `Payment from ${customer.name}${paymentNote ? ` — ${paymentNote}` : ''}`, activeStaff?.id)
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

                <button
                  onClick={() => sendWhatsAppReminder({ ...customer, payment_due_date: dueDate, penalty_amount: penaltyAmount }, business)}
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-white bg-[#25D366] rounded-md px-3 py-1.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.74.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.92 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.2 8.2 0 0 1 5.83 2.42 8.2 8.2 0 0 1 2.41 5.83c0 4.55-3.7 8.23-8.25 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.76-1.85-.2-.48-.41-.42-.56-.42-.14 0-.31-.01-.47-.01a.9.9 0 0 0-.66.31c-.23.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.17 1.74 2.66 4.22 3.73.59.25 1.05.4 1.41.52.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z" />
                  </svg>
                  Send WhatsApp reminder
                </button>
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

        {/* Installment Plans */}
        {(plans.length > 0 || canManageDeadline) && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-muted">Installment plans</div>
              {canManageDeadline && (
                <button type="button" onClick={() => setShowNewPlan(v => !v)}
                  className="text-xs text-brand-dark font-medium">
                  {showNewPlan ? 'Cancel' : '+ New plan'}
                </button>
              )}
            </div>

            {showNewPlan && (
              <form onSubmit={createPlan} className="card p-3 space-y-2 mb-3">
                <div className="text-xs font-semibold text-muted">New installment plan</div>
                <label className="block">
                  <span className="text-xs text-muted block mb-1">Total amount owed (UGX)</span>
                  <input required type="number" min="1" className="input font-mono" placeholder="e.g. 300000"
                    value={planTotal} onChange={e => setPlanTotal(e.target.value)} />
                </label>
                <label className="block">
                  <span className="text-xs text-muted block mb-1">Amount per installment (UGX)</span>
                  <input required type="number" min="1" className="input font-mono" placeholder="e.g. 50000"
                    value={planInstallment} onChange={e => setPlanInstallment(e.target.value)} />
                </label>
                <label className="block">
                  <span className="text-xs text-muted block mb-1">Frequency</span>
                  <select className="input" value={planFrequency} onChange={e => setPlanFrequency(e.target.value)}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-muted block mb-1">First payment due</span>
                  <input required type="date" className="input"
                    min={new Date().toISOString().slice(0, 10)}
                    value={planFirstDue} onChange={e => setPlanFirstDue(e.target.value)} />
                </label>
                <label className="block">
                  <span className="text-xs text-muted block mb-1">Note (optional)</span>
                  <input className="input" placeholder="e.g. TV installment"
                    value={planNote} onChange={e => setPlanNote(e.target.value)} />
                </label>
                <button type="submit" disabled={planBusy} className="btn-primary w-full text-sm">
                  {planBusy ? 'Saving…' : 'Create plan'}
                </button>
              </form>
            )}

            {plans.map(plan => {
              const total = Number(plan.total_amount)
              const paid = Number(plan.amount_paid)
              const remaining = total - paid
              const pct = Math.min(100, Math.round((paid / total) * 100))
              const due = new Date(plan.next_due_date)
              const today = new Date(); today.setHours(0, 0, 0, 0)
              const isOverdue = due < today
              const isDueToday = due.toDateString() === today.toDateString()
              const isPaying = payingPlanId === plan.id
              return (
                <div key={plan.id} className="card p-3 mb-2">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-sm font-medium">
                        {plan.note || `${plan.frequency.charAt(0).toUpperCase() + plan.frequency.slice(1)} installments`}
                      </div>
                      <div className="text-xs text-muted">
                        UGX {Number(plan.installment_amount).toLocaleString()} / {plan.frequency}
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isOverdue ? 'bg-brick/10 text-brick' :
                      isDueToday ? 'bg-amber-500/10 text-amber-700' :
                        'bg-brand-light text-brand-dark'
                      }`}>
                      {isOverdue ? `⚠ Overdue` : isDueToday ? '⏰ Due today' : `Next: ${due.toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })}`}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-muted mb-1">
                      <span>Paid: UGX {paid.toLocaleString()}</span>
                      <span>Left: UGX {remaining.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-line rounded-full overflow-hidden">
                      <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs text-muted mt-1">{pct}% paid of UGX {total.toLocaleString()}</div>
                  </div>

                  {canManageDeadline && (
                    isPaying ? (
                      <div className="flex gap-2 mt-2">
                        <input type="number" min="1" className="input font-mono flex-1 text-sm py-1"
                          placeholder={`e.g. ${Number(plan.installment_amount).toLocaleString()}`}
                          value={planPayAmount} onChange={e => setPlanPayAmount(e.target.value)} autoFocus />
                        <button type="button" onClick={() => recordInstallment(plan)}
                          disabled={planPayBusy || !planPayAmount}
                          className="btn-primary px-3 text-sm">
                          {planPayBusy ? '…' : 'Record'}
                        </button>
                        <button type="button" onClick={() => { setPayingPlanId(null); setPlanPayAmount('') }}
                          className="btn-secondary px-3 text-sm">✕</button>
                      </div>
                    ) : (
                      <button type="button"
                        onClick={() => { setPayingPlanId(plan.id); setPlanPayAmount(String(plan.installment_amount)) }}
                        className="btn-primary w-full text-sm mt-1">
                        Record installment payment
                      </button>
                    )
                  )}
                </div>
              )
            })}

            {plans.length === 0 && !showNewPlan && (
              <p className="text-xs text-muted italic">No active installment plans.</p>
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