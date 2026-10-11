import { describe, it, expect } from 'vitest'
import { savePendingBusiness, readPendingBusiness, clearPendingBusiness } from './pendingBusiness'

const details = { email: ' Jane@Shop.com ', name: 'Glow Salon', type: 'salon', ownerName: 'Jane' }

describe('signup details kept while waiting for email confirmation', () => {
  it('are returned for the same email (any capitalisation)', () => {
    savePendingBusiness(details)
    expect(readPendingBusiness('jane@shop.com')).toMatchObject({ name: 'Glow Salon', type: 'salon', ownerName: 'Jane' })
    expect(readPendingBusiness('JANE@shop.com')).not.toBe(null)
  })
  it('are never given to a different account on the same phone', () => {
    savePendingBusiness(details)
    expect(readPendingBusiness('someone.else@mail.com')).toBe(null)
  })
  it('expire after a week', () => {
    savePendingBusiness(details, 1000)
    expect(readPendingBusiness('jane@shop.com', 1000 + 8 * 24 * 3600 * 1000)).toBe(null)
    expect(readPendingBusiness('jane@shop.com', 1000 + 6 * 24 * 3600 * 1000)).not.toBe(null)
  })
  it('can be cleared once used, and bad data is ignored', () => {
    savePendingBusiness(details)
    clearPendingBusiness()
    expect(readPendingBusiness('jane@shop.com')).toBe(null)
    localStorage.setItem('stocktracer_pending_business', '{not json')
    expect(readPendingBusiness('jane@shop.com')).toBe(null)
  })
})
