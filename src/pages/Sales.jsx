import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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

function itemName(item) {
  const base = item.products?.name || 'Deleted product'
  return item.product_variants?.name ? `${base} — ${item.product_variants.name}` : base
}

export default function Sales() {
  const { business, activeStaff } = useAuth()
  const [range, setRange] = useState('today')
  const [sales, setSales] = useState([])
  const [expensesTotal, setExpensesTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  const canSeeNetProfit = activeStaff?.role === 'owner'
  const canRefund = activeStaff?.role === 'owner' || activeStaff?.role === 'manager'

  useEffect(() => {
    if (!business) return
    load()
  }, [business, range])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('sales')
      .select('*, staff_users(name), customers(name), sale_items(id, quantity, unit_price, unit_cost, product_id, variant_id, products(name), product_variants(name))')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })

    const from = startOfRange(range)
    if (from) query = query.gte('created_at', from.toISOString())

    const { data, error } = await query
    if (!error) setSales(data || [])

    if (canSeeNetProfit) {
      let expQuery = supabase.from('expenses').select('amount').eq('business_id', business.id)
      if (from) expQuery = expQuery.gte('created_at', from.toISOString())
      const { data: expData } = await expQuery
      setExpensesTotal((expData || []).reduce((sum, e) => sum + Number(e.amount), 0))
    }

    setLoading(false)
  }

  const summary = useMemo(() => {
    const activeSales = sales.filter((s) => !s.is_refunded)
    const totalRevenue = activeSales.reduce((sum, s) => sum + Number(s.total_amount), 0)
    const totalItems = activeSales.reduce(
      (sum, s) => sum + (s.sale_items || []).reduce((isum, i) => isum + i.quantity, 0),
      0
    )
    const totalProfit = activeSales.reduce(
      (sum, s) =>
        sum +
        (s.sale_items || []).reduce(
          (isum, i) => isum + i.quantity * (Number(i.unit_price) - Number(i.unit_cost || 0)),
          0
        ),
      0
    )
    const refundCount = sales.filter((s) => s.is_refunded).length
    return { totalRevenue, totalItems, totalProfit, count: activeSales.length, refundCount }
  }, [sales])

  const productBreakdown = useMemo(() => {
    const byProduct = {}
    for (const s of sales) {
      for (const item of s.sale_items || []) {
        const name = itemName(item)
        const key = item.variant_id || item.product_id || name
        if (!byProduct[key]) {
          byProduct[key] = { name, units: 0, revenue: 0, profit: 0 }
        }
        byProduct[key].units += item.quantity
        byProduct[key].revenue += item.quantity * Number(item.unit_price)
        byProduct[key].profit += item.quantity * (Number(item.unit_price) - Number(item.unit_cost || 0))
      }
    }
    return Object.values(byProduct).sort((a, b) => b.revenue - a.revenue)
  }, [sales])

  function saleProfit(s) {
    return (s.sale_items || []).reduce(
      (sum, i) => sum + i.quantity * (Number(i.unit_price) - Number(i.unit_cost || 0)),
      0
    )
  }

  async function refundSale(sale) {
    if (!confirm(`Refund this sale of UGX ${Number(sale.total_amount).toLocaleString()}? Stock will be added back.`)) return
    const note = window.prompt('Reason for refund (optional):') ?? ''
    try {
      // 1. Mark sale as refunded
      const { error: sErr } = await supabase
        .from('sales')
        .update({
          is_refunded: true,
          refunded_at: new Date().toISOString(),
          refund_note: note || null,
          refunded_by: activeStaff?.id || null,
        })
        .eq('id', sale.id)
      if (sErr) throw sErr

      // 2. Reverse stock for each item
      for (const item of sale.sale_items || []) {
        await supabase.from('stock_movements').insert({
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          business_id: business.id,
          type: 'return',
          quantity: item.quantity,
          note: `Refund of sale ${sale.id.slice(0, 8)}${note ? ' · ' + note : ''}`,
          staff_user_id: activeStaff?.id || null,
        })
      }

      // 3. If credit sale — reverse the debt transaction
      if (sale.is_credit && sale.customer_id) {
        await supabase.from('debt_transactions').insert({
          business_id: business.id,
          customer_id: sale.customer_id,
          type: 'payment',
          amount: Number(sale.total_amount),
          note: `Refund · ${note || 'sale reversed'}`,
        })
      }

      await load()
    } catch (err) {
      alert('Refund failed: ' + err.message)
    }
  }

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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Revenue" value={`UGX ${summary.totalRevenue.toLocaleString()}`} />
            <SummaryCard label="Profit" value={`UGX ${summary.totalProfit.toLocaleString()}`} highlight />
            <SummaryCard label="Sales" value={summary.count} />
            <SummaryCard label="Items sold" value={summary.totalItems} />
          </div>

          {canSeeNetProfit && (
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted mb-1">Net profit (after expenses)</div>
                <Link to="/expenses" className="text-xs text-brand-dark hover:underline">Manage expenses →</Link>
              </div>
              <div
                className={`font-mono text-2xl font-semibold ${summary.totalProfit - expensesTotal < 0 ? 'text-brick' : 'text-brand-dark'}`}
              >
                UGX {(summary.totalProfit - expensesTotal).toLocaleString()}
              </div>
              <div className="text-xs text-muted mt-1">
                {`UGX ${summary.totalProfit.toLocaleString()} profit − UGX ${expensesTotal.toLocaleString()} expenses`}
              </div>
            </div>
          )}

          <ProductBreakdown products={productBreakdown} />

          <Section
            title="History"
            subtitle={
              summary.count + ' sale' + (summary.count === 1 ? '' : 's') + ' in this range' +
              (summary.refundCount > 0 ? ' · ' + summary.refundCount + ' refunded' : '')
            }
          >
            {sales.length === 0 ? (
              <EmptyNote text="No sales in this range yet." />
            ) : (
              <div className="card divide-y divide-line">
                {sales.map((s) => {
                  const isOpen = expanded === s.id
                  const itemCount = (s.sale_items || []).reduce((sum, i) => sum + i.quantity, 0)
                  return (
                    <div key={s.id} className={s.is_refunded ? "opacity-50" : ""}>
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
                            {s.is_credit && (
                              <span className="ml-2 text-brick bg-brick-light rounded-full px-2 py-0.5">
                                Credit{s.customers?.name ? ` · ${s.customers.name}` : ''}
                              </span>
                            )}
                            {s.is_refunded && (
                              <span className="ml-2 text-white bg-gray-400 rounded-full px-2 py-0.5">
                                Refunded
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm font-semibold text-brand-dark">
                            UGX {Number(s.total_amount).toLocaleString()}
                          </div>
                          <div className="font-mono text-xs text-amber">
                            +{saleProfit(s).toLocaleString()} profit
                          </div>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 -mt-1 space-y-1 bg-paper">
                          {(s.sale_items || []).map((item) => {
                            const itemProfit = item.quantity * (Number(item.unit_price) - Number(item.unit_cost || 0))
                            return (
                              <div key={item.id} className="flex items-center justify-between text-xs text-muted pl-2">
                                <span>
                                  {item.quantity} × {itemName(item)}
                                </span>
                                <span className="font-mono">
                                  UGX {(item.quantity * Number(item.unit_price)).toLocaleString()}
                                  <span className="text-amber ml-2">+{itemProfit.toLocaleString()}</span>
                                </span>
                              </div>
                            )
                          })}

                          {s.is_refunded ? (
                            <div className="mt-3 pt-2 border-t border-line text-xs text-muted">
                              <span className="font-medium text-gray-500">Refunded</span>
                              {s.refunded_at && (
                                <span className="ml-2">
                                  {new Date(s.refunded_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                                </span>
                              )}
                              {s.refund_note && <span className="ml-2">· {s.refund_note}</span>}
                            </div>
                          ) : canRefund ? (
                            <div className="mt-3 pt-2 border-t border-line">
                              <button
                                onClick={(e) => { e.stopPropagation(); refundSale(s) }}
                                className="text-xs font-medium text-brick border border-brick/30 rounded-md px-3 py-1.5 hover:bg-brick/5"
                              >
                                ↩ Refund this sale
                              </button>
                            </div>
                          ) : null}
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

function SummaryCard({ label, value, highlight }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted mb-2">{label}</div>
      <div className={`font-mono text-2xl font-semibold ${highlight ? 'text-amber' : 'text-brand-dark'}`}>{value}</div>
    </div>
  )
}

function ProductBreakdown({ products }) {
  const [view, setView] = useState('best')

  if (products.length === 0) return null

  const sorted = view === 'best' ? products : [...products].reverse()
  const shown = sorted.slice(0, 5)
  const maxRevenue = shown[0]?.revenue || 1

  return (
    <Section title="Top products" subtitle="Ranked by revenue in this range">
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setView('best')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
            view === 'best' ? 'bg-brand-light text-brand-dark border-brand-light' : 'border-line text-muted hover:bg-paper'
          }`}
        >
          Best sellers
        </button>
        <button
          onClick={() => setView('worst')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
            view === 'worst' ? 'bg-brand-light text-brand-dark border-brand-light' : 'border-line text-muted hover:bg-paper'
          }`}
        >
          Slowest movers
        </button>
      </div>
      <div className="card divide-y divide-line">
        {shown.map((p, idx) => (
          <div key={p.name + idx} className="px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium">{p.name}</span>
              <span className="font-mono text-sm font-semibold text-brand-dark">
                UGX {p.revenue.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted mb-1.5">
              <span>{p.units} sold</span>
              <span className="text-amber">+{p.profit.toLocaleString()} profit</span>
            </div>
            <div className="h-1.5 bg-paper rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full"
                style={{ width: `${Math.max(4, (p.revenue / maxRevenue) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Section>
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