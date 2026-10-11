import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getServicesProfile } from '../lib/businessTypes'
import Spinner from '../components/Spinner'
import BackdateControl from '../components/BackdateControl'
import { calcCommission, calcServiceProfit, calcBalanceDue, summarizeServiceTickets } from '../lib/money'

// One page, three ways of working — chosen by the business type:
//   walkin  (barbershop)  – log a cut as it happens; commission + tip per barber
//   booking (salon)       – book an appointment (with deposit), then complete it
//   job     (phone repair, tailoring) – receive an item, track it, collect on pickup
// Only COMPLETED work counts as revenue; open work shows what is still to collect.

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
]

const PAYMENT_METHODS = [
  { key: 'cash', label: 'Cash' },
  { key: 'mobile_money', label: 'Mobile money' },
  { key: 'card', label: 'Card' },
  { key: 'bank', label: 'Bank' },
]
const paymentLabel = (k) => PAYMENT_METHODS.find((m) => m.key === k)?.label || null

const STATUS_LABEL = {
  booked: 'Booked',
  in_progress: 'In progress',
  ready: 'Ready for pickup',
  completed: 'Completed',
  cancelled: 'Cancelled',
}
const OPEN_STATUSES = ['booked', 'in_progress', 'ready']

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

const money = (n) => `UGX ${Number(n || 0).toLocaleString()}`
const fmtDateTime = (d) => new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export default function Services() {
  const { business, activeStaff } = useAuth()
  const cfg = getServicesProfile(business)
  const isOwner = activeStaff?.role === 'owner'
  // Commission/supply-cost/net-profit are business-sensitive numbers — same
  // rule as Sales/Sell: everyone can log a service and see what the
  // customer paid, but only the owner sees the money breakdown behind it.
  const canSeeProfit = isOwner

  const initialStatus = cfg.workflow === 'booking' ? 'booked' : cfg.workflow === 'job' ? 'in_progress' : 'completed'
  const statusChoices =
    cfg.workflow === 'booking'
      ? [{ key: 'booked', label: 'Book for later' }, { key: 'completed', label: 'Done now' }]
      : cfg.workflow === 'job'
        ? [{ key: 'in_progress', label: 'Receive item' }, { key: 'completed', label: 'Done & paid now' }]
        : null

  const [range, setRange] = useState('30d')
  const [staffFilter, setStaffFilter] = useState('all')
  const [tickets, setTickets] = useState([]) // completed, in range
  const [openJobs, setOpenJobs] = useState([]) // booked / in progress / ready, any date
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
  const [itemDetails, setItemDetails] = useState('')
  const [amount, setAmount] = useState('')
  const [supplyCost, setSupplyCost] = useState('')
  const [commissionPct, setCommissionPct] = useState('0')
  const [status, setStatus] = useState(initialStatus)
  const [deposit, setDeposit] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [tip, setTip] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [backdateAt, setBackdateAt] = useState('')
  const [showBackdate, setShowBackdate] = useState(false)

  // "Complete & collect" panel for an open job
  const [completingId, setCompletingId] = useState(null)
  const [finalAmount, setFinalAmount] = useState('')
  const [finalMethod, setFinalMethod] = useState('cash')
  const [finalTip, setFinalTip] = useState('')

  const finishingNow = status === 'completed'

  useEffect(() => {
    if (!business) return
    load()
    loadStaff()
    loadCustomers()
  }, [business, range]) // eslint-disable-line react-hooks/exhaustive-deps

  // Remember each person's usual commission % so it doesn't need retyping.
  useEffect(() => {
    if (!business || !servedBy || !canSeeProfit) return
    const saved = localStorage.getItem(`commission_pct_${business.id}_${servedBy}`)
    if (saved !== null) setCommissionPct(saved)
  }, [business, servedBy, canSeeProfit])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('service_tickets')
      .select('*, staff_users(name)')
      .eq('business_id', business.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })

    const from = startOfRange(range)
    if (from) query = query.gte('created_at', from.toISOString())

    const [{ data, error }, { data: open }] = await Promise.all([
      query,
      supabase
        .from('service_tickets')
        .select('*, staff_users(name)')
        .eq('business_id', business.id)
        .in('status', OPEN_STATUSES)
        .order('scheduled_at', { ascending: true, nullsFirst: false }),
    ])
    if (!error) setTickets(data || [])
    setOpenJobs(open || [])
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

  // Quick-pick chips: this business's usual services first, then past ones typed here.
  const quickServices = useMemo(() => {
    const seen = new Set()
    const list = []
    const push = (s) => {
      const k = s.trim().toLowerCase()
      if (k && !seen.has(k)) {
        seen.add(k)
        list.push(s.trim())
      }
    }
    for (const t of tickets) push(t.service_name || '')
    cfg.presets.forEach(push)
    return list
  }, [tickets, cfg.presets])

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
    const commission = calcCommission(amt, pct)
    const profit = calcServiceProfit({ amount: amt, commissionAmount: commission, supplyCost: supply })
    return { amt, supply, commission, profit }
  }, [amount, supplyCost, commissionPct])

  function resetForm() {
    setCustomerId(null)
    setCustomerSearch('')
    setNewCustomerPhone('')
    setServiceName('')
    setItemDetails('')
    setAmount('')
    setSupplyCost('')
    setStatus(initialStatus)
    setDeposit('')
    setScheduledAt('')
    setTip('')
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
      setMessage(`Error: enter what ${cfg.singular} this is.`)
      return
    }
    if (!amount || Number(amount) <= 0) {
      setMessage('Error: enter an amount greater than 0.')
      return
    }
    if (cfg.itemDetails && status !== 'completed' && !itemDetails.trim()) {
      setMessage(`Error: note down the ${cfg.itemDetails.label.toLowerCase()}.`)
      return
    }
    if (Number(deposit) > Number(amount)) {
      setMessage('Error: the deposit can’t be more than the price.')
      return
    }
    setSaving(true)

    // A brand-new name that isn't a saved customer yet gets saved so future visits can be looked up.
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
    const commissionAmount = calcCommission(amt, pct)
    const backdateISO = isOwner && backdateAt && finishingNow ? new Date(backdateAt).toISOString() : null

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
      status,
      item_details: itemDetails.trim() || null,
      deposit_amount: finishingNow ? 0 : Number(deposit) || 0,
      scheduled_at: !finishingNow && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      payment_method: finishingNow ? paymentMethod : null,
      tip_amount: finishingNow && cfg.tip ? Number(tip) || 0 : 0,
      received_at: backdateISO || new Date().toISOString(),
      ...(backdateISO ? { created_at: backdateISO } : {}),
    })

    setSaving(false)
    if (error) {
      setMessage(`Error: ${error.message}`)
      return
    }
    if (canSeeProfit && servedBy) localStorage.setItem(`commission_pct_${business.id}_${servedBy}`, String(pct))
    const wasOpen = !finishingNow
    resetForm()
    setMessage(wasOpen ? (cfg.workflow === 'booking' ? 'Appointment booked.' : 'Item received — tracked below.') : `${cap(cfg.singular)} logged.`)
    setTimeout(() => setMessage(''), 3000)
    load()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('service_tickets').delete().eq('id', id)
    if (!error) {
      setTickets((list) => list.filter((t) => t.id !== id))
      setOpenJobs((list) => list.filter((t) => t.id !== id))
    }
  }

  async function setJobStatus(id, next) {
    const { error } = await supabase.from('service_tickets').update({ status: next }).eq('id', id)
    if (error) return setMessage(`Error: ${error.message}`)
    load()
  }

  function startCompleting(t) {
    setCompletingId(t.id)
    setFinalAmount(String(t.amount))
    setFinalMethod('cash')
    setFinalTip('')
  }

  async function finishJob(t) {
    const amt = Number(finalAmount)
    if (!amt || amt <= 0) return setMessage('Error: enter the final amount.')
    const { error } = await supabase
      .from('service_tickets')
      .update({
        status: 'completed',
        amount: amt,
        commission_amount: calcCommission(amt, t.commission_pct),
        payment_method: finalMethod,
        tip_amount: cfg.tip ? Number(finalTip) || 0 : 0,
        // Revenue is counted on the day the work is finished and paid for.
        created_at: new Date().toISOString(),
      })
      .eq('id', t.id)
    if (error) return setMessage(`Error: ${error.message}`)
    setCompletingId(null)
    setMessage(`${cap(cfg.singular)} completed — collected ${money(calcBalanceDue({ amount: amt, depositAmount: t.deposit_amount }))}.`)
    setTimeout(() => setMessage(''), 4000)
    load()
  }

  // Totals for the selected range, optionally filtered to one staff member.
  const scoped = useMemo(
    () => (staffFilter === 'all' ? tickets : tickets.filter((t) => t.staff_user_id === staffFilter)),
    [tickets, staffFilter]
  )
  const totals = useMemo(() => summarizeServiceTickets(scoped), [scoped])
  const totalTips = useMemo(() => scoped.reduce((n, t) => n + (Number(t.tip_amount) || 0), 0), [scoped])
  const depositsHeld = useMemo(() => openJobs.reduce((n, t) => n + (Number(t.deposit_amount) || 0), 0), [openJobs])
  const toCollect = useMemo(
    () => openJobs.reduce((n, t) => n + calcBalanceDue({ amount: t.amount, depositAmount: t.deposit_amount }), 0),
    [openJobs]
  )

  // Per-staff breakdown so the owner can see who's bringing in what.
  const byStaff = useMemo(() => {
    const map = new Map()
    for (const t of tickets) {
      const key = t.staff_user_id || 'unassigned'
      const label = t.staff_users?.name || 'Unassigned'
      if (!map.has(key)) map.set(key, { id: key, name: label, revenue: 0, commission: 0, tips: 0, count: 0 })
      const row = map.get(key)
      row.revenue += Number(t.amount)
      row.commission += Number(t.commission_amount)
      row.tips += Number(t.tip_amount) || 0
      row.count += 1
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
  }, [tickets])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-xl font-semibold">{cfg.title}</h1>
        <p className="text-muted text-sm">{cfg.subtitle}</p>
      </div>

      <form onSubmit={handleAdd} className="card p-4 space-y-3">
        {message && (
          <p className={`text-sm rounded-md px-3 py-2 ${message.startsWith('Error') ? 'text-brick bg-brick-light' : 'text-brand-dark bg-brand-light'}`}>
            {message}
          </p>
        )}

        {statusChoices && (
          <div className="flex gap-2">
            {statusChoices.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setStatus(c.key)}
                className={`flex-1 ${status === c.key ? 'btn-primary' : 'btn-secondary'}`}
              >
                {c.label}
              </button>
            ))}
          </div>
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
              <button type="button" onClick={() => { setCustomerId(null); setCustomerSearch('') }} className="text-xs text-muted hover:text-brick">
                Change
              </button>
            </div>
          ) : (
            <>
              <input className="input" placeholder="Type customer name…" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
              {customerSearch.trim() && (
                <div className="mt-1 rounded-md border border-line divide-y divide-line max-h-40 overflow-y-auto">
                  {filteredCustomers.slice(0, 5).map((c) => (
                    <button key={c.id} type="button" onClick={() => { setCustomerId(c.id); setCustomerSearch('') }} className="w-full text-left px-3 py-2 text-sm hover:bg-paper">
                      {c.name}
                      {c.phone && <span className="text-muted"> · {c.phone}</span>}
                    </button>
                  ))}
                  {!filteredCustomers.some((c) => c.name.toLowerCase() === customerSearch.trim().toLowerCase()) && (
                    <div className="px-3 py-2">
                      <p className="text-xs text-muted mb-1">New customer — will be saved as "{customerSearch.trim()}"</p>
                      <input className="input text-sm" placeholder="Phone (optional)" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </label>

        {/* Staff who did the work */}
        <label className="block">
          <span className="text-xs font-medium text-muted mb-1 block">{cfg.staffLabel}</span>
          <select className="input" value={servedBy} onChange={(e) => setServedBy(e.target.value)}>
            <option value="">— Select staff —</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        {/* Service */}
        <label className="block">
          <span className="text-xs font-medium text-muted mb-1 block">What was done</span>
          <input className="input" placeholder={cfg.servicePlaceholder} value={serviceName} onChange={(e) => setServiceName(e.target.value)} list="service-names" />
          <datalist id="service-names">
            {quickServices.map((s) => <option key={s} value={s} />)}
          </datalist>
        </label>
        {quickServices.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {quickServices.slice(0, 8).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setServiceName(s)}
                className={`px-2.5 py-1 rounded-md text-xs border ${serviceName === s ? 'bg-brand-light text-brand-dark border-brand' : 'border-line text-muted hover:bg-paper'}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {cfg.itemDetails && (
          <label className="block">
            <span className="text-xs font-medium text-muted mb-1 block">{cfg.itemDetails.label}</span>
            <input className="input" placeholder={cfg.itemDetails.placeholder} value={itemDetails} onChange={(e) => setItemDetails(e.target.value)} />
          </label>
        )}

        {/* Money */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-muted mb-1 block">{finishingNow ? 'Amount charged (UGX)' : 'Price quoted (UGX)'}</span>
            <input type="number" min="0" inputMode="numeric" className="input font-mono" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted mb-1 block">{cfg.supplyLabel}</span>
            <input type="number" min="0" inputMode="numeric" className="input font-mono" placeholder="0" value={supplyCost} onChange={(e) => setSupplyCost(e.target.value)} />
          </label>
        </div>

        {!finishingNow && (
          <div className="grid grid-cols-2 gap-3">
            {cfg.deposit && (
              <label className="block">
                <span className="text-xs font-medium text-muted mb-1 block">Deposit paid (UGX)</span>
                <input type="number" min="0" inputMode="numeric" className="input font-mono" placeholder="0" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
              </label>
            )}
            {cfg.scheduledLabel && (
              <label className="block">
                <span className="text-xs font-medium text-muted mb-1 block">{cfg.scheduledLabel}</span>
                <input type="datetime-local" className="input" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </label>
            )}
          </div>
        )}

        {finishingNow && (
          <div>
            <span className="text-xs font-medium text-muted mb-1 block">Paid by</span>
            <div className="flex gap-2 flex-wrap">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setPaymentMethod(m.key)}
                  className={`px-2.5 py-1 rounded-md text-xs border ${paymentMethod === m.key ? 'bg-brand-light text-brand-dark border-brand' : 'border-line text-muted hover:bg-paper'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {finishingNow && cfg.tip && (
          <label className="block">
            <span className="text-xs font-medium text-muted mb-1 block">Tip (UGX, optional — goes to {cfg.staffLabel.toLowerCase()}, not counted as sales)</span>
            <input type="number" min="0" inputMode="numeric" className="input font-mono w-40" placeholder="0" value={tip} onChange={(e) => setTip(e.target.value)} />
          </label>
        )}

        {canSeeProfit && (
          <div>
            <span className="text-xs font-medium text-muted mb-1 block">{cfg.staffLabel} commission (%)</span>
            <div className="flex gap-2 flex-wrap mb-2">
              {cfg.commissionPresets.map((p) => (
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
            <input type="number" min="0" max="100" step="0.5" inputMode="decimal" className="input font-mono w-28" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} />
          </div>
        )}

        {/* Live profit preview — owner only */}
        {canSeeProfit && (amount || supplyCost) && (
          <div className="rounded-md bg-paper px-3 py-2 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-muted">Revenue</span><span className="font-mono">{money(preview.amt)}</span></div>
            <div className="flex justify-between"><span className="text-muted">− Commission ({commissionPct || 0}%)</span><span className="font-mono">{money(preview.commission)}</span></div>
            <div className="flex justify-between"><span className="text-muted">− {cfg.supplyLabel.replace(' (UGX)', '')}</span><span className="font-mono">{money(preview.supply)}</span></div>
            <div className="flex justify-between font-semibold pt-1 border-t border-line">
              <span>Net profit</span>
              <span className={`font-mono ${preview.profit >= 0 ? 'text-brand-dark' : 'text-brick'}`}>{money(preview.profit)}</span>
            </div>
          </div>
        )}

        <label className="block">
          <span className="text-xs font-medium text-muted mb-1 block">Note (optional)</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {isOwner && finishingNow && (
          <BackdateControl
            show={showBackdate} onToggle={() => setShowBackdate((v) => !v)} value={backdateAt} onChange={setBackdateAt}
            linkLabel={`Forgot to log this earlier? Backdate this ${cfg.singular}`}
            prompt={`When did this ${cfg.singular} actually happen?`}
            hint={`This ${cfg.singular} will be recorded with that date/time instead of now.`}
          />
        )}

        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? 'Saving…' : finishingNow ? `Log ${cfg.singular}` : cfg.workflow === 'booking' ? 'Book appointment' : 'Receive item'}
        </button>
      </form>

      {/* Open work: bookings / jobs still to finish and collect */}
      {!loading && cfg.workflow !== 'walkin' && openJobs.length > 0 && (
        <div>
          <div className="mb-3 pb-2 ledger-rule">
            <h2 className="font-display text-sm font-semibold">
              {cfg.workflow === 'booking' ? 'Upcoming appointments' : 'Open jobs'} ({openJobs.length})
            </h2>
            <p className="text-xs text-muted">
              {money(toCollect)} still to collect{depositsHeld > 0 ? ` · ${money(depositsHeld)} in deposits already paid` : ''}
            </p>
          </div>
          <div className="card divide-y divide-line">
            {openJobs.map((t) => {
              const due = calcBalanceDue({ amount: t.amount, depositAmount: t.deposit_amount })
              const overdue = t.scheduled_at && new Date(t.scheduled_at) < new Date()
              return (
                <div key={t.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{t.service_name} — {t.customer_name}</div>
                      {t.item_details && <div className="text-xs text-muted">{t.item_details}</div>}
                      <div className="text-xs text-muted">
                        <span className="inline-block rounded-full px-2 py-0.5 bg-paper border border-line mr-1">{STATUS_LABEL[t.status]}</span>
                        {t.scheduled_at && <span className={overdue ? 'text-brick' : ''}>{fmtDateTime(t.scheduled_at)}</span>}
                        {t.staff_users?.name ? ` · ${t.staff_users.name}` : ''}
                        {t.customer_phone ? ` · ${t.customer_phone}` : ''}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm font-semibold">{money(t.amount)}</div>
                      {Number(t.deposit_amount) > 0 && <div className="text-xs text-muted">paid {money(t.deposit_amount)} · owes {money(due)}</div>}
                    </div>
                  </div>

                  {completingId === t.id ? (
                    <div className="rounded-md bg-paper p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className="text-xs text-muted block mb-1">Final price (UGX)</span>
                          <input type="number" min="0" className="input font-mono" value={finalAmount} onChange={(e) => setFinalAmount(e.target.value)} />
                        </label>
                        {cfg.tip && (
                          <label className="block">
                            <span className="text-xs text-muted block mb-1">Tip (UGX)</span>
                            <input type="number" min="0" className="input font-mono" value={finalTip} onChange={(e) => setFinalTip(e.target.value)} />
                          </label>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {PAYMENT_METHODS.map((m) => (
                          <button key={m.key} type="button" onClick={() => setFinalMethod(m.key)}
                            className={`px-2.5 py-1 rounded-md text-xs border ${finalMethod === m.key ? 'bg-brand-light text-brand-dark border-brand' : 'border-line text-muted hover:bg-paper'}`}>
                            {m.label}
                          </button>
                        ))}
                      </div>
                      <div className="text-xs text-muted">
                        Collect now: <span className="font-mono font-semibold text-ink">{money(calcBalanceDue({ amount: finalAmount, depositAmount: t.deposit_amount }))}</span>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setCompletingId(null)} className="btn-secondary flex-1">Back</button>
                        <button type="button" onClick={() => finishJob(t)} className="btn-primary flex-1">Complete & collect</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {cfg.workflow === 'job' && t.status === 'in_progress' && (
                        <button type="button" onClick={() => setJobStatus(t.id, 'ready')} className="btn-secondary text-xs px-3 py-1.5">Mark ready</button>
                      )}
                      <button type="button" onClick={() => startCompleting(t)} className="btn-primary text-xs px-3 py-1.5">Complete & collect</button>
                      <button type="button" onClick={() => setJobStatus(t.id, 'cancelled')} className="text-xs text-muted hover:text-brick px-2">
                        {cfg.workflow === 'booking' ? 'Cancel booking' : 'Cancel job'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

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
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <div className="text-xs text-muted mb-1">Revenue</div>
              <div className="font-mono text-xl font-semibold">{money(totals.revenue)}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-muted mb-1">{cap(cfg.plural)} done</div>
              <div className="font-mono text-xl font-semibold">{totals.count}</div>
            </div>
            {canSeeProfit && (
              <>
                <div className="card p-4">
                  <div className="text-xs text-muted mb-1">Net profit</div>
                  <div className={`font-mono text-xl font-semibold ${totals.profit >= 0 ? 'text-brand-dark' : 'text-brick'}`}>{money(totals.profit)}</div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-muted mb-1">Commission paid</div>
                  <div className="font-mono text-xl font-semibold">{money(totals.commission)}</div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-muted mb-1">{cfg.supplyLabel.replace(' (UGX)', '')}</div>
                  <div className="font-mono text-xl font-semibold">{money(totals.supply)}</div>
                </div>
              </>
            )}
            {cfg.tip && (
              <div className="card p-4">
                <div className="text-xs text-muted mb-1">Tips received</div>
                <div className="font-mono text-xl font-semibold">{money(totalTips)}</div>
              </div>
            )}
          </div>

          {isOwner && byStaff.length > 0 && (
            <div>
              <div className="mb-3 pb-2 ledger-rule">
                <h2 className="font-display text-sm font-semibold">By {cfg.staffLabel.toLowerCase()}</h2>
                <p className="text-xs text-muted">Who's bringing in what in this range{cfg.tip ? ' — commission and tips owed' : ''}</p>
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
                      <div className="text-xs text-muted">
                        {s.count} {s.count === 1 ? cfg.singular : cfg.plural} · commission {money(s.commission)}
                        {cfg.tip && s.tips > 0 ? ` · tips ${money(s.tips)}` : ''}
                      </div>
                    </div>
                    <div className="font-mono text-sm font-semibold">{money(s.revenue)}</div>
                  </button>
                ))}
              </div>
              {staffFilter !== 'all' && (
                <button onClick={() => setStaffFilter('all')} className="text-xs text-muted underline decoration-dotted mt-2">
                  Clear filter
                </button>
              )}
            </div>
          )}

          <div>
            <div className="mb-3 pb-2 ledger-rule">
              <h2 className="font-display text-sm font-semibold">History</h2>
              <p className="text-xs text-muted">{scoped.length} {scoped.length === 1 ? cfg.singular : cfg.plural} in this range</p>
            </div>
            {scoped.length === 0 ? (
              <p className="text-sm text-muted card px-4 py-6 text-center">Nothing logged in this range.</p>
            ) : (
              <div className="card divide-y divide-line">
                {scoped.map((t) => {
                  const profit = calcServiceProfit({ amount: t.amount, commissionAmount: t.commission_amount, supplyCost: t.supply_cost })
                  return (
                    <div key={t.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className="text-sm font-medium">{t.service_name} — {t.customer_name}</div>
                        {t.item_details && <div className="text-xs text-muted">{t.item_details}</div>}
                        <div className="text-xs text-muted">
                          {fmtDateTime(t.created_at)}
                          {t.staff_users?.name ? ` · ${t.staff_users.name}` : ''}
                          {t.customer_phone ? ` · ${t.customer_phone}` : ''}
                          {paymentLabel(t.payment_method) ? ` · ${paymentLabel(t.payment_method)}` : ''}
                          {Number(t.tip_amount) > 0 ? ` · tip ${money(t.tip_amount)}` : ''}
                          {t.note ? ` · ${t.note}` : ''}
                        </div>
                        {canSeeProfit && (
                          <div className="text-xs text-muted">
                            Profit: <span className={profit >= 0 ? 'text-brand-dark' : 'text-brick'}>{money(profit)}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-semibold">{money(t.amount)}</span>
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

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}
