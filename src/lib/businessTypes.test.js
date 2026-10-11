import { describe, it, expect } from 'vitest'
import { BUSINESS_TYPES, BUSINESS_TYPE_LIST, getProfile, navItemsFor, servicesEnabled, isStockTracked, priceForQuantity, expiryStatus } from './businessTypes'
import { summarizeServiceTickets, calcBalanceDue, calcUnitPrice } from './money'

describe('business profiles', () => {
  it('every type has what the pages need', () => {
    for (const t of BUSINESS_TYPE_LIST) {
      expect(t.vocab.products).toBeTruthy()
      expect(t.products.categories.length).toBeGreaterThan(0)
      expect(Array.isArray(t.sale.fields)).toBe(true)
      expect(t.expenses.length).toBeGreaterThan(5)
      if (t.modules.services) expect(t.services.presets.length).toBeGreaterThan(0)
    }
    expect(BUSINESS_TYPE_LIST).toHaveLength(Object.keys(BUSINESS_TYPES).length)
  })
  it('unknown type falls back to retail', () => {
    expect(getProfile('nonsense').value).toBe('retail')
  })
  it('menu has Reports exactly once and no duplicates', () => {
    for (const t of BUSINESS_TYPE_LIST) {
      const paths = navItemsFor({ type: t.value }).map((n) => n.to)
      expect(new Set(paths).size).toBe(paths.length)
      expect(paths.filter((p) => p === '/reports')).toHaveLength(1)
    }
  })
  it('menus differ by business', () => {
    const salon = navItemsFor({ type: 'salon' })
    const pharm = navItemsFor({ type: 'pharmacy' })
    expect(salon[1].label).toBe('Appointments')
    expect(pharm.find((n) => n.to === '/sell').label).toBe('Dispense')
    expect(pharm.some((n) => n.to === '/services')).toBe(false)
  })
  it('owner can switch Services on for any type', () => {
    expect(servicesEnabled({ type: 'hardware' })).toBe(false)
    expect(servicesEnabled({ type: 'hardware', settings: { services: true } })).toBe(true)
    expect(servicesEnabled({ type: 'salon', settings: { services: false } })).toBe(false)
  })
  it('made-to-order items are not stock tracked; older items are', () => {
    expect(isStockTracked({ track_stock: false })).toBe(false)
    expect(isStockTracked({})).toBe(true)
    expect(isStockTracked(undefined)).toBe(true)
  })
  it('bulk price applies from the minimum quantity', () => {
    const a = { bulk_min_qty: 10, bulk_price: 4500 }
    expect(priceForQuantity(5000, a, 9)).toBe(5000)
    expect(priceForQuantity(5000, a, 10)).toBe(4500)
    expect(priceForQuantity(5000, {}, 100)).toBe(5000)
    expect(calcUnitPrice({ basePrice: 5000, bulkMinQty: 10, bulkPrice: 4500, quantity: 12 })).toBe(4500)
  })
  it('expiry status', () => {
    const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10) }
    expect(expiryStatus(d(-1), 30)).toBe('expired')
    expect(expiryStatus(d(10), 30)).toBe('soon')
    expect(expiryStatus(d(100), 30)).toBe('ok')
    expect(expiryStatus(null, 30)).toBe(null)
  })
})

describe('open service work is not revenue', () => {
  it('only completed (or status-less) tickets are counted', () => {
    const r = summarizeServiceTickets([
      { amount: 10000, commission_amount: 4000, supply_cost: 0, status: 'completed' },
      { amount: 5000, commission_amount: 0, supply_cost: 0 },
      { amount: 99999, commission_amount: 0, supply_cost: 0, status: 'in_progress' },
      { amount: 99999, commission_amount: 0, supply_cost: 0, status: 'cancelled' },
    ])
    expect(r.revenue).toBe(15000)
    expect(r.count).toBe(2)
  })
  it('balance due after deposit never goes negative', () => {
    expect(calcBalanceDue({ amount: 50000, depositAmount: 20000 })).toBe(30000)
    expect(calcBalanceDue({ amount: 1000, depositAmount: 5000 })).toBe(0)
  })
})
