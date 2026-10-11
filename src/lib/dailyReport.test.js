import { describe, it, expect, beforeEach, vi } from 'vitest'
vi.mock('./supabase', async () => await import('../test/mockSupabase.js'))
import { fetchDailyReportData } from './dailyReport'

beforeEach(() => {
  globalThis.__tables = {
    sales: [
      { total_amount: 30000, is_refunded: false, sale_items: [{ quantity: 2, unit_price: 10000, unit_cost: 6000, products: { name: 'Cement' } }, { quantity: 1, unit_price: 10000, unit_cost: 7000, products: { name: 'Nails' } }] },
      { total_amount: 99999, is_refunded: true, sale_items: [{ quantity: 9, unit_price: 11111, unit_cost: 1, products: { name: 'Refunded' } }] },
    ],
    service_tickets: [],
    expenses: [{ amount: 5000 }],
    product_stock: [
      { product_id: 'p1', status: 'out_of_stock', quantity_on_hand: 0 },
      { product_id: 'p2', status: 'low_stock', quantity_on_hand: 2 },
      { product_id: 'p3', status: 'in_stock', quantity_on_hand: 50 },
    ],
    debtor_summary: [{ balance: 40000 }, { balance: 0 }],
    products: [],
  }
})

describe('daily report numbers', () => {
  const biz = { id: 'b1', name: 'Kato Hardware', type: 'hardware' }

  it('ignores refunds, counts stock problems and what customers owe', async () => {
    const d = await fetchDailyReportData(biz)
    expect(d.salesTotal).toBe(30000)
    expect(d.salesCount).toBe(1)
    expect(d.outOfStock).toBe(1)
    expect(d.lowStock).toBe(1)
    expect(d.owedTotal).toBe(40000)
    expect(d.topItems[0]).toMatchObject({ name: 'Cement', quantity: 2 })
    expect(d.topItems.some((t) => t.name === 'Refunded')).toBe(false)
  })

  it('hides profit unless the owner asked for it; shows it correctly when they did', async () => {
    expect((await fetchDailyReportData(biz)).netProfit).toBeUndefined()
    // gross profit = 2×(10000−6000) + 1×(10000−7000) = 11,000; minus 5,000 expenses
    expect((await fetchDailyReportData(biz, { includeProfit: true })).netProfit).toBe(6000)
  })

  it('a hardware store has no services line; a salon does', async () => {
    expect((await fetchDailyReportData(biz)).servicesOn).toBe(false)
    expect((await fetchDailyReportData({ ...biz, type: 'salon' })).servicesOn).toBe(true)
  })
})
