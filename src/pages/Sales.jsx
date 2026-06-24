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
  return null // 'all'
}

export default function Sales() {
  const { business } = useAuth()
  const [range, setRange] = useState('today')
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (!business) return
    load()
  }, [business, range])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('sales')
      .select('*, staff_users(name), sale_items(id, quantity, unit_price, products(name))')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })

    const from = startOfRange(range)
    if (from) query = query.gte('created_at', from.toISOString())

    const { data, error } = await query
    if (!error) setSales(data || [])
    setLoading(false)
  }

  const summary = useMemo(() => {
    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total_amount), 0)
    const totalItems = sales.reduce(
      (sum, s) => sum + (s.sale_items || []).reduce((isum, i) => isum + i.quantity, 0),
      0
    )
    return { totalRevenue, totalItems, count: sales.length }
  }, [sales])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-xl font-semibold">Sales</h1>
        <p className="text-muted text-sm">Total revenue, items sold, and full sale history.</p>
      </div>

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
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard label="Revenue" value={`UGX ${summary.totalRevenue.toLocaleString()}`} />
            <SummaryCard label="Sales" value={summary.count} />
            <SummaryCard label="Items sold" value={summary.totalItems} />
          </div>

          <Section title="History" subtitle={`${summary.count} sale${summary.count === 1 ? '' : 's'} in this range`}>
            {sales.length === 0 ? (
              <EmptyNote text="No sales in this range yet." />
            ) : (
              <div className="card divide-y divide-line">
                {sales.map((s) => {
                  const isOpen = expanded === s.id
                  const itemCount = (s.sale_items || []).reduce((sum, i) => sum + i.quantity, 0)
                  return (
                    <div key={s.id}>
                      <button
                        onClick={() => setExpanded(isOpen ? null : s.id)}
                        className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-paper"
                      >
                        <div>
                          <div className="text-sm font-medium">
                            {new Date(s.created_at).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </div>
                          <div className="text-xs text-muted">
                            {s.staff_users?.name || 'Unknown staff'} · {itemCount} item{itemCount === 1 ? '' : 's'}
                          </div>
                        </div>
                        <div className="font-mono text-sm font-semibold text-brand-dark">
                          UGX {Number(s.total_amount).toLocaleString()}
                        </div>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-3 -mt-1 space-y-1 bg-paper">
                          {(s.sale_items || []).map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-xs text-muted pl-2">
                              <span>
                                {item.quantity} × {item.products?.name || 'Deleted product'}
                              </span>
                              <span className="font-mono">
                                UGX {(item.quantity * Number(item.unit_price)).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted mb-2">{label}</div>
      <div className="font-mono text-2xl font-semibold text-brand-dark">{value}</div>
    </div>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <div>
      <div className="mb-3 pb-2 ledger-rule">
        <h2 className="font-display text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function EmptyNote({ text }) {
  return <p className="text-sm text-muted card px-4 py-6 text-center">{text}</p>
}
