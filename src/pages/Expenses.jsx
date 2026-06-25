import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
]

function startOfRange(key) {
  const now = new Date()
  if (key === 'today') {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d
  }
  if (key === '7d') {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    return d
  }
  if (key === '30d') {
    const d = new Date(now)
    d.setDate(d.getDate() - 30)
    return d
  }
  return null
}

export default function Expenses() {
  const { business, activeStaff } = useAuth()
  const [range, setRange] = useState('30d')
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!business) return
    load()
  }, [business, range])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('expenses')
      .select('*, staff_users(name)')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })

    const from = startOfRange(range)
    if (from) query = query.gte('created_at', from.toISOString())

    const { data, error } = await query
    if (!error) setExpenses(data || [])
    setLoading(false)
  }

  // Past categories typed by this business, most recent first, for quick re-use.
  const knownCategories = useMemo(() => {
    const seen = new Set()
    const list = []
    for (const e of expenses) {
      const c = e.category.trim()
      if (c && !seen.has(c.toLowerCase())) {
        seen.add(c.toLowerCase())
        list.push(c)
      }
    }
    return list.slice(0, 8)
  }, [expenses])

  const total = useMemo(() => expenses.reduce((sum, e) => sum + Number(e.amount), 0), [expenses])

  async function handleAdd(e) {
    e.preventDefault()
    if (!category.trim() || !amount || Number(amount) <= 0) {
      setMessage('Error: enter a category and an amount greater than 0.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('expenses').insert({
      business_id: business.id,
      staff_user_id: activeStaff?.id || null,
      category: category.trim(),
      amount: Number(amount),
      note: note.trim() || null,
    })
    setSaving(false)
    if (error) {
      setMessage(`Error: ${error.message}`)
      return
    }
    setCategory('')
    setAmount('')
    setNote('')
    setMessage('Expense added.')
    setTimeout(() => setMessage(''), 3000)
    load()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (!error) setExpenses((list) => list.filter((e) => e.id !== id))
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-xl font-semibold">Expenses</h1>
        <p className="text-muted text-sm">Rent, transport, utilities — costs beyond cost of goods.</p>
      </div>

      <form onSubmit={handleAdd} className="card p-4 space-y-3">
        {message && (
          <p className={`text-sm rounded-md px-3 py-2 ${message.startsWith('Error') ? 'text-brick bg-brick-light' : 'text-brand-dark bg-brand-light'}`}>
            {message}
          </p>
        )}
        <label className="block">
          <span className="text-xs font-medium text-muted mb-1 block">Category</span>
          <input
            className="input"
            placeholder="e.g. Transport"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list="expense-categories"
          />
          <datalist id="expense-categories">
            {knownCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        {knownCategories.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {knownCategories.slice(0, 5).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className="px-2.5 py-1 rounded-md text-xs border border-line text-muted hover:bg-paper"
              >
                {c}
              </button>
            ))}
          </div>
        )}
        <label className="block">
          <span className="text-xs font-medium text-muted mb-1 block">Amount (UGX)</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            className="input font-mono"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted mb-1 block">Note (optional)</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? 'Saving…' : 'Add expense'}
        </button>
      </form>

      <div className="flex gap-2 flex-wrap">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
              range === r.key
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
          <div className="card p-4">
            <div className="text-xs text-muted mb-2">Total expenses</div>
            <div className="font-mono text-2xl font-semibold text-brick">UGX {total.toLocaleString()}</div>
          </div>

          <div>
            <div className="mb-3 pb-2 ledger-rule">
              <h2 className="font-display text-sm font-semibold">History</h2>
              <p className="text-xs text-muted">{expenses.length} expense{expenses.length === 1 ? '' : 's'} in this range</p>
            </div>
            {expenses.length === 0 ? (
              <p className="text-sm text-muted card px-4 py-6 text-center">No expenses logged in this range.</p>
            ) : (
              <div className="card divide-y divide-line">
                {expenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-sm font-medium">{e.category}</div>
                      <div className="text-xs text-muted">
                        {new Date(e.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        {e.staff_users?.name ? ` · ${e.staff_users.name}` : ''}
                        {e.note ? ` · ${e.note}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-brick">UGX {Number(e.amount).toLocaleString()}</span>
                      <button onClick={() => handleDelete(e.id)} className="text-xs text-muted hover:text-brick">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
