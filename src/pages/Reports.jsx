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
    // month
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start, label: now.toLocaleDateString('en-UG', { month: 'long', year: 'numeric' }) }
}

function fmt(n) {
    return 'UGX ' + Number(n || 0).toLocaleString()
}

export default function Reports() {
    const { business, activeStaff } = useAuth()
    const [period, setPeriod] = useState('month')
    const [loading, setLoading] = useState(true)
    const [printing, setPrinting] = useState(false)
    const printRef = useRef(null)

    const [data, setData] = useState({
        totalRevenue: 0,
        totalCost: 0,
        grossProfit: 0,
        totalExpenses: 0,
        netProfit: 0,
        salesCount: 0,
        refundsCount: 0,
        topProducts: [],
        stockSummary: { inStock: 0, lowStock: 0, outOfStock: 0, totalValue: 0 },
        expensesByCategory: [],
    })

    useEffect(() => {
        if (!business) return
        load()
    }, [business, period])

    async function load() {
        setLoading(true)
        const { start, label } = periodRange(period)
        const startISO = start.toISOString()

        const [
            { data: salesRaw },
            { data: expensesRaw },
            { data: stockRaw },
        ] = await Promise.all([
            supabase
                .from('sales')
                .select('id, total_amount, is_refunded, sale_items(quantity, unit_price, unit_cost, products(name), product_variants(name))')
                .eq('business_id', business.id)
                .gte('created_at', startISO),
            supabase
                .from('expenses')
                .select('amount, category')
                .eq('business_id', business.id)
                .gte('created_at', startISO),
            supabase
                .from('product_stock')
                .select('quantity, reorder_point, unit_cost')
                .eq('business_id', business.id),
        ])

        // ── Sales summary ──
        const validSales = (salesRaw || []).filter(s => !s.is_refunded)
        const refunds = (salesRaw || []).filter(s => s.is_refunded)
        let totalRevenue = 0, totalCost = 0

        // Top products map
        const productMap = {}
        validSales.forEach(sale => {
            (sale.sale_items || []).forEach(item => {
                totalRevenue += Number(item.unit_price) * Number(item.quantity)
                totalCost += Number(item.unit_cost) * Number(item.quantity)
                const name = item.products?.name
                    ? (item.product_variants?.name ? `${item.products.name} — ${item.product_variants.name}` : item.products.name)
                    : 'Deleted product'
                if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0, profit: 0 }
                productMap[name].qty += Number(item.quantity)
                productMap[name].revenue += Number(item.unit_price) * Number(item.quantity)
                productMap[name].profit += (Number(item.unit_price) - Number(item.unit_cost)) * Number(item.quantity)
            })
        })

        const topProducts = Object.values(productMap)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 8)

        const grossProfit = totalRevenue - totalCost
        const totalExpenses = (expensesRaw || []).reduce((s, e) => s + Number(e.amount), 0)
        const netProfit = grossProfit - totalExpenses

        // ── Expenses by category ──
        const catMap = {}
            ; (expensesRaw || []).forEach(e => {
                catMap[e.category || 'Other'] = (catMap[e.category || 'Other'] || 0) + Number(e.amount)
            })
        const expensesByCategory = Object.entries(catMap)
            .map(([cat, amt]) => ({ cat, amt }))
            .sort((a, b) => b.amt - a.amt)

        // ── Stock summary ──
        let inStock = 0, lowStock = 0, outOfStock = 0, totalValue = 0
            ; (stockRaw || []).forEach(row => {
                const qty = Number(row.quantity)
                const reorder = Number(row.reorder_point || 0)
                totalValue += qty * Number(row.unit_cost || 0)
                if (qty === 0) outOfStock++
                else if (qty <= reorder) lowStock++
                else inStock++
            })

        setData({
            totalRevenue, totalCost, grossProfit,
            totalExpenses, netProfit,
            salesCount: validSales.length,
            refundsCount: refunds.length,
            topProducts, stockSummary: { inStock, lowStock, outOfStock, totalValue },
            expensesByCategory,
            periodLabel: label,
        })
        setLoading(false)
    }

    function handlePrint() {
        setPrinting(true)
        setTimeout(() => {
            window.print()
            setPrinting(false)
        }, 100)
    }

    if (activeStaff?.role !== 'owner') {
        return (
            <div className="p-8 text-center text-muted text-sm">
                Reports are only available to the shop owner.
            </div>
        )
    }

    const margin = data.totalRevenue > 0 ? ((data.grossProfit / data.totalRevenue) * 100).toFixed(1) : '0.0'

    return (
        <div className="reports-page">
            {/* Print-only styles injected */}
            <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .reports-print-area, .reports-print-area * { visibility: visible !important; }
          .reports-print-area { position: fixed; top: 0; left: 0; width: 100%; padding: 24px; }
          .no-print { display: none !important; }
          .reports-page { background: white !important; }
        }
      `}</style>

            {/* Header */}
            <div className="reports-header no-print">
                <div>
                    <h1 className="font-display text-xl font-semibold">Reports</h1>
                    <p className="text-sm text-muted mt-0.5">Business performance summary</p>
                </div>
                <div className="reports-actions">
                    <div className="flex gap-1 bg-paper rounded-md p-1 border border-line">
                        {PERIODS.map(p => (
                            <button
                                key={p.key}
                                onClick={() => setPeriod(p.key)}
                                className={`px-3 py-1.5 text-sm rounded font-medium transition-colors ${period === p.key
                                        ? 'bg-paper-raised shadow-sm text-ink border border-line'
                                        : 'text-muted hover:text-ink'
                                    }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <button onClick={handlePrint} className="btn-secondary flex items-center gap-1.5 text-sm">
                        🖨 Print
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="p-16 text-center text-muted text-sm">Loading report…</div>
            ) : (
                <div className="reports-print-area" ref={printRef}>

                    {/* Print title */}
                    <div className="print-title hidden print:block mb-6">
                        <div className="text-xl font-bold">{business?.name} — Business Report</div>
                        <div className="text-sm text-muted">{data.periodLabel}</div>
                    </div>

                    {/* ── Section 1: Sales Summary ── */}
                    <section className="report-section">
                        <h2 className="report-section-title">Sales Summary <span className="report-period-tag no-print">{data.periodLabel}</span></h2>
                        <div className="report-grid-4">
                            <div className="report-stat">
                                <div className="report-stat-label">Total Revenue</div>
                                <div className="report-stat-value text-brand">{fmt(data.totalRevenue)}</div>
                            </div>
                            <div className="report-stat">
                                <div className="report-stat-label">Gross Profit</div>
                                <div className="report-stat-value text-brand">{fmt(data.grossProfit)}</div>
                                <div className="report-stat-sub">Margin {margin}%</div>
                            </div>
                            <div className="report-stat">
                                <div className="report-stat-label">Transactions</div>
                                <div className="report-stat-value">{data.salesCount}</div>
                                {data.refundsCount > 0 && <div className="report-stat-sub text-brick">{data.refundsCount} refund{data.refundsCount > 1 ? 's' : ''}</div>}
                            </div>
                            <div className="report-stat">
                                <div className="report-stat-label">Cost of Goods</div>
                                <div className="report-stat-value">{fmt(data.totalCost)}</div>
                            </div>
                        </div>
                    </section>

                    {/* ── Section 2: Profit After Expenses ── */}
                    <section className="report-section">
                        <h2 className="report-section-title">Profit After Expenses</h2>
                        <div className="report-grid-3">
                            <div className="report-stat">
                                <div className="report-stat-label">Gross Profit</div>
                                <div className="report-stat-value">{fmt(data.grossProfit)}</div>
                            </div>
                            <div className="report-stat">
                                <div className="report-stat-label">Total Expenses</div>
                                <div className="report-stat-value text-brick">− {fmt(data.totalExpenses)}</div>
                            </div>
                            <div className={`report-stat report-stat-highlight ${data.netProfit >= 0 ? 'report-stat-highlight--success' : 'report-stat-highlight--danger'}`}>
                                <div className="report-stat-label">Net Profit</div>
                                <div className={`report-stat-value ${data.netProfit >= 0 ? 'text-brand' : 'text-brick'}`}>
                                    {fmt(data.netProfit)}
                                </div>
                            </div>
                        </div>

                        {data.expensesByCategory.length > 0 && (
                            <div className="report-table-wrap mt-4">
                                <table className="report-table">
                                    <thead>
                                        <tr>
                                            <th>Expense Category</th>
                                            <th className="ta-right">Amount</th>
                                            <th className="ta-right">% of Expenses</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.expensesByCategory.map(({ cat, amt }) => (
                                            <tr key={cat}>
                                                <td>{cat}</td>
                                                <td className="ta-right">{fmt(amt)}</td>
                                                <td className="ta-right text-muted">
                                                    {data.totalExpenses > 0 ? ((amt / data.totalExpenses) * 100).toFixed(1) : 0}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    {/* ── Section 3: Top Selling Products ── */}
                    {data.topProducts.length > 0 && (
                        <section className="report-section">
                            <h2 className="report-section-title">Top Selling Products</h2>
                            <div className="report-table-wrap">
                                <table className="report-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Product</th>
                                            <th className="ta-right">Units Sold</th>
                                            <th className="ta-right">Revenue</th>
                                            <th className="ta-right">Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.topProducts.map((p, i) => (
                                            <tr key={p.name}>
                                                <td className="text-muted">{i + 1}</td>
                                                <td className="font-medium">{p.name}</td>
                                                <td className="ta-right">{p.qty}</td>
                                                <td className="ta-right">{fmt(p.revenue)}</td>
                                                <td className={`ta-right ${p.profit >= 0 ? 'text-brand' : 'text-brick'}`}>{fmt(p.profit)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    {/* ── Section 4: Stock Levels ── */}
                    <section className="report-section">
                        <h2 className="report-section-title">Stock Levels</h2>
                        <div className="report-grid-4">
                            <div className="report-stat">
                                <div className="report-stat-label">In Stock</div>
                                <div className="report-stat-value text-brand">{data.stockSummary.inStock}</div>
                                <div className="report-stat-sub">products</div>
                            </div>
                            <div className="report-stat">
                                <div className="report-stat-label">Low Stock</div>
                                <div className="report-stat-value text-amber">{data.stockSummary.lowStock}</div>
                                <div className="report-stat-sub">need reorder</div>
                            </div>
                            <div className="report-stat">
                                <div className="report-stat-label">Out of Stock</div>
                                <div className="report-stat-value text-brick">{data.stockSummary.outOfStock}</div>
                                <div className="report-stat-sub">unavailable</div>
                            </div>
                            <div className="report-stat">
                                <div className="report-stat-label">Stock Value</div>
                                <div className="report-stat-value">{fmt(data.stockSummary.totalValue)}</div>
                                <div className="report-stat-sub">at cost price</div>
                            </div>
                        </div>
                    </section>

                    {/* Print footer */}
                    <div className="print-footer hidden print:block mt-8 pt-4 border-t border-line text-xs text-muted">
                        Generated by StockTracer · {new Date().toLocaleString('en-UG')}
                    </div>
                </div>
            )}
        </div>
    )
}