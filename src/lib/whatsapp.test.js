import { describe, it, expect } from 'vitest'
import { normalizePhone, whatsappLink, buildDailyReport, buildCombinedReport } from './whatsapp'

describe('normalizePhone', () => {
  it('turns local Ugandan numbers into international digits', () => {
    expect(normalizePhone('0740 193 837')).toBe('256740193837')
    expect(normalizePhone('+256 740193837')).toBe('256740193837')
    expect(normalizePhone('256740193837')).toBe('256740193837')
    expect(normalizePhone('00256740193837')).toBe('256740193837')
  })
  it('works for other countries', () => {
    expect(normalizePhone('0712345678', '254')).toBe('254712345678')
  })
  it('handles empty input', () => {
    expect(normalizePhone('')).toBe(null)
    expect(normalizePhone(null)).toBe(null)
    expect(normalizePhone('abc')).toBe(null)
  })
})

describe('whatsappLink', () => {
  it('pre-fills and encodes the message', () => {
    const url = whatsappLink('0740193837', 'Hello & welcome\nline 2')
    expect(url.startsWith('https://wa.me/256740193837?text=')).toBe(true)
    expect(url).toContain(encodeURIComponent('Hello & welcome\nline 2'))
  })
  it('without a number lets the owner pick the chat', () => {
    expect(whatsappLink('', 'hi')).toBe('https://wa.me/?text=hi')
  })
})

const base = {
  businessName: 'Glow Salon', typeLabel: 'Salon / Beauty', currency: 'UGX', dateLabel: 'Sunday 11 Oct',
  servicesOn: true, serviceLabel: 'Appointments', salesTotal: 120000, salesCount: 8, serviceTotal: 340000, serviceCount: 14,
  tips: 0, expensesTotal: 0, topItems: [], outOfStock: 0, lowStock: 0, expiring: 0, openJobs: 0, owedTotal: 0,
}

describe('buildDailyReport', () => {
  it('shows the day at a glance', () => {
    const t = buildDailyReport({ ...base, tips: 15000, expensesTotal: 45000, netProfit: 210000, topItems: [{ name: 'Braids', quantity: 5 }] })
    expect(t).toContain('*Glow Salon*')
    expect(t).toContain('Total today: UGX 460,000')
    expect(t).toContain('Appointments: UGX 340,000 (14)')
    expect(t).toContain('Tips: UGX 15,000')
    expect(t).toContain('Expenses: UGX 45,000')
    expect(t).toContain('Profit today: UGX 210,000')
    expect(t).toContain('1. Braids — 5 sold')
    expect(t).toContain('Nothing needs attention')
  })
  it('never shows profit when it was not provided (cashiers)', () => {
    expect(buildDailyReport(base)).not.toContain('Profit')
  })
  it('omits services for a business without them and lists what needs attention', () => {
    const t = buildDailyReport({ ...base, servicesOn: false, serviceTotal: 0, serviceCount: 0, outOfStock: 2, lowStock: 3, expiring: 4, openJobs: 1, owedTotal: 80000 })
    expect(t).not.toContain('Appointments')
    expect(t).toContain('2 out of stock')
    expect(t).toContain('3 running low')
    expect(t).toContain('4 expired or expiring soon')
    expect(t).toContain('1 open job / booking')
    expect(t).toContain('Customers owe you UGX 80,000')
  })
})

describe('buildCombinedReport', () => {
  it('adds up every business', () => {
    const t = buildCombinedReport([base, { ...base, businessName: 'Kato Hardware', servicesOn: false, serviceTotal: 0, salesTotal: 500000 }], 'Sunday 11 Oct')
    expect(t).toContain('Combined today: UGX 960,000')
    expect(t).toContain('*Glow Salon*: UGX 460,000')
    expect(t).toContain('*Kato Hardware*: UGX 500,000')
  })
  it('a single business gets its normal report', () => {
    expect(buildCombinedReport([base], 'x')).toBe(buildDailyReport(base))
  })
})
