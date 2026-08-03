// Every calculation here touches real money in someone's business.
// This file exists so that formula lives in exactly ONE place — pages
// import these instead of re-deriving the math inline. If this file is
// correct, every screen that uses it is correct.
//
// Rounding: commission is rounded to the nearest whole UGX (no cents in
// this currency), everything else stays exact until display time.

/** Commission owed to staff for a given amount and percentage. */
export function calcCommission(amount, commissionPct) {
  const amt = Number(amount) || 0
  const pct = Number(commissionPct) || 0
  return Math.round((amt * pct) / 100)
}

/**
 * Net profit on a single service ticket: what the customer paid, minus
 * what it cost the shop (staff commission + supplies used).
 */
export function calcServiceProfit({ amount, commissionAmount, supplyCost }) {
  return (Number(amount) || 0) - (Number(commissionAmount) || 0) - (Number(supplyCost) || 0)
}

/** Profit on one sold line item: (price - cost) × quantity. Accepts the
 *  raw snake_case shape Supabase returns (quantity, unit_price, unit_cost). */
export function calcSaleItemProfit({ quantity, unit_price, unit_cost }) {
  return (Number(quantity) || 0) * ((Number(unit_price) || 0) - (Number(unit_cost) || 0))
}

/** Sums calcSaleItemProfit across every item in a sale. */
export function calcSaleProfit(saleItems) {
  return (saleItems || []).reduce((sum, item) => sum + calcSaleItemProfit(item), 0)
}

/**
 * Aggregates a list of service tickets into revenue / cost / profit /
 * count totals for a given period (used by Dashboard, Reports, Services).
 */
export function summarizeServiceTickets(tickets) {
  return (tickets || []).reduce(
    (acc, t) => {
      const commission = Number(t.commission_amount) || 0
      const supply = Number(t.supply_cost) || 0
      const amount = Number(t.amount) || 0
      acc.revenue += amount
      acc.commission += commission
      acc.supply += supply
      acc.profit += calcServiceProfit({ amount, commissionAmount: commission, supplyCost: supply })
      acc.count += 1
      return acc
    },
    { revenue: 0, commission: 0, supply: 0, profit: 0, count: 0 }
  )
}

/** Net profit after subtracting business expenses from gross profit. */
export function calcNetProfit({ grossProfit, totalExpenses }) {
  return (Number(grossProfit) || 0) - (Number(totalExpenses) || 0)
}

/** Sums how much is owed across a list of debtor balances (never negative). */
export function sumOwedBalance(debtors) {
  return (debtors || []).reduce((sum, d) => sum + Math.max(0, Number(d.balance) || 0), 0)
}
