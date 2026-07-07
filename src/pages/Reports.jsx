import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const PERIODS = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
]

function periodRange(key) {
    const now = new Date()
    if (key === 'today') {
        const start = new Date(now); start.setHours(0, 0, 0, 0)
        return { start, label: now.toLocaleDateString('en-UG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }
    }
    if (key === 'week') {
        const start = new Date(now)
        start.setDate(now.getDate() - now.getDay())
        start.setHours(0, 0, 0, 0)
        return { start, label: `Week of ${start.toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })}` }
    }
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start, label: now.toLocaleDateString('en-UG', { month: 'long', year: 'numeric' }) }
}

function fmt(n) { return 'UGX ' + Number(n || 0).toLocaleString() }
function fmtK(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
    return String(Math.round(n))
}

function LineChart({ points }) {
    const W = 600, H = 160, PL = 48, PR = 12, PT = 12, PB = 32
    const iW = W - PL - PR, iH = H - PT - PB
    if (!points || points.length < 2) return <div className="chart-empty">No data for this period</div>
    const maxY = Math.max(...points.map(p => p.y), 1)
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ v: maxY * t, y: PT + iH - t * iH }))
    const toX = (i) => PL + (i / (points.length - 1)) * iW
    const toY = (v) => PT + iH - (v / maxY) * iH
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.y)}`).join(' ')
    const areaD = `${pathD} L ${toX(points.length - 1)} ${PT + iH} L ${toX(0)} ${PT + iH} Z`
    const xLabels = points.length <= 8
        ? points.map((p, i) => ({ label: p.x, i }))
        : [0, Math.floor(points.length / 4), Math.floor(points.length / 2), Math.floor((3 * points.length) / 4), points.length - 1].map(i => ({ label: points[i].x, i }))
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg">
            {ticks.map((t, i) => (
                <g key={i}>
                    <line x1={PL} y1={t.y} x2={W - PR} y2={t.y} stroke="currentColor" strokeWidth="1" opacity="0.08" />
                    <text x={PL - 4} y={t.y + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.5">{fmtK(t.v)}</text>
                </g>
            ))}
            <path d={areaD} fill="#1F6F5C" opacity="0.08" />
            <path d={pathD} fill="none" stroke="#1F6F5C" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => <circle key={i} cx={toX(i)} cy={toY(p.y)} r="3" fill="#1F6F5C" />)}
            {xLabels.map(({ label, i }) => (
                <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.5">{label}</text>
            ))}
        </svg>
    )
}

function BarChart({ points }) {
    const W = 600, H = 160, PL = 48, PR = 12, PT = 12, PB = 32
    const iW = W - PL - PR, iH = H - PT - PB
    if (!points || points.length === 0) return <div className="chart-empty">No data for this period</div>
    const maxY = Math.max(...points.map(p => p.y), 1)
    const ticks = [0, 0.5, 1].map(t => ({ v: Math.round(maxY * t), y: PT + iH - t * iH }))
    const barW = Math.max(4, (iW / points.length) * 0.6)
    const gap = iW / points.length
    const xLabels = points.length <= 8
        ? points.map((p, i) => ({ label: p.x, i }))
        : [0, Math.floor(points.length / 4), Math.floor(points.length / 2), Math.floor((3 * points.length) / 4), points.length - 1].map(i => ({ label: points[i].x, i }))
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg">
            {ticks.map((t, i) => (
                <g key={i}>
                    <line x1={PL} y1={t.y} x2={W - PR} y2={t.y} stroke="currentColor" strokeWidth="1" opacity="0.08" />
                    <text x={PL - 4} y={t.y + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.5">{t.v}</text>
                </g>
            ))}
            {points.map((p, i) => {
                const barH = Math.max(2, (p.y / maxY) * iH)
                return <rect key={i} x={PL + i * gap + gap / 2 - barW / 2} y={PT + iH - barH} width={barW} height={barH} fill="#1F6F5C" rx="2" opacity="0.85" />
            })}
            {xLabels.map(({ label, i }) => (
                <text key={i} x={PL + i * gap + gap / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.5">{label}</text>
            ))}
        </svg>
    )
}

function HorizontalBarChart({ items }) {
    if (!items || items.length === 0) return <div className="chart-empty">No sales yet</div>
    const max = Math.max(...items.map(p => p.value), 1)
    return (
        <div className="hbar-list">
            {items.map((item, i) => (
                <div key={i} className="hbar-row">
                    <div className="hbar-label" title={item.name}>{i + 1}. {item.name}</div>
                    <div className="hbar-track">
                        <div className="hbar-fill" style={{ width: `${(item.value / max) * 100}%` }} />
                    </div>
                    <div className="hbar-value">{fmt(item.value)}</div>
                </div>
            ))}
        </div>
    )
}

export default function Reports() {
    const { business, activeStaff } = useAuth()
    const [period, setPeriod] = useState('month')
    const [customFrom, setCustomFrom] = useState('')
    const [customTo, setCustomTo] = useState('')
    const [loading, setLoading] = useState(true)
    const printRef = useRef(null)

    const [data, setData] = useState({
        totalRevenue: 0, totalCost: 0, grossProfit: 0,
        totalExpenses: 0, netProfit: 0, salesCount: 0, refundsCount: 0,
        topProducts: [], stockSummary: { inStock: 0, lowStock: 0, outOfStock: 0, totalValue: 0 },
        expensesByCategory: [], revenuePoints: [], salesCountPoints: [],
    })

    useEffect(() => { if (business) load() }, [business, period, customFrom, customTo])

    async function load() {
        setLoading(true)
        const { start, label } = periodRange(period)
        const startISO = start.toISOString()

        const [{ data: salesRaw }, { data: expensesRaw }, { data: stockRaw }] = await Promise.all([
            supabase.from('sales').select('id,total_amount,is_refunded,created_at,sale_items(quantity,unit_price,unit_cost,products(name),product_variants(name))').eq('business_id', business.id).gte('created_at', startISO),
            supabase.from('expenses').select('amount,category').eq('business_id', business.id).gte('created_at', startISO),
            supabase.from('product_stock').select('quantity,reorder_point,unit_cost').eq('business_id', business.id),
        ])

        const validSales = (salesRaw || []).filter(s => !s.is_refunded)
        const refunds = (salesRaw || []).filter(s => s.is_refunded)
        let totalRevenue = 0, totalCost = 0
        const productMap = {}

        validSales.forEach(sale => {
            (sale.sale_items || []).forEach(item => {
                totalRevenue += Number(item.unit_price) * Number(item.quantity)
                totalCost += Number(item.unit_cost) * Number(item.quantity)
                const name = item.products?.name ? (item.product_variants?.name ? `${item.products.name} — ${item.product_variants.name}` : item.products.name) : 'Deleted product'
                if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0, profit: 0 }
                productMap[name].qty += Number(item.quantity)
                productMap[name].revenue += Number(item.unit_price) * Number(item.quantity)
                productMap[name].profit += (Number(item.unit_price) - Number(item.unit_cost)) * Number(item.quantity)
            })
        })

        const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 8)
        const grossProfit = totalRevenue - totalCost
        const totalExpenses = (expensesRaw || []).reduce((s, e) => s + Number(e.amount), 0)
        const netProfit = grossProfit - totalExpenses

        const catMap = {}
            ; (expensesRaw || []).forEach(e => { catMap[e.category || 'Other'] = (catMap[e.category || 'Other'] || 0) + Number(e.amount) })
        const expensesByCategory = Object.entries(catMap).map(([cat, amt]) => ({ cat, amt })).sort((a, b) => b.amt - a.amt)

        let inStock = 0, lowStock = 0, outOfStock = 0, totalValue = 0
            ; (stockRaw || []).forEach(row => {
                const qty = Number(row.quantity), reorder = Number(row.reorder_point || 0)
                totalValue += qty * Number(row.unit_cost || 0)
                if (qty === 0) outOfStock++
                else if (qty <= reorder) lowStock++
                else inStock++
            })

        const revenueByDay = {}, countByDay = {}
        validSales.forEach(sale => {
            const day = sale.created_at.slice(0, 10)
            revenueByDay[day] = (revenueByDay[day] || 0) + (sale.sale_items || []).reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0)
            countByDay[day] = (countByDay[day] || 0) + 1
        })

        const allDays = []
        const cursor = new Date(start); cursor.setHours(0, 0, 0, 0)
        const today = new Date(); today.setHours(23, 59, 59, 999)
        while (cursor <= today) { allDays.push(cursor.toISOString().slice(0, 10)); cursor.setDate(cursor.getDate() + 1) }

        const dayLabel = (d) => {
            const date = new Date(d + 'T12:00:00')
            if (period === 'week') return date.toLocaleString('en', { weekday: 'short' })
            return date.toLocaleString('en', { day: 'numeric', month: 'short' })
        }

        setData({
            totalRevenue, totalCost, grossProfit, totalExpenses, netProfit,
            salesCount: validSales.length, refundsCount: refunds.length,
            topProducts, stockSummary: { inStock, lowStock, outOfStock, totalValue },
            expensesByCategory,
            revenuePoints: allDays.map(d => ({ x: dayLabel(d), y: revenueByDay[d] || 0 })),
            salesCountPoints: allDays.map(d => ({ x: dayLabel(d), y: countByDay[d] || 0 })),
            periodLabel: label,
        })
        setLoading(false)
    }

    if (activeStaff?.role !== 'owner') return <div className="p-8 text-center text-muted text-sm">Reports are only available to the shop owner.</div>

    const margin = data.totalRevenue > 0 ? ((data.grossProfit / data.totalRevenue) * 100).toFixed(1) : '0.0'

    return (
        <div className="reports-page">
            <style>{CSS}</style>
            <div className="reports-header no-print">
                <div>
                    <h1 className="font-display text-xl font-semibold">Reports</h1>
                    <p className="text-sm text-muted mt-0.5">Business performance summary</p>
                </div>
                <div className="reports-actions">
                    <div className="period-tabs">
                        {PERIODS.map(p => (
                            <button key={p.key} onClick={() => setPeriod(p.key)} className={`period-tab ${period === p.key ? 'period-tab--active' : ''}`}>{p.label}</button>
                        ))}
                    </div>
                    <button onClick={() => window.print()} className="btn-secondary no-print">🖨 Print</button>
                    {!loading && <button onClick={() => exportReportCSV(data, period, business?.name)} className="btn-secondary no-print">⬇ Export CSV</button>}
                </div>
            </div>

            {loading ? <div className="p-16 text-center text-muted text-sm">Loading report…</div> : (
                <div ref={printRef}>
                    <div className="print-only mb-6"><div className="text-xl font-bold">{business?.name} — Business Report</div><div className="text-sm text-muted">{data.periodLabel}</div></div>

                    <section className="report-section">
                        <h2 className="report-section-title">Sales Summary <span className="report-period-tag no-print">{data.periodLabel}</span></h2>
                        <div className="report-grid-4">
                            <div className="report-stat"><div className="report-stat-label">Total Revenue</div><div className="report-stat-value text-brand">{fmt(data.totalRevenue)}</div></div>
                            <div className="report-stat"><div className="report-stat-label">Gross Profit</div><div className="report-stat-value text-brand">{fmt(data.grossProfit)}</div><div className="report-stat-sub">Margin {margin}%</div></div>
                            <div className="report-stat"><div className="report-stat-label">Transactions</div><div className="report-stat-value">{data.salesCount}</div>{data.refundsCount > 0 && <div className="report-stat-sub text-brick">{data.refundsCount} refund{data.refundsCount > 1 ? 's' : ''}</div>}</div>
                            <div className="report-stat"><div className="report-stat-label">Cost of Goods</div><div className="report-stat-value">{fmt(data.totalCost)}</div></div>
                        </div>
                    </section>

                    <section className="report-section">
                        <h2 className="report-section-title">Revenue Over Time</h2>
                        <LineChart points={data.revenuePoints} />
                    </section>

                    <section className="report-section">
                        <h2 className="report-section-title">Sales Count Per Day</h2>
                        <BarChart points={data.salesCountPoints} />
                    </section>

                    <section className="report-section">
                        <h2 className="report-section-title">Profit After Expenses</h2>
                        <div className="report-grid-3">
                            <div className="report-stat"><div className="report-stat-label">Gross Profit</div><div className="report-stat-value">{fmt(data.grossProfit)}</div></div>
                            <div className="report-stat"><div className="report-stat-label">Total Expenses</div><div className="report-stat-value text-brick">− {fmt(data.totalExpenses)}</div></div>
                            <div className={`report-stat ${data.netProfit >= 0 ? 'report-stat--success' : 'report-stat--danger'}`}>
                                <div className="report-stat-label">Net Profit</div>
                                <div className={`report-stat-value ${data.netProfit >= 0 ? 'text-brand' : 'text-brick'}`}>{fmt(data.netProfit)}</div>
                            </div>
                        </div>
                        {data.expensesByCategory.length > 0 && (
                            <div className="report-table-wrap mt-4">
                                <table className="report-table">
                                    <thead><tr><th>Expense Category</th><th className="ta-right">Amount</th><th className="ta-right">%</th></tr></thead>
                                    <tbody>{data.expensesByCategory.map(({ cat, amt }) => (
                                        <tr key={cat}><td>{cat}</td><td className="ta-right">{fmt(amt)}</td><td className="ta-right text-muted">{data.totalExpenses > 0 ? ((amt / data.totalExpenses) * 100).toFixed(1) : 0}%</td></tr>
                                    ))}</tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    {data.topProducts.length > 0 && (
                        <section className="report-section">
                            <h2 className="report-section-title">Top Products by Revenue</h2>
                            <HorizontalBarChart items={data.topProducts.map(p => ({ name: p.name, value: p.revenue }))} />
                        </section>
                    )}

                    <section className="report-section">
                        <h2 className="report-section-title">Stock Levels</h2>
                        <div className="report-grid-4">
                            <div className="report-stat"><div className="report-stat-label">In Stock</div><div className="report-stat-value text-brand">{data.stockSummary.inStock}</div><div className="report-stat-sub">products</div></div>
                            <div className="report-stat"><div className="report-stat-label">Low Stock</div><div className="report-stat-value text-amber">{data.stockSummary.lowStock}</div><div className="report-stat-sub">need reorder</div></div>
                            <div className="report-stat"><div className="report-stat-label">Out of Stock</div><div className="report-stat-value text-brick">{data.stockSummary.outOfStock}</div><div className="report-stat-sub">unavailable</div></div>
                            <div className="report-stat"><div className="report-stat-label">Stock Value</div><div className="report-stat-value">{fmt(data.stockSummary.totalValue)}</div><div className="report-stat-sub">at cost price</div></div>
                        </div>
                    </section>

                    <div className="print-only mt-8 pt-4 border-t border-line text-xs text-muted">Generated by StockTracer · {new Date().toLocaleString('en-UG')}</div>
                </div>
            )}
        </div>
    )
}

const CSS = `
  @media print {
    body * { visibility: hidden !important; }
    .reports-page, .reports-page * { visibility: visible !important; }
    .reports-page { position: fixed; top: 0; left: 0; width: 100%; padding: 24px; }
    .no-print { display: none !important; }
    .print-only { display: block !important; }
  }
  .print-only { display: none; }
  .reports-page { padding: 24px; max-width: 860px; margin: 0 auto; }
  .reports-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; flex-wrap: wrap; gap: 12px; }
  .reports-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .period-tabs { display: flex; gap: 2px; background: var(--color-paper); border: 1px solid var(--color-line); border-radius: 8px; padding: 3px; }
  .period-tab { padding: 5px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; color: var(--color-muted); background: none; border: none; cursor: pointer; transition: all 120ms; }
  .period-tab--active { background: var(--color-paper-raised); color: var(--color-ink); box-shadow: 0 1px 3px rgba(0,0,0,0.08); border: 1px solid var(--color-line); }
  .report-section { background: var(--color-paper-raised); border: 1px solid var(--color-line); border-radius: 10px; padding: 20px 24px; margin-bottom: 16px; }
  .report-section-title { font-size: 14px; font-weight: 600; color: var(--color-ink); margin: 0 0 16px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .report-period-tag { font-size: 11px; font-weight: 500; color: var(--color-muted); background: var(--color-paper); border: 1px solid var(--color-line); border-radius: 99px; padding: 2px 8px; }
  .report-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .report-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .report-stat { background: var(--color-paper); border: 1px solid var(--color-line); border-radius: 8px; padding: 14px 16px; }
  .report-stat--success { background: var(--color-brand-light); border-color: var(--color-brand); border-width: 1.5px; }
  .report-stat--danger { background: var(--color-brick-light); border-color: var(--color-brick); border-width: 1.5px; }
  .report-stat-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; color: var(--color-muted); margin-bottom: 6px; }
  .report-stat-value { font-size: 18px; font-weight: 600; color: var(--color-ink); line-height: 1.2; }
  .report-stat-sub { font-size: 11px; color: var(--color-muted); margin-top: 3px; }
  .report-table-wrap { border: 1px solid var(--color-line); border-radius: 8px; overflow: hidden; }
  .report-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  .report-table thead tr { background: var(--color-paper); border-bottom: 1px solid var(--color-line); }
  .report-table th { padding: 9px 14px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; color: var(--color-muted); }
  .report-table tbody tr { border-bottom: 1px solid var(--color-line); }
  .report-table tbody tr:last-child { border-bottom: none; }
  .report-table td { padding: 11px 14px; color: var(--color-ink); }
  .ta-right { text-align: right !important; }
  .text-brand { color: var(--color-brand) !important; }
  .text-brick { color: var(--color-brick) !important; }
  .text-amber { color: var(--color-amber) !important; }
  .text-muted { color: var(--color-muted) !important; }
  .chart-svg { width: 100%; height: auto; color: var(--color-ink); display: block; }
  .chart-empty { padding: 32px; text-align: center; font-size: 13px; color: var(--color-muted); }
  .hbar-list { display: flex; flex-direction: column; gap: 10px; }
  .hbar-row { display: grid; grid-template-columns: 180px 1fr 130px; align-items: center; gap: 12px; }
  .hbar-label { font-size: 13px; color: var(--color-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .hbar-track { height: 10px; background: var(--color-line); border-radius: 99px; overflow: hidden; }
  .hbar-fill { height: 100%; border-radius: 99px; background: var(--color-brand); transition: width 400ms ease; }
  .hbar-value { font-size: 12px; color: var(--color-muted); text-align: right; white-space: nowrap; }
  @media (max-width: 640px) {
    .reports-page { padding: 16px; }
    .report-grid-4 { grid-template-columns: repeat(2, 1fr); }
    .report-grid-3 { grid-template-columns: 1fr; }
    .hbar-row { grid-template-columns: 1fr 90px; }
    .hbar-label { display: none; }
  }
`