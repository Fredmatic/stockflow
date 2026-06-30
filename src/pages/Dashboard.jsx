import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import BirthdayCountdown from '../components/BirthdayCountdown'

const ROUTE_LABELS = {
  '/products': 'Products',
  '/stock-in': 'Stock In',
  '/sales': 'Sales',
  '/customers': 'Customers',
  '/expenses': 'Expenses',
  '/staff': 'Staff',
}

export default function Dashboard() {
  const { business, activeStaff } = useAuth()
  const location = useLocation()
  const [stock, setStock] = useState([])
  const [recent, setRecent] = useState([])
  const [todaySales, setTodaySales] = useState({ total: 0, count: 0 })
  const [totalOwed, setTotalOwed] = useState(0)
  const [loading, setLoading] = useState(true)

  const canSeeRevenue = activeStaff?.role !== 'cashier'
  const blockedFrom = location.state?.blockedFrom

  useEffect(() => {
    if (!business) return
    load()
  }, [business])

  async function load() {
    setLoading(true)
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const [{ data: stockData }, { data: recentData }, { data: salesData }, { data: debtorsData }] = await Promise.all([
      supabase.from('product_stock').select('*').eq('business_id', business.id),
      supabase
        .from('stock_movements')
        .select('*, products(name), product_variants(name)')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('sales')
        .select('total_amount')
        .eq('business_id', business.id)
        .gte('created_at', startOfToday.toISOString()),
      supabase.from('debtor_summary').select('balance').eq('business_id', business.id),
    ])
    setStock(stockData || [])
    setRecent(recentData || [])
    const total = (salesData || []).reduce((sum, s) => sum + Number(s.total_amount), 0)
    setTodaySales({ total, count: (salesData || []).length })
    setTotalOwed((debtorsData || []).reduce((sum, d) => sum + Math.max(0, Number(d.balance) || 0), 0))
    setLoading(false)
  }

  const lowStock = stock.filter((p) => p.status === 'low_stock')
  const outOfStock = stock.filter((p) => p.status === 'out_of_stock')
  const inStock = stock.filter((p) => p.status === 'in_stock')

  if (loading) return <p className="text-muted text-sm">Loading…</p>

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold">Dashboard</h1>
          <p className="text-muted text-sm">A snapshot of your stock right now.</p>
        </div>
        <BirthdayCountdown />
      </div>

      {blockedFrom && (
        <p className="text-sm text-brick bg-brick-light rounded-md px-3 py-2">
          {ROUTE_LABELS[blockedFrom] || 'That page'} isn't available for your role.
        </p>
      )}

      {canSeeRevenue && (
        <div className="grid md:grid-cols-2 gap-3">
          <Link to="/sales" className="card p-4 flex items-center justify-between hover:bg-paper transition-colors">
            <div>
              <div className="text-xs text-muted mb-1">Today's sales</div>
              <div className="font-mono text-2xl font-semibold text-brand-dark">
                UGX {todaySales.total.toLocaleString()}
              </div>
              <div className="text-xs text-muted mt-1">
                {todaySales.count} sale{todaySales.count === 1 ? '' : 's'} so far · view full history →
              </div>
            </div>
          </Link>

          <Link to="/customers" className="card p-4 flex items-center justify-between hover:bg-paper transition-colors">
            <div>
              <div className="text-xs text-muted mb-1">Owed to you</div>
              <div className={`font-mono text-2xl font-semibold ${totalOwed > 0 ? 'text-brick' : 'text-brand-dark'}`}>
                UGX {totalOwed.toLocaleString()}
              </div>
              <div className="text-xs text-muted mt-1">from customers buying on credit · manage →</div>
            </div>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="In stock" value={inStock.length} color="brand" />
        <SummaryCard label="Low stock" value={lowStock.length} color="amber" />
        <SummaryCard label="Out of stock" value={outOfStock.length} color="brick" />
      </div>

      <Section title="Needs attention" subtitle="Low stock and out-of-stock items, in order of urgency">
        {outOfStock.length === 0 && lowStock.length === 0 ? (
          <EmptyNote text="Nothing needs attention. All products are above their reorder level." />
        ) : (
          <div className="card divide-y divide-line">
            {[...outOfStock, ...lowStock].map((p) => (
              <StockRow key={p.variant_id || p.product_id} product={p} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Recent activity" subtitle="Last 8 stock movements">
        {recent.length === 0 ? (
          <EmptyNote text="No stock movements yet. Add stock from Stock In to get started." />
        ) : (
          <div className="card divide-y divide-line">
            {recent.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <span className="font-medium">
                    {m.products?.name}
                    {m.product_variants?.name ? ` — ${m.product_variants.name}` : ''}
                  </span>
                  <span className="text-muted ml-2 text-xs uppercase tracking-wide">{m.type}</span>
                </div>
                <span className={`font-mono ${m.quantity < 0 ? 'text-brick' : 'text-brand-dark'}`}>
                  {m.quantity > 0 ? '+' : ''}{m.quantity}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function SummaryCard({ label, value, color }) {
  const colorMap = {
    brand: { bg: 'var(--color-brand-light)', text: 'var(--color-brand-dark)' },
    amber: { bg: 'var(--color-amber-light)', text: 'var(--color-amber)' },
    brick: { bg: 'var(--color-brick-light)', text: 'var(--color-brick)' },
  }
  return (
    <div className="card p-4">
      <div className="text-xs text-muted mb-2">{label}</div>
      <div
        className="font-mono text-3xl font-semibold inline-flex items-center justify-center w-12 h-12 rounded-md"
        style={{ background: colorMap[color].bg, color: colorMap[color].text }}
      >
        {value}
      </div>
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

function StockRow({ product }) {
  const statusStyles = {
    low_stock: { dot: 'var(--color-amber)', label: 'Low stock' },
    out_of_stock: { dot: 'var(--color-brick)', label: 'Out of stock' },
  }
  const s = statusStyles[product.status]
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="status-dot" style={{ background: s.dot }} />
        <div>
          <div className="text-sm font-medium">
            {product.product_name}
            {product.variant_name ? ` — ${product.variant_name}` : ''}
          </div>
          <div className="text-xs text-muted">{s.label} · reorder at {product.reorder_level}</div>
        </div>
      </div>
      <div className="font-mono text-sm">{product.quantity_on_hand}</div>
    </div>
  )
}

function EmptyNote({ text }) {
  return <p className="text-sm text-muted card px-4 py-6 text-center">{text}</p>
}
