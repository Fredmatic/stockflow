import { describe, it, expect } from 'vitest'
import {
  calcCommission,
  calcServiceProfit,
  calcSaleItemProfit,
  calcSaleProfit,
  summarizeServiceTickets,
  calcNetProfit,
  sumOwedBalance,
} from './money'

describe('calcCommission', () => {
  it('takes a percentage of the amount', () => {
    expect(calcCommission(20000, 15)).toBe(3000)
  })

  it('rounds to the nearest whole UGX', () => {
    expect(calcCommission(10000, 33)).toBe(3300)
    expect(calcCommission(1000, 12.5)).toBe(125)
  })

  it('is zero when percentage is zero', () => {
    expect(calcCommission(50000, 0)).toBe(0)
  })

  it('treats missing/blank inputs as zero instead of throwing', () => {
    expect(calcCommission(undefined, 10)).toBe(0)
    expect(calcCommission(10000, undefined)).toBe(0)
    expect(calcCommission('', '')).toBe(0)
  })
})

describe('calcServiceProfit', () => {
  it('subtracts commission and supply cost from the amount charged', () => {
    expect(calcServiceProfit({ amount: 20000, commissionAmount: 3000, supplyCost: 2000 })).toBe(15000)
  })

  it('can go negative if costs exceed the amount charged', () => {
    expect(calcServiceProfit({ amount: 5000, commissionAmount: 3000, supplyCost: 4000 })).toBe(-2000)
  })

  it('defaults missing fields to zero', () => {
    expect(calcServiceProfit({ amount: 10000 })).toBe(10000)
  })
})

describe('calcSaleItemProfit', () => {
  it('multiplies quantity by the margin per unit', () => {
    expect(calcSaleItemProfit({ quantity: 3, unit_price: 5000, unit_cost: 3000 })).toBe(6000)
  })

  it('handles a single unit', () => {
    expect(calcSaleItemProfit({ quantity: 1, unit_price: 5000, unit_cost: 3000 })).toBe(2000)
  })

  it('handles zero cost (pure profit)', () => {
    expect(calcSaleItemProfit({ quantity: 2, unit_price: 1000, unit_cost: 0 })).toBe(2000)
  })
})

describe('calcSaleProfit', () => {
  it('sums profit across every line item in a sale', () => {
    const items = [
      { quantity: 2, unit_price: 5000, unit_cost: 3000 }, // 4000
      { quantity: 1, unit_price: 10000, unit_cost: 7000 }, // 3000
    ]
    expect(calcSaleProfit(items)).toBe(7000)
  })

  it('returns 0 for an empty or missing item list', () => {
    expect(calcSaleProfit([])).toBe(0)
    expect(calcSaleProfit(undefined)).toBe(0)
  })
})

describe('summarizeServiceTickets', () => {
  it('aggregates revenue, commission, supply cost, profit, and count', () => {
    const tickets = [
      { amount: 20000, commission_amount: 3000, supply_cost: 2000 }, // profit 15000
      { amount: 15000, commission_amount: 1500, supply_cost: 0 }, // profit 13500
    ]
    const totals = summarizeServiceTickets(tickets)
    expect(totals).toEqual({
      revenue: 35000,
      commission: 4500,
      supply: 2000,
      profit: 28500,
      count: 2,
    })
  })

  it('returns all zeros for an empty list', () => {
    expect(summarizeServiceTickets([])).toEqual({
      revenue: 0, commission: 0, supply: 0, profit: 0, count: 0,
    })
  })

  it('handles a missing/null list without throwing', () => {
    expect(summarizeServiceTickets(undefined).count).toBe(0)
  })
})

describe('calcNetProfit', () => {
  it('subtracts expenses from gross profit', () => {
    expect(calcNetProfit({ grossProfit: 100000, totalExpenses: 40000 })).toBe(60000)
  })

  it('can be negative when expenses exceed profit', () => {
    expect(calcNetProfit({ grossProfit: 10000, totalExpenses: 25000 })).toBe(-15000)
  })
})

describe('sumOwedBalance', () => {
  it('sums positive balances only', () => {
    const debtors = [{ balance: 5000 }, { balance: 3000 }]
    expect(sumOwedBalance(debtors)).toBe(8000)
  })

  it('ignores negative balances (credit, not debt) instead of subtracting them', () => {
    const debtors = [{ balance: 5000 }, { balance: -2000 }]
    expect(sumOwedBalance(debtors)).toBe(5000)
  })

  it('returns 0 for an empty list', () => {
    expect(sumOwedBalance([])).toBe(0)
  })
})
