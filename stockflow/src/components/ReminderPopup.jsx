import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

function fmt(n) { return 'UGX ' + Number(n || 0).toLocaleString() }

function isDueToday(r) {
    const now = new Date()
    const day = now.getDate()          // 1-31
    const month = now.getMonth() + 1     // 1-12
    const dow = now.getDay()           // 0=Sun

    if (r.frequency === 'daily') return true
    if (r.frequency === 'weekly') return Number(r.due_day) === dow
    if (r.frequency === 'monthly') return Number(r.due_day) === day
    if (r.frequency === 'yearly') return Number(r.due_month) === month && Number(r.due_day) === day
    return false
}

function todayKey() {
    return 'stocktracer_reminder_shown_' + new Date().toISOString().slice(0, 10)
}

export default function ReminderPopup({ businessId, forceShow = false, onClose }) {
    const [dueReminders, setDueReminders] = useState([])
    const [visible, setVisible] = useState(false)
    const shownRef = useRef(false)

    // When forceShow changes to true, reset shownRef so test works every click
    useEffect(() => {
        if (forceShow) shownRef.current = false
    }, [forceShow])

    useEffect(() => {
        if (!businessId) return

        async function check() {
            // In test mode: bypass time and daily-once checks
            if (!forceShow) {
                if (localStorage.getItem(todayKey())) return
                if (shownRef.current) return
                const now = new Date()
                if (now.getHours() !== 18) return
            }
            if (shownRef.current) return

            const { data } = await supabase
                .from('recurring_reminders')
                .select('*')
                .eq('business_id', businessId)
                .eq('is_active', true)

            const due = forceShow ? (data || []) : (data || []).filter(isDueToday)
            if (due.length === 0) {
                if (!forceShow) localStorage.setItem(todayKey(), '1')
                return
            }

            shownRef.current = true
            if (!forceShow) localStorage.setItem(todayKey(), '1')
            setDueReminders(due)
            setVisible(true)
        }

        check()
        const interval = forceShow ? null : setInterval(check, 30_000)
        return () => { if (interval) clearInterval(interval) }
    }, [businessId, forceShow])

    if (!visible || dueReminders.length === 0) return null

    const total = dueReminders.reduce((s, r) => s + Number(r.amount), 0)

    return (
        <div className="reminder-overlay" onClick={() => setVisible(false)}>
            <div className="reminder-popup" onClick={e => e.stopPropagation()}>
                <div className="reminder-popup-header">
                    <span className="reminder-bell">🔔</span>
                    <div>
                        <div className="reminder-popup-title">Payment reminder</div>
                        <div className="reminder-popup-sub">
                            {dueReminders.length} payment{dueReminders.length > 1 ? 's' : ''} due today
                        </div>
                    </div>
                </div>

                <ul className="reminder-list">
                    {dueReminders.map(r => (
                        <li key={r.id} className="reminder-item">
                            <span className="reminder-item-label">{r.label}</span>
                            <span className="reminder-item-amount">{fmt(r.amount)}</span>
                        </li>
                    ))}
                </ul>

                {dueReminders.length > 1 && (
                    <div className="reminder-total">
                        <span>Total due today</span>
                        <span className="reminder-total-amount">{fmt(total)}</span>
                    </div>
                )}

                <button className="reminder-dismiss" onClick={() => { setVisible(false); onClose?.() }}>
                    Got it
                </button>
            </div>

            <style>{`
        .reminder-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 200ms ease;
        }
        .reminder-popup {
          background: var(--color-paper-raised);
          border: 1px solid var(--color-line);
          border-radius: 16px;
          width: 100%;
          max-width: 360px;
          padding: 24px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
          animation: slideUp 220ms ease;
        }
        .reminder-popup-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 20px;
        }
        .reminder-bell {
          font-size: 32px;
          line-height: 1;
        }
        .reminder-popup-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--color-ink);
        }
        .reminder-popup-sub {
          font-size: 13px;
          color: var(--color-muted);
          margin-top: 2px;
        }
        .reminder-list {
          list-style: none;
          padding: 0;
          margin: 0 0 16px;
          border: 1px solid var(--color-line);
          border-radius: 10px;
          overflow: hidden;
        }
        .reminder-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
          border-bottom: 1px solid var(--color-line);
          background: var(--color-paper);
        }
        .reminder-item:last-child { border-bottom: none; }
        .reminder-item-label {
          font-size: 14px;
          font-weight: 500;
          color: var(--color-ink);
        }
        .reminder-item-amount {
          font-size: 14px;
          font-weight: 600;
          color: var(--color-brand);
        }
        .reminder-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          background: var(--color-brand-light);
          border: 1px solid var(--color-brand);
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 14px;
          font-weight: 600;
          color: var(--color-brand);
        }
        .reminder-total-amount {
          font-size: 15px;
        }
        .reminder-dismiss {
          width: 100%;
          background: var(--color-brand);
          color: white;
          border: none;
          border-radius: 10px;
          padding: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: opacity 150ms;
        }
        .reminder-dismiss:hover { opacity: 0.88; }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
        </div>
    )
}