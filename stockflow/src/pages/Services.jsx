import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import BackdateControl from '../components/BackdateControl'

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
]

const COMMISSION_PRESETS = [0, 10, 20, 30, 40, 50]

function startOfRange(key) {
  const now = new Date()
  if (key === 'today') {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d
  }
  if (key === '7d') {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    return d
  }
  if (key === '30d') {
    const d = new Date(now)
    d.setDate(d.getDate() - 30)
    return d
  }
  return null
}

export default function Services() {
  const { business, activeStaff } = useAuth()
  const isOwner = activeStaff?.role === 'owner'
  // Commission/supply-cost/net-profit are business-sensitive numbers — same
  // rule as Sales/Sell: everyone can log a service and see what the
  // customer paid, but only the owner sees the money breakdown behind it.
  const canSeeProfit = isOwner

  const [range, setRange] = useState('30d')
  const [staffFilter, setStaffFilter] = useState('all')
  const [tickets, setTickets] = useState([])
  const [staffList, setStaffList] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  // Form state
  const [customerId, setCustomerId] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [servedBy, setServedBy] = useState(() => activeStaff?.id || '')
  const [serviceName, setServiceName] = useState('')
  const [amount, setAmount] = useState('')
  const [supplyCost, setSupplyCost] = useState('')
  const [commissionPct, setCommissionPct] = useState('0')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [backdateAt, setBackdateAt] = useState('')
  const [showBackdate, setShowBackdate] = useState(false)

  useEffect(() => {
    if (!business) return
    load()
    loadStaff()
    loadCustomers()
  }, [business, range])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('service_tickets')
      .select('*, staff_users(name)')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })

    const from = startOfRange(range)
    if (from) query = query.gte('created_at', from.toISOString())

    const { data, error } = await query
    if (!error) setTickets(data || [])
    setLoading(false)
  }

  async function loadStaff() {
    const { data } = await supabase
      .from('staff_users')
      .select('id, name, role')
      .eq('business_id', business.id)
      .order('name')
    setStaffList(data || [])
  }

  async function loadCustomers() {
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('name')
    setCustomers(data || [])
  }

  // Past service names typed by this business, most recent first, for quick re-use.
  const knownServices = useMemo(() => {
    const seen = new Set()
    const list = []
    for (const t of tickets) {
      const s = (t.service_name || '').trim()
      if (s && !seen.has(s.toLowerCase())) {
        seen.add(s.toLowerCase())
        list.push(s)
      }
    }
    return list.slice(0, 8)
  }, [tickets])

  const filteredCustomers = useMemo(
    () => customers.filter((c) => c.name.toLowerCase().includes(customerSearch.toLowerCase())),
    [customers, customerSearch]
  )

  const selectedCustomer = customers.find((c) => c.id === customerId) || null

  // Live preview of the money math as the owner/staff types.
  const preview = useMemo(() => {
    const amt = Number(amount) || 0
    const supply = Number(supplyCost) || 0
    const pct = Number(commissionPct) || 0
    const commission = Math.round((amt * pct) / 100)
    const profit = amt - supply - commission
    return { amt, supply, commission, profit }
  }, [amount, supplyCost, commissionPct])

  function resetForm() {
    setCustomerId(null)
    setCustomerSearch('')
    setNewCustomerPhone('')
    setServiceName('')
    setAmount('')
    setSupplyCost('')
    setCommissionPct('0')
    setNote('')
    setBackdateAt('')
    setShowBackdate(false)
  }

  async function createCustomerFromSearch() {
    const name = customerSearch.trim()
    if (!name) return null
    const { data, error } = await supabase
      .from('customers')
      .insert({ business_id: business.id, name, phone: newCustomerPhone.trim() || null })
      .select()
      .single()
    if (error) {
      setMessage(`Error: ${error.message}`)
      return null
    }
    setCustomers((c) => [...c, data])
    setCustomerId(data.id)
    return data
  }

  async function handleAdd(e) {
    e.preventDefault()
    const name = selectedCustomer?.name || customerSearch.trim()
    if (!name) {
      setMessage('Error: enter the customer’s name.')
      return
    }
    if (!serviceName.trim()) {
      setMessage('Error: enter what service was done.')
      return
    }
    if (!amount || Number(amount) <= 0) {
      setMessage('Error: enter an amount greater than 0.')
      return
    }
    setSaving(true)

    // If they typed a brand-new name that isn't a saved customer yet, and
    // haven't explicitly opted out via "walk-in" (no phone entry shown),
    // save it as a customer so future visits can be looked up.
    let finalCustomerId = customerId
    let finalPhone = selectedCustomer?.phone || null
    if (!finalCustomerId && name) {
      const created = await createCustomerFromSearch()
      if (created) {
        finalCustomerId = created.id
        finalPhone = created.phone
      }
    }

    const pct = Number(commissionPct) || 0
    const amt = Number(amount)
    const commissionAmount = Math.round((amt * pct) / 100)
    const backdateISO = isOwner && backdateAt ? new Date(backdateAt).toISOString() : null

    const { error } = await supabase.from('service_tickets').insert({
      business_id: business.id,
      staff_user_id: servedBy || null,
      customer_id: finalCustomerId,
      customer_name: name,
      customer_phone: finalPhone,
      service_name: serviceName.trim(),
      amount: amt,
      supply_cost: Number(supplyCost) || 0,
      commission_pct: pct,
      commission_amount: commissionAmount,
      note: note.trim() || null,
      ...(backdateISO ? { created_at: backdateISO } : {}),
    })

    setSaving(false)
    if (error) {
      setMessage(`Error: ${error.message}`)
      return
    }
    resetForm()
    setMessage('Service logged.')
    setTimeout(() => setMessage(''), 3000)
    load()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('service_tickets').delete().eq('id', id)
    if (!error) setTickets((list) => list.filter((t) => t.id !== id))
  }

  // Totals for the selected range, optionally filtered to one staff member.
  const scoped = useMemo(
    () => (staffFilter === 'all' ? tickets : tickets.filter((t) => t.staff_user_id === staffFilter)),
    [tickets, staffFilter]
  )

  const totals = useMemo(() => {
    return scoped.reduce(
      (acc, t) => {
        acc.revenue += Number(t.amount)
        acc.commission += Number(t.commission_amount)
        acc.supply += Number(t.supply_cost)
        acc.count += 1
        return acc
      },
      { revenue: 0, commission: 0, supply: 0, count: 0 }
    )
  }, [scoped])
  const totalProfit = totals.revenue - totals.commission - totals.supply

  // Per-staff breakdown so the owner can see who's bringing in what.
  const byStaff = useMemo(() => {
    const map = new Map()
    for (const t of tickets) {
      const key = t.staff_user_id || 'unassigned'
      const label = t.staff_users?.name || 'Unassigned'
      if (!map.has(key)) map.set(key, { id: key, name: label, revenue: 0, commission: 0, supply: 0, count: 0 })
      const row = map.get(key)
      row.revenue += Number(t.amount)
      row.commission += Number(t.commission_amount)
      row.supply += Number(t.supply_cost)
      row.count += 1
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
  }, [tickets])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-xl font-semibold">Customer Service</h1>
        <p className="text-muted text-sm">Log each haircut, shave, or treatment — with commission and profit worked out for you.</p>
      </div>

      <form onSubmit={handleAdd} className="card p-4 space-y-3">
        {message && (
          <p className={`text-sm rounded-md px-3 py-2 ${message.startsWith('Error') ? 'text-brick bg-brick-light' : 'text-brand-dark bg-brand-light'}`}>
            {message}
          </p>
        )}

        {/* Customer */}
        <label className="block">
          <span className="text-xs font-medium text-muted mb-1 block">Customer</span>
          {selectedCustomer ? (
            <div className="flex items-center justify-between rounded-md border border-line px-3 py-2">
              <div>
                <div className="text-sm font-medium">{selectedCustomer.name}</div>
                {selectedCustomer.phone && <div className="text-xs text-muted">{selectedCustomer.phone}</div>}
              </div>
              <button
                type="button"
                onClick={() => { setCustomerId(null); setCustomerSearch('') }}
                className="text-xs text-muted hover:text-brick"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                className="input"
                placeholder="Type customer name…"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
              {customerSearch.trim() && (
                <div className="mt-1 rounded-md border border-line divide-y divide-line max-h-40 overflow-y-auto">
                  {filteredCustomers.slice(0, 5).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setCustomerId(c.id); setCustomerSearch('') }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-paper"
                    >
                      {c.name}
                      {c.phone && <span className="text-muted"> · {c.phone}</span>}
                    </button>
                  ))}
                  {!filteredCustomers.some((c) => c.name.toLowerCase() === customerSearch.trim().toLowerCase()) && (
                    <div className="px-3 py-2">
                      <p className="text-xs text-muted mb-1">New customer — will be saved as "{customerSearch.trim()}"</p>
                      <input
                        className="input text-sm"
                        placeholder="Phone (optional)"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </label>

        {/* Staff who did the work */}
        <label className="block">
          <span className="text-xs font-medium text-muted mb-1 block">Served by</span>
          <select className="input" value={servedBy} onChange={(e) => setServedBy(e.target.value)}>
            <option value="">— Select staff —</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        {/* Service */}
        <label className="block">
          <span className="text-xs font-medium text-muted mb-1 block">Service</span>
          <input
            className="input"
            placeholder="e.g. Haircut, Shave, Braids"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            list="service-names"
          />
          <datalist id="service-names">
            {knownServices.map((s) => <option key={s} value={s} />)}
          </datalist>
        </label>
        {knownServices.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {knownServices.slice(0, 5).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setServiceName(s)}
                className="px-2.5 py-1 rounded-md text-xs border border-line text-muted hover:bg-paper"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Money */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-muted mb-1 block">Amount charged (UGX)</span>
            <input
              type="number" min="0" inputMode="numeric"
              className="input font-mono"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted mb-1 block">Supplies used (UGX)</span>
            <input
              type="number" min="0" inputMode="numeric"
              className="input font-mono"
              placeholder="0"
              value={supplyCost}
              onChange={(e) => setSupplyCost(e.target.value)}
            />
          </label>
        </div>

        {canSeeProfit && (
          <div>
            <span className="text-xs font-medium text-muted mb-1 block">Staff commission (%)</span>
            <div className="flex gap-2 flex-wrap mb-2">
              {COMMISSION_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCommissionPct(String(p))}
                  className={`px-2.5 py-1 rounded-md text-xs border ${Number(commissionPct) === p ? 'bg-brand-light text-brand-dark border-brand-light' : 'border-line text-muted hover:bg-paper'}`}
                >
                  {p}%
                </button>
              ))}
            </div>
            <input
              type="number" min="0" max="100" step="0.5" inputMode="decimal"
              className="input font-mono w-28"
              value={commissionPct}
              onChange={(e) => setCommissionPct(e.target.value)}
            />
          </div>
        )}

        {/* Live profit preview — owner only */}
        {canSeeProfit && (amount || supplyCost) && (
          <div className="rounded-md bg-paper px-3 py-2 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-muted">Revenue</span><span className="font-mono">UGX {preview.amt.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted">− Commission ({commissionPct || 0}%)</span><span className="font-mono">UGX {preview.commission.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted">− Supplies used</span><span className="font-mono">UGX {preview.supply.toLocaleString()}</span></div>
            <div className="flex justify-between font-semibold pt-1 border-t border-line">
              <span>Net profit</span>
              <span className={`font-mono ${preview.profit >= 0 ? 'text-brand-dark' : 'text-brick'}`}>UGX {preview.profit.toLocaleString()}</span>
            </div>
          </div>
        )}

        <label className="block">
          <span className="text-xs font-medium text-muted mb-1 block">Note (optional)</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {isOwner && (
          <BackdateControl
            show={showBackdate} onToggle={() => setShowBackdate((v) => !v)} value={backdateAt} onChange={setBackdateAt}
            linkLabel="Forgot to log this earlier? Backdate this service"
            prompt="When did this service actually happen?"
            hint="This service will be recorded with that date/time instead of now."
          />
        )}

        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? 'Saving…' : 'Log service'}
        </button>
      </form>

      <div className="flex gap-2 flex-wrap">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border ${range === r.key ? 'bg-brand-light text-brand-dark border-brand-light' : 'border-line text-muted hover:bg-paper'}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <div className="text-xs text-muted mb-1">Revenue</div>
              <div className="font-mono text-xl font-semibold">UGX {totals.revenue.toLocaleString()}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-muted mb-1">Services logged</div>
              <div className="font-mono text-xl font-semibold">{totals.count}</div>
            </div>
            {canSeeProfit && (
              <>
                <div className="card p-4">
                  <div className="text-xs text-muted mb-1">Net profit</div>
                  <div className={`font-mono text-xl font-semibold ${totalProfit >= 0 ? 'text-brand-dark' : 'text-brick'}`}>UGX {totalProfit.toLocaleString()}</div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-muted mb-1">Commission paid</div>
                  <div className="font-mono text-xl font-semibold">UGX {totals.commission.toLocaleString()}</div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-muted mb-1">Supplies used</div>
                  <div className="font-mono text-xl font-semibold">UGX {totals.supply.toLocaleString()}</div>
                </div>
              </>
            )}
          </div>

          {isOwner && byStaff.length > 0 && (
            <div>
              <div className="mb-3 pb-2 ledger-rule">
                <h2 className="font-display text-sm font-semibold">By staff</h2>
                <p className="text-xs text-muted">All time — who's bringing in what</p>
              </div>
              <div className="card divide-y divide-line">
                {byStaff.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStaffFilter(staffFilter === s.id ? 'all' : s.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left ${staffFilter === s.id ? 'bg-brand-light' : ''}`}
                  >
                    <div>
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-xs text-muted">{s.count} service{s.count === 1 ? '' : 's'} · commission UGX {s.commission.toLocaleString()}</div>
                    </div>
                    <div className="font-mono text-sm font-semibold">UGX {s.revenue.toLocaleString()}</div>
                  </button>
                ))}
              </div>
              {staffFilter !== 'all' && (
                <button onClick={() => setStaffFilter('all')} className="text-xs text-muted underline decoration-dotted mt-2">
                  Clear staff filter
                </button>
              )}
            </div>
          )}

          <div>
            <div className="mb-3 pb-2 ledger-rule">
              <h2 className="font-display text-sm font-semibold">History</h2>
              <p className="text-xs text-muted">{scoped.length} service{scoped.length === 1 ? '' : 's'} in this range</p>
            </div>
            {scoped.length === 0 ? (
              <p className="text-sm text-muted card px-4 py-6 text-center">No services logged in this range.</p>
            ) : (
              <div className="card divide-y divide-line">
                {scoped.map((t) => {
                  const profit = Number(t.amount) - Number(t.commission_amount) - Number(t.supply_cost)
                  return (
                    <div key={t.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className="text-sm font-medium">{t.service_name} — {t.customer_name}</div>
                        <div className="text-xs text-muted">
                          {new Date(t.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                          {t.staff_users?.name ? ` · ${t.staff_users.name}` : ''}
                          {t.customer_phone ? ` · ${t.customer_phone}` : ''}
                          {t.note ? ` · ${t.note}` : ''}
                        </div>
                        {canSeeProfit && (
                          <div className="text-xs text-muted">
                            Profit: <span className={profit >= 0 ? 'text-brand-dark' : 'text-brick'}>UGX {profit.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-semibold">UGX {Number(t.amount).toLocaleString()}</span>
                        <button onClick={() => handleDelete(t.id)} className="text-xs text-muted hover:text-brick">Remove</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
