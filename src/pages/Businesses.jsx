import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getProfile, servicesEnabled } from '../lib/businessTypes'
import Spinner from '../components/Spinner'
import AddBusinessModal from '../components/AddBusinessModal'

// "My Businesses" — every business this owner runs, side by side, with today's
// takings for each, so the owner can see the whole picture and jump into any one.
export default function Businesses() {
  const { business, businesses, switchBusiness } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const since = start.toISOString()

      const entries = await Promise.all(
        businesses.map(async (b) => {
          const [sales, services, stock, open] = await Promise.all([
            supabase.from('sales').select('total_amount, is_refunded').eq('business_id', b.id).gte('created_at', since),
            supabase.from('service_tickets').select('amount, status').eq('business_id', b.id).gte('created_at', since),
            supabase.from('product_stock').select('status').eq('business_id', b.id).in('status', ['low_stock', 'out_of_stock']),
            supabase.from('service_tickets').select('id', { count: 'exact', head: true }).eq('business_id', b.id).in('status', ['booked', 'in_progress', 'ready']),
          ])
          const salesTotal = (sales.data || []).filter((s) => !s.is_refunded).reduce((n, s) => n + Number(s.total_amount), 0)
          const servicesTotal = (services.data || [])
            .filter((s) => !s.status || s.status === 'completed')
            .reduce((n, s) => n + Number(s.amount), 0)
          return [
            b.id,
            {
              today: salesTotal + servicesTotal,
              needsAttention: (stock.data || []).length,
              openJobs: open.count || 0,
            },
          ]
        })
      )
      if (!cancelled) {
        setStats(Object.fromEntries(entries))
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [businesses])

  const grandTotal = Object.values(stats).reduce((n, s) => n + s.today, 0)

  function open(id) {
    if (id !== business?.id) switchBusiness(id)
    navigate('/dashboard')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold">My businesses</h1>
          <p className="text-muted text-sm">
            All the businesses you run from this one login. Tap one to work in it.
          </p>
        </div>
        <button onClick={() => setAdding(true)} className="btn-primary shrink-0">＋ Add business</button>
      </div>

      {businesses.length > 1 && !loading && (
        <div className="card p-4">
          <div className="text-xs text-muted mb-1">Today across all your businesses</div>
          <div className="font-mono text-2xl font-semibold text-brand-dark">UGX {grandTotal.toLocaleString()}</div>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {businesses.map((b) => {
            const p = getProfile(b)
            const s = stats[b.id] || { today: 0, needsAttention: 0, openJobs: 0 }
            const isActive = b.id === business?.id
            return (
              <button
                key={b.id}
                onClick={() => open(b.id)}
                className={`card p-4 text-left hover:bg-paper transition-colors ${isActive ? 'border-brand' : ''}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{p.icon}</span>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{b.name}</div>
                    <div className="text-xs text-muted">{p.label}{isActive ? ' · you are here' : ''}</div>
                  </div>
                </div>
                <div className="text-xs text-muted">Today</div>
                <div className="font-mono text-lg font-semibold text-brand-dark">UGX {s.today.toLocaleString()}</div>
                <div className="flex gap-3 mt-2 text-xs text-muted flex-wrap">
                  {s.needsAttention > 0 && <span className="text-amber">⚠ {s.needsAttention} low / out of stock</span>}
                  {servicesEnabled(b) && s.openJobs > 0 && <span>🛠 {s.openJobs} open</span>}
                  {s.needsAttention === 0 && s.openJobs === 0 && <span>Nothing needs attention</span>}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {adding && <AddBusinessModal onClose={() => setAdding(false)} />}
    </div>
  )
}
