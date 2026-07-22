import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'Last week' },
  { key: 'month', label: 'Month' },
  { key: 'all', label: 'All time' },
]

// Returns { from, to } bounds for a range key. `to` is exclusive; null on
// either side means "no bound" (open-ended / all time).
function rangeBounds(key) {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  if (key === 'today') return { from: startOfToday, to: null }

  if (key === 'yesterday') {
    const from = new Date(startOfToday)
    from.setDate(from.getDate() - 1)
    return { from, to: startOfToday }
  }
  if (key === 'week') {
    const from = new Date(startOfToday)
    from.setDate(from.getDate() - 7)
    return { from, to: null }
  }
  if (key === 'month') {
    const from = new Date(startOfToday)
    from.setDate(from.getDate() - 30)
    return { from, to: null }
  }
  return { from: null, to: null } // all time
}

function txnLabel(t) {
  if (t.type === 'topup') return t.note ? `Capital top-up · ${t.note}` : 'Capital top-up'
  if (t.type === 'stock_purchase') {
    const base = t.products?.name || 'Deleted product'
    return t.product_variants?.name ? `${base} — ${t.product_variants.name}` : base
  }
  return t.note || 'Adjustment'
}

export default function Spending() {
  const { business, activeStaff, setBusiness } = useAuth()
  const [range, setRange] = useState('today')
  const [txns, setTxns] = useState([])
  const [loading, setLoading] = useState(true)

  const [showTopUp, setShowTopUp] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [topUpNote, setTopUpNote] = useState('')
  const [topUpBusy, setTopUpBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (business) load()
  }, [business, range])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('capital_transactions')
      .select('*, products(name), product_variants(name), staff_users(name)')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })

    const { from, to } = rangeBounds(range)
    if (from) query = query.gte('created_at', from.toISOString())
    if (to) query = query.lt('created_at', to.toISOString())

    const { data, error } = await query
    setTxns(error ? [] : data || [])
    setLoading(false)
  }

  const totals = useMemo(() => {
    const spent = txns
      .filter((t) => t.type === 'stock_purchase')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)
    const toppedUp = txns
      .filter((t) => t.type === 'topup')
      .reduce((sum, t) => sum + Number(t.amount), 0)
    return { spent, toppedUp }
  }, [txns])

  async function handleTopUp(e) {
    e.preventDefault()
    if (!topUpAmount || Number(topUpAmount) <= 0) return
    setTopUpBusy(true)
    const amt = Number(topUpAmount)
    const newBalance = Number(business.capital_balance || 0) + amt

    const { error } = await supabase.from('businesses').update({ capital_balance: newBalance }).eq('id', business.id)
    if (!error) {
      await supabase.from('capital_transactions').insert({
        business_id: business.id,
        type: 'topup',
        amount: amt,
        note: topUpNote.trim() || null,
        staff_user_id: activeStaff?.id || null,
      })
      setBusiness({ ...business, capital_balance: newBalance })
      setMessage(`Added UGX ${amt.toLocaleString()} to your capital balance.`)
      setTimeout(() => setMessage(''), 4000)
      setTopUpAmount('')
      setTopUpNote('')
      setShowTopUp(false)
      load()
    }
    setTopUpBusy(false)
  }

  const balance = Number(business?.capital_balance || 0)

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Spending</h1>
        <p className="text-muted text-sm">Your capital balance and what you've used it on.</p>
      </div>

      {message && <p className="text-sm text-brand-dark bg-brand-light rounded-md px-3 py-2">{message}</p>}

      {/* Balance card */}
      <div className={`card p-4 ${balance < 0 ? 'border-brick/40 bg-brick/5' : ''}`}>
        <div className="text-xs text-muted mb-1">Capital balance</div>
        <div className={`font-mono text-2xl font-semibold ${balance < 0 ? 'text-brick' : 'text-brand'}`}>
          UGX {balance.toLocaleString()}
        </div>
        {balance < 0 && <div className="text-xs text-brick mt-1">You've spent more than you've topped up.</div>}

        {!showTopUp ? (
          <button onClick={() => setShowTopUp(true)} className="btn-primary w-full mt-3 text-sm">
            + Top up capital
          </button>
        ) : (
          <form onSubmit={handleTopUp} className="mt-3 space-y-2 border-t border-line pt-3">
            <label className="block">
              <span className="text-xs font-medium text-muted mb-1 block">Amount to add (UGX)</span>
              <input
                required autoFocus type="number" min="1" className="input font-mono"
                placeholder="e.g. 500000" value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted mb-1 block">Note (optional)</span>
              <input className="input" placeholder="e.g. from personal savings" value={topUpNote}
                onChange={(e) => setTopUpNote(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowTopUp(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button type="submit" disabled={topUpBusy} className="btn-primary flex-1 text-sm">
                {topUpBusy ? 'Saving…' : 'Add funds'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Range tabs */}
      <div className="flex gap-2 flex-wrap">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border ${range === r.key
              ? 'bg-brand-light text-brand-dark border-brand-light'
              : 'border-line text-muted hover:bg-paper'
              }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="card px-3 py-2">
              <div className="text-xs text-muted mb-0.5">Spent on stock</div>
              <div className="font-mono font-semibold text-sm text-brick">UGX {totals.spent.toLocaleString()}</div>
            </div>
            <div className="card px-3 py-2">
              <div className="text-xs text-muted mb-0.5">Topped up</div>
              <div className="font-mono font-semibold text-sm text-brand">UGX {totals.toppedUp.toLocaleString()}</div>
            </div>
          </div>

          <div>
            <div className="mb-3 pb-2 ledger-rule">
              <h2 className="font-display text-sm font-semibold">History</h2>
              <p className="text-xs text-muted">{txns.length} transaction{txns.length === 1 ? '' : 's'} in this range</p>
            </div>
            {txns.length === 0 ? (
              <p className="text-sm text-muted card px-4 py-6 text-center">Nothing in this range yet.</p>
            ) : (
              <div className="card divide-y divide-line">
                {txns.map((t) => {
                  const isSpend = t.type === 'stock_purchase'
                  return (
                    <div key={t.id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{txnLabel(t)}</div>
                        <div className="text-xs text-muted">
                          {new Date(t.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                          {t.staff_users?.name ? ` · ${t.staff_users.name}` : ''}
                        </div>
                      </div>
                      <span className={`font-mono text-sm font-semibold whitespace-nowrap ${isSpend ? 'text-brick' : 'text-brand'}`}>
                        {isSpend ? '−' : '+'}UGX {Math.abs(Number(t.amount)).toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
