// Screen-level tests: render real screens the way a person would see them and
// check what they can read and do — for several kinds of business.
import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../lib/supabase', async () => await import('../test/mockSupabase.js'))
const auth = { current: null }
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.current }))

import SaleMetaFields, { initialSaleMeta, validateSaleMeta, cleanSaleMeta } from './SaleMetaFields'
import BusinessTypePicker from './BusinessTypePicker'
import BusinessSwitcher from './BusinessSwitcher'
import ErrorBoundary from './ErrorBoundary'
import Services from '../pages/Services'
import { BUSINESS_TYPE_LIST } from '../lib/businessTypes'

const owner = { id: 's1', name: 'Jane', role: 'owner' }
const cashier = { id: 's2', name: 'Moses', role: 'cashier' }
const setAuth = (business, staff = owner, extra = {}) => {
  auth.current = { business, businesses: [business], activeStaff: staff, switchBusiness: vi.fn(), setBusiness: vi.fn(), ...extra }
}

beforeEach(() => {
  globalThis.__tables = {}
  globalThis.__writes = []
})

describe('till questions for each kind of business', () => {
  function Harness({ business, hasRx = false }) {
    const [meta, setMeta] = React.useState(() => initialSaleMeta(business))
    return <SaleMetaFields business={business} meta={meta} setMeta={setMeta} hasRx={hasRx} />
  }

  it('restaurant asks for a table when dining in, and for an address when delivering', () => {
    render(<Harness business={{ type: 'restaurant' }} />)
    expect(screen.getByText('Table / seat')).toBeTruthy()
    expect(screen.queryByText('Delivery address & phone')).toBeNull()
    fireEvent.click(screen.getByText('Delivery'))
    expect(screen.getByText('Delivery address & phone')).toBeTruthy()
    expect(screen.queryByText('Table / seat')).toBeNull()
  })

  it('a retail shop gets no extra questions at the till', () => {
    const { container } = render(<Harness business={{ type: 'retail' }} />)
    expect(container.textContent).toBe('')
  })

  it('pharmacy demands the patient name only when a prescription medicine is in the cart', () => {
    const b = { type: 'pharmacy' }
    expect(validateSaleMeta(b, {}, false)).toBe(null)
    expect(validateSaleMeta(b, {}, true)).toMatch(/patient name/i)
    expect(validateSaleMeta(b, { patient: 'Aisha' }, true)).toBe(null)
    render(<Harness business={b} hasRx />)
    expect(screen.getByText('Prescribed by / clinic')).toBeTruthy()
  })

  it('only saves answers to questions that were showing', () => {
    const b = { type: 'restaurant' }
    expect(cleanSaleMeta(b, { order_type: 'Takeaway', table: 'Table 4', deliver_to: ' ' }, false)).toEqual({ order_type: 'Takeaway' })
  })
})

describe('business type picker', () => {
  it('offers every kind of business and reports the choice', () => {
    const onChange = vi.fn()
    render(<BusinessTypePicker value="" onChange={onChange} />)
    for (const t of BUSINESS_TYPE_LIST) expect(screen.getByText(new RegExp(t.label.replace(/[/()]/g, '.')))).toBeTruthy()
    fireEvent.click(screen.getByText(/Salon/))
    expect(onChange).toHaveBeenCalledWith('salon')
  })
})

describe('business switcher', () => {
  const a = { id: 'a', name: 'Glow Salon', type: 'salon' }
  const b = { id: 'b', name: 'Kato Hardware', type: 'hardware' }
  const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

  it('lets the owner see and switch between their businesses', () => {
    const switchBusiness = vi.fn()
    setAuth(a, owner, { businesses: [a, b], switchBusiness })
    wrap(<BusinessSwitcher />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Kato Hardware')).toBeTruthy()
    expect(screen.getByText(/Add another business/)).toBeTruthy()
    fireEvent.click(screen.getByText('Kato Hardware'))
    expect(switchBusiness).toHaveBeenCalledWith('b')
  })

  it('shows a cashier only the name — no way to switch or add businesses', () => {
    setAuth(a, cashier, { businesses: [a, b] })
    wrap(<BusinessSwitcher />)
    expect(screen.getByText(/Glow Salon/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByText('Kato Hardware')).toBeNull()
  })
})

describe('services screen adapts to the business', () => {
  it('barbershop: walk-in log with barber, commission and tips', () => {
    setAuth({ id: 'a', name: 'Fresh Cuts', type: 'barbershop' })
    render(<Services />)
    expect(screen.getByText('Cuts & services')).toBeTruthy()
    expect(screen.getByText('Barber')).toBeTruthy()
    expect(screen.getByText('Haircut')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Log service' })).toBeTruthy()
    expect(screen.queryByText('Book for later')).toBeNull()
  })

  it('salon: appointments with a deposit and a time', () => {
    setAuth({ id: 'a', name: 'Glow', type: 'salon' })
    render(<Services />)
    expect(screen.getByText('Appointments & services')).toBeTruthy()
    expect(screen.getByText('Stylist')).toBeTruthy()
    expect(screen.getByText('Book for later')).toBeTruthy()
    expect(screen.getByText('Deposit paid (UGX)')).toBeTruthy()
    expect(screen.getByText('Appointment date & time')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Book appointment' })).toBeTruthy()
  })

  it('phone shop: receive a device, track the repair', () => {
    setAuth({ id: 'a', name: 'Techno', type: 'electronics' })
    render(<Services />)
    expect(screen.getByText('Repair jobs')).toBeTruthy()
    expect(screen.getByText('Technician')).toBeTruthy()
    expect(screen.getByText('Device & fault')).toBeTruthy()
    expect(screen.getByText('Promised ready by')).toBeTruthy()
    // "Receive item" is both the mode switch and the submit button
    expect(screen.getAllByRole('button', { name: 'Receive item' })).toHaveLength(2)
  })

  it('a cashier can log work but never sees commission or profit', () => {
    setAuth({ id: 'a', name: 'Glow', type: 'salon' }, cashier)
    render(<Services />)
    expect(screen.queryByText(/commission \(%\)/i)).toBeNull()
    expect(screen.queryByText('Net profit')).toBeNull()
  })

  it('open jobs list shows what is still owed after the deposit', async () => {
    setAuth({ id: 'a', name: 'Techno', type: 'electronics' })
    globalThis.__tables = {
      service_tickets: [{ id: 't1', service_name: 'Screen replacement', customer_name: 'Brian', status: 'ready', amount: 80000, deposit_amount: 30000, commission_pct: 0, item_details: 'Tecno Spark 10', staff_users: { name: 'Ali' } }],
      staff_users: [], customers: [],
    }
    render(<Services />)
    // (the mock returns the same rows for the open-jobs and history queries, so it can appear twice)
    expect((await screen.findAllByText(/Screen replacement — Brian/)).length).toBeGreaterThan(0)
    expect(screen.getByText(/owes UGX 50,000/)).toBeTruthy()
    expect(screen.getByText('Ready for pickup')).toBeTruthy()
  })
})

describe('error boundary', () => {
  it('shows a calm recovery screen instead of a blank page', () => {
    const Bomb = () => { throw new Error('screen exploded') }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Bomb /></ErrorBoundary>)
    expect(screen.getByRole('alert').textContent).toMatch(/Something went wrong/)
    expect(screen.getByRole('alert').textContent).toMatch(/safe/)
    spy.mockRestore()
  })
  it('renders normally when nothing is wrong', () => {
    render(<ErrorBoundary><p>all good</p></ErrorBoundary>)
    expect(screen.getByText('all good')).toBeTruthy()
  })
})
