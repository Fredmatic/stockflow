// Offline sale queue.
//
// Scope is deliberately narrow: only the Sell page's "complete sale" action
// gets queued when offline. Everything else (Products, Customers, Stock In,
// viewing Sales/Dashboard) stays online-only. With 2-3 devices sharing one
// business's stock, letting every page work offline would risk two cashiers
// both thinking the same item is in stock and overselling it without
// realizing — queuing only the sale itself, and warning on sync if stock
// ran out in the meantime, is the safer tradeoff.
//
// Stored in localStorage (not sessionStorage) so a queued sale survives the
// tab being closed or the phone restarting before it gets a chance to sync.

const QUEUE_KEY = 'stocktracer_offline_sale_queue'

export function getQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function setQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // localStorage full or unavailable — nothing more we can do here.
  }
}

// saleData: the full payload completeSale() would otherwise send straight
// to Supabase (business_id, staff_user_id, items, total, etc).
export function enqueueSale(saleData) {
  const queue = getQueue()
  const entry = {
    localId: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
    saleData,
  }
  queue.push(entry)
  setQueue(queue)
  return entry.localId
}

export function removeFromQueue(localId) {
  setQueue(getQueue().filter((e) => e.localId !== localId))
}

export function queueCount() {
  return getQueue().length
}
