import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

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

function DeadlineBadge({ lender }) {
  const status = getDeadlineStatus(lender.due_date)
  if (!status || Number(lender.balance) <= 0) return null

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

export default function Lenders() {
  const { business, activeStaff } = useAuth()
  const [lenders, setLenders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (business) load()
  }, [business])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('lender_summary')
      .select('*')
      .eq('business_id', business.id)
      .order('balance', { ascending: false })
    setLenders(data || [])
    setLoading(false)
  }

  const totalOwed = lenders.reduce((sum, l) => sum + Math.max(0, Number(l.balance) || 0), 0)
  const lenderCount = lenders.filter((l) => Number(l.balance) > 0).length
  const overdueCount = lenders.filter((l) => {
    const s = getDeadlineStatus(l.due_date)
    return s?.overdue && Number(l.balance) > 0
  }).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">People I Owe</h1>
          <p className="text-muted text-sm">Personal & business loans, advances — separate from suppliers.</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary">+ Add lender</button>
      </div>

      <div className="card px-4 py-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted">Total you owe</div>
          <div className="font-mono text-2xl font-semibold text-brick">UGX {totalOwed.toLocaleString()}</div>
        </div>
        <div className="text-right text-xs text-muted space-y-1">
          <div>{lenderCount} lender{lenderCount === 1 ? '' : 's'} with a balance</div>
          {overdueCount > 0 && (
            <div className="text-brick font-medium">⚠ {overdueCount} overdue</div>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : lenders.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-muted">
          Nobody on record yet. Add someone who's lent you money or given you an advance.
        </p>
      ) : (
        <div className="card divide-y divide-line">
          {lenders.map((l) => (
            <button
              key={l.lender_id}
              onClick={() => setSelected(l)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-paper"
            >
              <div className="space-y-1">
                <div className="text-sm font-medium">{l.name}</div>
                <div className="text-xs text-muted">{l.phone || 'No phone saved'}</div>
                <DeadlineBadge lender={l} />
              </div>
              <div className="text-right">
                <div className={`font-mono text-sm ${Number(l.balance) > 0 ? 'text-brick' : 'text-brand-dark'}`}>
                  UGX {Number(l.balance).toLocaleString()}
                </div>
                <div className="text-xs text-muted">{Number(l.balance) > 0 ? 'you owe' : 'settled'}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showNew && (
        <NewLenderForm
          business={business}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load() }}
        />
      )}

      {selected && (
        <LenderDetail
          business={business}
          activeStaff={activeStaff}
          lender={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { load() }}
        />
      )}
    </div>
  )
}

function NewLenderForm({ business, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { data: lender, error: err } = await supabase
        .from('lenders')
        .insert({
          business_id: business.id,
          name,
          phone: phone || null,
          note: note || null,
          due_date: dueDate || null,
        })
        .select()
        .single()
      if (err) throw err

      if (Number(openingBalance) > 0) {
        await supabase.from('lender_transactions').insert({
          business_id: business.id,
          lender_id: lender.id,
          type: 'borrowed',
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
        <h2 className="font-display font-semibold mb-4">Add lender</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-muted mb-1 block">Name</span>
            <input required className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Uncle Peter" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted mb-1 block">Phone (optional)</span>
            <input className="input" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xxxxxxxx" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted mb-1 block">Amount you currently owe them (optional)</span>
            <input
              type="number" min="0"
              className="input font-mono"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted mb-1 block">When you plan to repay (optional)</span>
            <input
              type="date"
              className="input"
              value={dueDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDueDate(e.target.value)}
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

function LenderDetail({ business, activeStaff, lender, onClose, onChanged }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [borrowAmount, setBorrowAmount] = useState('')
  const [borrowNote, setBorrowNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [balance, setBalance] = useState(Number(lender.balance) || 0)
  const [showDeadlineForm, setShowDeadlineForm] = useState(false)
  const [dueDate, setDueDate] = useState(lender.due_date || '')
  const [deadlineBusy, setDeadlineBusy] = useState(false)

  const canManage = activeStaff?.role === 'owner'
  const deadlineStatus = getDeadlineStatus(dueDate)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('lender_transactions')
      .select('*')
      .eq('lender_id', lender.lender_id)
      .order('created_at', { ascending: false })
    setTransactions(data || [])
    const newBalance = (data || []).reduce(
      (sum, t) => sum + (t.type === 'borrowed' ? Number(t.amount) : -Number(t.amount)),
      0
    )
    setBalance(newBalance)
    setLoading(false)
  }

  async function recordTransaction(type, amount, note) {
    if (!amount || Number(amount) <= 0) return
    setBusy(true)
    setError('')
    try {
      const { error: err } = await supabase.from('lender_transactions').insert({
        business_id: business.id,
        lender_id: lender.lender_id,
        type,
        amount: Number(amount),
        note: note || null,
        staff_user_id: activeStaff?.id || null,
      })
      if (err) throw err
      setPaymentAmount('')
      setPaymentNote('')
      setBorrowAmount('')
      setBorrowNote('')
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
        .from('lenders')
        .update({ due_date: dueDate || null })
        .eq('id', lender.lender_id)
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
    if (!confirm('Remove repayment date for this lender?')) return
    await supabase.from('lenders').update({ due_date: null }).eq('id', lender.lender_id)
    setDueDate('')
    onChanged()
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
      <div className="bg-paper-raised w-full md:max-w-md rounded-t-lg md:rounded-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-semibold">{lender.name}</h2>
          <button onClick={onClose} className="text-muted text-sm" aria-label="Close">✕</button>
        </div>
        <p className="text-xs text-muted mb-4">{lender.phone || 'No phone saved'}</p>

        {/* Balance */}
        <div className="card px-4 py-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-muted">You currently owe</span>
          <span className={`font-mono text-lg font-semibold ${balance > 0 ? 'text-brick' : 'text-brand-dark'}`}>
            UGX {balance.toLocaleString()}
          </span>
        </div>

        {/* Reminder / due date section */}
        {balance > 0 && (
          <div className="card px-4 py-3 mb-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">Repayment reminder</span>
              {canManage && (
                <div className="flex gap-2">
                  <button onClick={() => setShowDeadlineForm((v) => !v)} className="text-xs text-brand-dark font-medium">
                    {dueDate ? 'Edit' : '+ Set date'}
                  </button>
                  {dueDate && (
                    <button onClick={clearDeadline} className="text-xs text-muted">Remove</button>
                  )}
                </div>
              )}
            </div>

            {dueDate ? (
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
                      ⏱ {deadlineStatus.days} day{deadlineStatus.days !== 1 ? 's' : ''} left
                    </span>
                  )
                )}
              </div>
            ) : (
              <p className="text-xs text-muted italic">No reminder date set</p>
            )}

            {showDeadlineForm && canManage && (
              <form onSubmit={saveDeadline} className="space-y-2 pt-2 border-t border-line mt-2">
                <label className="block">
                  <span className="text-xs font-medium text-muted mb-1 block">Repay by</span>
                  <input
                    required
                    type="date"
                    className="input"
                    value={dueDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowDeadlineForm(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
                  <button type="submit" disabled={deadlineBusy} className="btn-primary flex-1 text-sm">
                    {deadlineBusy ? 'Saving…' : 'Save date'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Record borrowed / repayment */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <form
            onSubmit={(e) => { e.preventDefault(); recordTransaction('borrowed', borrowAmount, borrowNote) }}
            className="space-y-2"
          >
            <div className="text-xs font-medium text-muted">Borrowed more</div>
            <input
              type="number" min="0"
              className="input font-mono"
              placeholder="Amount"
              value={borrowAmount}
              onChange={(e) => setBorrowAmount(e.target.value)}
            />
            <input
              className="input text-sm"
              placeholder="Note (optional)"
              value={borrowNote}
              onChange={(e) => setBorrowNote(e.target.value)}
            />
            <button type="submit" disabled={busy || !borrowAmount} className="btn-secondary w-full text-sm">
              {busy ? '…' : '+ Add'}
            </button>
          </form>

          <form
            onSubmit={(e) => { e.preventDefault(); recordTransaction('repayment', paymentAmount, paymentNote) }}
            className="space-y-2"
          >
            <div className="text-xs font-medium text-muted">Record repayment</div>
            <input
              type="number" min="0"
              className="input font-mono"
              placeholder="Amount"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
            <input
              className="input text-sm"
              placeholder="Note (optional)"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
            />
            <button type="submit" disabled={busy || !paymentAmount} className="btn-primary w-full text-sm">
              {busy ? '…' : '+ Add'}
            </button>
          </form>
        </div>
        {error && <p className="text-brick text-sm mb-3">{error}</p>}

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
                  <div>{t.type === 'borrowed' ? 'Borrowed' : 'Repaid'}</div>
                  <div className="text-xs text-muted">
                    {new Date(t.created_at).toLocaleDateString()} {t.note ? `· ${t.note}` : ''}
                  </div>
                </div>
                <span className={`font-mono ${t.type === 'borrowed' ? 'text-brick' : 'text-brand-dark'}`}>
                  {t.type === 'borrowed' ? '+' : '−'}{Number(t.amount).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
