import { useState } from 'react'
import { fetchDailyReportData } from '../lib/dailyReport'
import { buildCombinedReport, whatsappLink } from '../lib/whatsapp'

// "Send today's report on WhatsApp": builds the owner's end-of-day summary and opens
// WhatsApp with it ready to send (to themselves, a partner, or a group — their choice).
// Pass several businesses to get one combined report. Owner only: it includes profit.
export default function WhatsAppReportButton({ businesses, label = 'Send today’s report on WhatsApp' }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  async function send() {
    setBusy(true)
    setNote('')
    try {
      const reports = await Promise.all(businesses.map((b) => fetchDailyReportData(b, { includeProfit: true })))
      const dateLabel = reports[0].dateLabel
      const text = buildCombinedReport(reports, dateLabel, reports[0].currency)
      const opened = window.open(whatsappLink('', text), '_blank', 'noopener')
      if (!opened) {
        // Pop-up blocked: put the report on the clipboard instead.
        await navigator.clipboard?.writeText(text)
        setNote('Report copied — paste it into WhatsApp.')
      }
    } catch {
      setNote('Could not build the report. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <button onClick={send} disabled={busy} className="btn-secondary inline-flex items-center gap-2">
        <span aria-hidden>💬</span>
        {busy ? 'Preparing…' : label}
      </button>
      {note && <p className="text-xs text-muted mt-1">{note}</p>}
    </div>
  )
}
