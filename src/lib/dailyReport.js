import { supabase } from './supabase'
import { getProfile, servicesEnabled, getServicesProfile, expiryStatus } from './businessTypes'
import { calcSaleProfit, summarizeServiceTickets, calcNetProfit, sumOwedBalance } from './money'

// Gathers today's numbers for one business, ready for buildDailyReport().
// `includeProfit` must only be true for the owner — cashiers never see profit.
export async function fetchDailyReportData(business, { includeProfit = false } = {}) {
  const profile = getProfile(business)
  const servicesOn = servicesEnabled(business)
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const since = start.toISOString()

  const [sales, services, expenses, stock, debtors, open, products] = await Promise.all([
    supabase
      .from('sales')
      .select('total_amount, is_refunded, sale_items(quantity, unit_price, unit_cost, products(name))')
      .eq('business_id', business.id)
      .gte('created_at', since),
    servicesOn
      ? supabase
          .from('service_tickets')
          .select('amount, commission_amount, supply_cost, tip_amount')
          .eq('business_id', business.id)
          .eq('status', 'completed')
          .gte('created_at', since)
      : Promise.resolve({ data: [] }),
    supabase.from('expenses').select('amount').eq('business_id', business.id).gte('created_at', since),
    supabase.from('product_stock').select('product_id, status, quantity_on_hand').eq('business_id', business.id),
    supabase.from('debtor_summary').select('balance').eq('business_id', business.id),
    servicesOn
      ? supabase.from('service_tickets').select('id', { count: 'exact', head: true }).eq('business_id', business.id).in('status', ['booked', 'in_progress', 'ready'])
      : Promise.resolve({ count: 0 }),
    profile.products.expiry
      ? supabase.from('products').select('id, attributes').eq('business_id', business.id).eq('is_active', true)
      : Promise.resolve({ data: [] }),
  ])

  const activeSales = (sales.data || []).filter((s) => !s.is_refunded)
  const salesTotal = activeSales.reduce((n, s) => n + Number(s.total_amount), 0)
  const serviceSummary = summarizeServiceTickets(services.data || [])
  const tips = (services.data || []).reduce((n, t) => n + (Number(t.tip_amount) || 0), 0)
  const expensesTotal = (expenses.data || []).reduce((n, e) => n + Number(e.amount), 0)

  // Top 3 items by money made today
  const byItem = new Map()
  for (const s of activeSales) {
    for (const i of s.sale_items || []) {
      const name = i.products?.name || 'Item'
      const row = byItem.get(name) || { name, quantity: 0, revenue: 0 }
      row.quantity += Number(i.quantity)
      row.revenue += Number(i.quantity) * Number(i.unit_price)
      byItem.set(name, row)
    }
  }
  const topItems = [...byItem.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 3)

  const onHand = {}
  for (const r of stock.data || []) onHand[r.product_id] = (onHand[r.product_id] || 0) + Number(r.quantity_on_hand || 0)
  const expiring = (products.data || []).filter((p) => {
    const st = expiryStatus(p.attributes?.expiry_date, profile.products.expiry?.warnDays ?? 30)
    return (st === 'expired' || st === 'soon') && (onHand[p.id] || 0) > 0
  }).length

  let netProfit
  if (includeProfit) {
    const gross = activeSales.reduce((n, s) => n + calcSaleProfit(s.sale_items), 0)
    netProfit = calcNetProfit({ grossProfit: gross + serviceSummary.profit, totalExpenses: expensesTotal })
  }

  return {
    businessName: business.name,
    typeLabel: profile.label,
    currency: business.settings?.currency || 'UGX',
    dateLabel: new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }),
    servicesOn,
    serviceLabel: servicesOn ? getServicesProfile(business).nav : null,
    salesTotal,
    salesCount: activeSales.length,
    serviceTotal: serviceSummary.revenue,
    serviceCount: serviceSummary.count,
    tips,
    expensesTotal,
    netProfit,
    topItems,
    outOfStock: (stock.data || []).filter((r) => r.status === 'out_of_stock').length,
    lowStock: (stock.data || []).filter((r) => r.status === 'low_stock').length,
    expiring,
    openJobs: open.count || 0,
    owedTotal: sumOwedBalance(debtors.data),
  }
}
