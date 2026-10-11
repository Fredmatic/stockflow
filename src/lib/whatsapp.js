// WhatsApp helpers — no API, no approval needed.
// We use WhatsApp's "click to chat" links (wa.me): the app prepares the message,
// the owner's own WhatsApp opens with it ready, and the owner taps Send. It works
// in every country, on every phone, and costs nothing.

export const DEFAULT_COUNTRY_CODE = '256' // Uganda. Per business: business.settings.country_code

/** Turn a locally-written number into WhatsApp's international digits ("0740193837" → "256740193837"). */
export function normalizePhone(phone, countryCode = DEFAULT_COUNTRY_CODE) {
  if (!phone) return null
  let digits = String(phone).replace(/[^\d+]/g, '')
  if (!digits) return null
  if (digits.startsWith('+')) return digits.slice(1) || null
  if (digits.startsWith('00')) return digits.slice(2) || null
  if (digits.startsWith('0')) return countryCode + digits.slice(1)
  return digits
}

/** A wa.me link with the message pre-filled. No phone = the owner chooses who to send it to. */
export function whatsappLink(phone, text, countryCode) {
  const to = normalizePhone(phone, countryCode)
  return `https://wa.me/${to || ''}?text=${encodeURIComponent(text)}`
}

const money = (currency, n) => `${currency} ${Math.round(Number(n) || 0).toLocaleString('en-US')}`

/**
 * The owner's end-of-day report as a WhatsApp message.
 * Pure function: give it numbers, get text. (Fetching lives in dailyReport.js.)
 * Lines that don't apply to the business (no services, nothing expiring…) are left out,
 * and profit is only included when the sender is allowed to see it.
 */
export function buildDailyReport(d) {
  const cur = d.currency || 'UGX'
  const L = []
  L.push(`📊 *${d.businessName}* — ${d.dateLabel}`)
  if (d.typeLabel) L.push(`_${d.typeLabel}_`)
  L.push('')

  const earned = (d.salesTotal || 0) + (d.serviceTotal || 0)
  L.push(`💰 *Total today: ${money(cur, earned)}*`)
  if (d.salesCount > 0 || !d.servicesOn) L.push(`   🛒 Sales: ${money(cur, d.salesTotal)} (${d.salesCount})`)
  if (d.servicesOn) L.push(`   ✂️ ${d.serviceLabel || 'Services'}: ${money(cur, d.serviceTotal)} (${d.serviceCount})`)
  if (d.tips > 0) L.push(`   🙏 Tips: ${money(cur, d.tips)}`)
  if (d.expensesTotal > 0) L.push(`🧾 Expenses: ${money(cur, d.expensesTotal)}`)
  if (typeof d.netProfit === 'number') L.push(`📈 Profit today: ${money(cur, d.netProfit)}`)

  if (d.topItems?.length) {
    L.push('')
    L.push('*Top sellers*')
    d.topItems.forEach((t, i) => L.push(`${i + 1}. ${t.name} — ${t.quantity} sold`))
  }

  const attention = []
  if (d.outOfStock > 0) attention.push(`🚫 ${d.outOfStock} out of stock`)
  if (d.lowStock > 0) attention.push(`⚠️ ${d.lowStock} running low`)
  if (d.expiring > 0) attention.push(`⏳ ${d.expiring} expired or expiring soon`)
  if (d.openJobs > 0) attention.push(`🛠 ${d.openJobs} open job${d.openJobs === 1 ? '' : 's'} / booking${d.openJobs === 1 ? '' : 's'}`)
  if (d.owedTotal > 0) attention.push(`👥 Customers owe you ${money(cur, d.owedTotal)}`)
  if (attention.length) {
    L.push('')
    L.push('*Needs attention*')
    L.push(...attention)
  } else {
    L.push('')
    L.push('✅ Nothing needs attention.')
  }

  L.push('')
  L.push('_Sent from StockTracer_')
  return L.join('\n')
}

/** One message covering every business the owner runs. */
export function buildCombinedReport(reports, dateLabel, currency = 'UGX') {
  if (reports.length === 1) return buildDailyReport(reports[0])
  const total = reports.reduce((n, r) => n + (r.salesTotal || 0) + (r.serviceTotal || 0), 0)
  const L = [`🏬 *All my businesses* — ${dateLabel}`, `💰 *Combined today: ${money(currency, total)}*`, '']
  reports.forEach((r) => {
    L.push(`*${r.businessName}*: ${money(r.currency || currency, (r.salesTotal || 0) + (r.serviceTotal || 0))}`)
  })
  L.push('', '———', '')
  L.push(reports.map(buildDailyReport).join('\n\n———\n\n'))
  return L.join('\n')
}
