import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import BirthdayCountdown from '../components/BirthdayCountdown'
import { calcSaleProfit, calcNetProfit, sumOwedBalance, summarizeServiceTickets, calcBalanceDue } from '../lib/money'
import { getProfile, servicesEnabled, getServicesProfile, expiryStatus, daysUntil } from '../lib/businessTypes'

const ROUTE_LABELS = {
  '/products': 'Products',
  '/stock-in': 'Stock In',
  '/sales': 'Sales',
  '/services': 'Customer Service',
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
  const [netProfit, setNetProfit] = useState(0)
  const [loading, setLoading] = useState(true)
  // Widgets that only some kinds of business need (expiry, open jobs, orders…)
  const [extras, setExtras] = useState({ expiring: [], openJobs: [], staffToday: [], orders: null, slow: [] })
  const profile = getProfile(business)
  const widgets = profile.dashboard
  const showServices = servicesEnabled(business)

  const canSeeRevenue = activeStaff?.role !== 'cashier'
  const canSeeNetProfit = activeStaff?.role === 'owner'
  const blockedFrom = location.state?.blockedFrom

  useEffect(() => {
    if (!business) return
    load()
  }, [business])

  async function load() {
    setLoading(true)
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const [{ data: stockData }, { data: recentData }, { data: salesData }, { data: servicesToday }, { data: debtorsData }] = await Promise.all([
      supabase.from('product_stock').select('*').eq('business_id', business.id),
      supabase
        .from('stock_movements')
        .select('*, products(name), product_variants(name)')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('sales')
        .select('total_amount, is_refunded, meta')
        .eq('business_id', business.id)
        .gte('created_at', startOfToday.toISOString()),
      supabase
        .from('service_tickets')
        .select('amount, staff_user_id, tip_amount, staff_users(name)')
        .eq('business_id', business.id)
        .eq('status', 'completed')
        .gte('created_at', startOfToday.toISOString()),
      supabase.from('debtor_summary').select('balance').eq('business_id', business.id),
    ])
    setStock(stockData || [])
    setRecent(recentData || [])
    // Refunded sales must not contribute to dashboard revenue or sale count.
    // The Sales page already treats refunded sales as inactive; keep the dashboard
    // using the same rule so both views stay consistent.
    const activeSalesToday = (salesData || []).filter((s) => !s.is_refunded)
    const salesTotal = activeSalesToday.reduce((sum, s) => sum + Number(s.total_amount), 0)
    const servicesTotal = (servicesToday || []).reduce((sum, s) => sum + Number(s.amount), 0)
    setTodaySales({
      total: salesTotal + servicesTotal,
      count: activeSalesToday.length + (servicesToday || []).length,
    })
    setTotalOwed(sumOwedBalance(debtorsData))
    await loadExtras(stockData || [], activeSalesToday, servicesToday || [])

    if (activeStaff?.role === 'owner') {
      const [{ data: monthSales }, { data: monthExpenses }, { data: monthServices }] = await Promise.all([
        supabase
          .from('sales')
          .select('is_refunded, sale_items(quantity, unit_price, unit_cost)')
          .eq('business_id', business.id)
          .gte('created_at', startOfMonth.toISOString()),
        supabase
          .from('expenses')
          .select('amount')
          .eq('business_id', business.id)
          .gte('created_at', startOfMonth.toISOString()),
        supabase
          .from('service_tickets')
          .select('amount, commission_amount, supply_cost')
          .eq('business_id', business.id)
          .eq('status', 'completed')
          .gte('created_at', startOfMonth.toISOString()),
      ])
      const grossProfit = (monthSales || [])
        .filter((s) => !s.is_refunded)
        .reduce((sum, s) => sum + calcSaleProfit(s.sale_items), 0)
      const servicesProfit = summarizeServiceTickets(monthServices).profit
      const expensesTotal = (monthExpenses || []).reduce((sum, e) => sum + Number(e.amount), 0)
      setNetProfit(calcNetProfit({ grossProfit: grossProfit + servicesProfit, totalExpenses: expensesTotal }))
    }

    setLoading(false)
  }

  // The cards that matter for THIS kind of business.
  async function loadExtras(stockRows, salesToday, servicesToday) {
    const next = { expiring: [], openJobs: [], staffToday: [], orders: null, slow: [] }

    // Expiry: pharmacy, supermarket, wholesale… anything holding items that go off.
    if (profile.products.expiry) {
      const { data: prods } = await supabase
        .from('products')
        .select('id, name, attributes')
        .eq('business_id', business.id)
        .eq('is_active', true)
      const onHand = {}
      for (const r of stockRows) onHand[r.product_id] = (onHand[r.product_id] || 0) + Number(r.quantity_on_hand || 0)
      const warn = profile.products.expiry.warnDays
      next.expiring = (prods || [])
        .filter((p) => p.attributes?.expiry_date && (onHand[p.id] || 0) > 0)
        .map((p) => ({
          id: p.id,
          name: p.name,
          date: p.attributes.expiry_date,
          batch: p.attributes.batch_no,
          qty: onHand[p.id],
          status: expiryStatus(p.attributes.expiry_date, warn),
          days: daysUntil(p.attributes.expiry_date),
        }))
        .filter((p) => p.status === 'expired' || p.status === 'soon')
        .sort((a, b) => a.days - b.days)
    }

    // Open jobs / upcoming appointments
    if (widgets.includes('openJobs') && showServices) {
      const { data } = await supabase
        .from('service_tickets')
        .select('id, service_name, customer_name, status, scheduled_at, amount, deposit_amount, item_details')
        .eq('business_id', business.id)
        .in('status', ['booked', 'in_progress', 'ready'])
        .order('scheduled_at', { ascending: true, nullsFirst: false })
        .limit(6)
      next.openJobs = data || []
    }

    // Who earned what today (barber / stylist leaderboard)
    if (widgets.includes('serviceStaff') && showServices) {
      const map = new Map()
      for (const t of servicesToday) {
        const key = t.staff_user_id || 'none'
        if (!map.has(key)) map.set(key, { name: t.staff_users?.name || 'Unassigned', revenue: 0, tips: 0, count: 0 })
        const r = map.get(key)
        r.revenue += Number(t.amount)
        r.tips += Number(t.tip_amount) || 0
        r.count += 1
      }
      next.staffToday = [...map.values()].sort((a, b) => b.revenue - a.revenue)
    }

    // Orders today: restaurant / bar
    if (widgets.includes('orders')) {
      const total = salesToday.reduce((n, x) => n + Number(x.total_amount), 0)
      const byType = {}
      for (const x of salesToday) {
        const t = x.meta?.order_type
        if (t) byType[t] = (byType[t] || 0) + 1
      }
      next.orders = { count: salesToday.length, avg: salesToday.length ? total / salesToday.length : 0, byType }
    }

    // Slow movers: stock that hasn't sold for 30 days (money sitting on the shelf)
    if (widgets.includes('slowMovers')) {
      const since = new Date()
      since.setDate(since.getDate() - 30)
      const { data: sold } = await supabase
        .from('sale_items')
        .select('product_id, sales!inner(business_id, created_at)')
        .eq('sales.business_id', business.id)
        .gte('sales.created_at', since.toISOString())
      const soldIds = new Set((sold || []).map((r) => r.product_id))
      next.slow = stockRows
        .filter((r) => Number(r.quantity_on_hand) > 0 && !soldIds.has(r.product_id))
        .map((r) => ({ ...r, tied: Number(r.quantity_on_hand) * Number(r.cost_price || 0) }))
        .sort((a, b) => b.tied - a.tied)
        .slice(0, 6)
    }

    setExtras(next)
  }

  const lowStock = stock.filter((p) => p.status === 'low_stock')
  const outOfStock = stock.filter((p) => p.status === 'out_of_stock')
  const inStock = stock.filter((p) => p.status === 'in_stock')

  if (loading) return <Spinner />

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold">Dashboard</h1>
          <p className="text-muted text-sm">{profile.vocab.dashboardSubtitle}</p>
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
                {todaySales.count} sale{todaySales.count === 1 ? '' : 's'} & service{todaySales.count === 1 ? '' : 's'} so far →
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

      {canSeeNetProfit && (
        <Link to="/sales" className="card p-4 flex items-center justify-between hover:bg-paper transition-colors">
          <div>
            <div className="text-xs text-muted mb-1">Net profit (this month, after expenses)</div>
            <div className={`font-mono text-2xl font-semibold ${netProfit < 0 ? 'text-brick' : 'text-brand-dark'}`}>
              UGX {netProfit.toLocaleString()}
            </div>
            <div className="text-xs text-muted mt-1">month-to-date · full breakdown on Sales →</div>
          </div>
        </Link>
      )}

      {extras.orders && (
        <div className="card p-4">
          <div className="text-xs text-muted mb-1">Today's orders</div>
          <div className="flex items-baseline gap-4 flex-wrap">
            <span className="font-mono text-2xl font-semibold text-brand-dark">{extras.orders.count}</span>
            <span className="text-xs text-muted">average order UGX {Math.round(extras.orders.avg).toLocaleString()}</span>
            {Object.entries(extras.orders.byType).map(([k, v]) => (
              <span key={k} className="text-xs text-muted">{k}: {v}</span>
            ))}
          </div>
        </div>
      )}

      {extras.staffToday.length > 0 && canSeeRevenue && (
        <Section title={`Today by ${getServicesProfile(business).staffLabel.toLowerCase()}`} subtitle="Completed work so far today">
          <div className="card divide-y divide-line">
            {extras.staffToday.map((r) => (
              <div key={r.name} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted">{r.count} done{r.tips > 0 ? ` · tips UGX ${r.tips.toLocaleString()}` : ''}</div>
                </div>
                <div className="font-mono font-semibold">UGX {r.revenue.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {extras.openJobs.length > 0 && (
        <Section title={getServicesProfile(business).workflow === 'booking' ? 'Upcoming appointments' : 'Open jobs'} subtitle="Booked or being worked on — tap to manage">
          <Link to="/services" className="card divide-y divide-line block">
            {extras.openJobs.map((j) => (
              <div key={j.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{j.service_name} — {j.customer_name}</div>
                  <div className="text-xs text-muted">
                    {j.status === 'ready' ? 'Ready for pickup' : j.status === 'booked' ? 'Booked' : 'In progress'}
                    {j.scheduled_at ? ` · ${new Date(j.scheduled_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
                  </div>
                </div>
                <div className="font-mono text-xs shrink-0">owes UGX {calcBalanceDue({ amount: j.amount, depositAmount: j.deposit_amount }).toLocaleString()}</div>
              </div>
            ))}
          </Link>
        </Section>
      )}

      {extras.expiring.length > 0 && (
        <Section title="Expiring soon" subtitle={`Items already expired or expiring within ${profile.products.expiry.warnDays} days — sell, return or remove them`}>
          <div className="card divide-y divide-line">
            {extras.expiring.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{e.name}</div>
                  <div className="text-xs text-muted">{e.qty} on hand{e.batch ? ` · batch ${e.batch}` : ''} · {e.date}</div>
                </div>
                <span className={`text-xs rounded px-2 py-0.5 shrink-0 ${e.status === 'expired' ? 'bg-brick-light text-brick' : 'bg-amber-light text-amber'}`}>
                  {e.status === 'expired' ? `Expired ${Math.abs(e.days)}d ago` : `${e.days} day${e.days === 1 ? '' : 's'} left`}
                </span>
              </div>
            ))}
          </div>
        </Section>
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

      {extras.slow.length > 0 && (
        <Section title="Not selling" subtitle="In stock but nothing sold in the last 30 days — money sitting on the shelf">
          <div className="card divide-y divide-line">
            {extras.slow.map((r) => (
              <div key={r.variant_id || r.product_id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="font-medium truncate">{r.product_name}{r.variant_name ? ` — ${r.variant_name}` : ''}</div>
                <div className="text-xs text-muted shrink-0">
                  {r.quantity_on_hand} on hand{canSeeNetProfit && r.tied > 0 ? ` · UGX ${r.tied.toLocaleString()} tied up` : ''}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

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
