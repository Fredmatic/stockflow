// src/pages/Reminders.jsx
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ReminderPopup from '../components/ReminderPopup'


const FREQUENCIES = [
    { value: 'daily', label: 'Every day' },
    { value: 'weekly', label: 'Every week' },
    { value: 'monthly', label: 'Every month' },
    { value: 'yearly', label: 'Every year' },
]

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const QUICK_ADD = [
    { label: 'Tax', frequency: 'monthly' },
    { label: 'Rent', frequency: 'monthly' },
    { label: 'Workers pay', frequency: 'monthly' },
]

const emptyForm = { id: null, label: '', amount: '', frequency: 'monthly', due_day: 1, due_month: 1 }

export default function Reminders() {
    const { business } = useAuth()


    const [reminders, setReminders] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [form, setForm] = useState(emptyForm)
    const [showForm, setShowForm] = useState(false)
    const [testMode, setTestMode] = useState(false)

    const load = useCallback(async () => {
        if (!business?.id) return
        setLoading(true)
        const { data, error } = await supabase
            .from('recurring_reminders')
            .select('*')
            .eq('business_id', business.id)
            .order('created_at', { ascending: false })
        if (error) setError(error.message)
        else setReminders(data || [])
        setLoading(false)
    }, [business?.id])

    useEffect(() => {
        load()
    }, [load])

    function openNew(prefill = {}) {
        setForm({ ...emptyForm, ...prefill })
        setShowForm(true)
    }

    function openEdit(reminder) {
        setForm({
            id: reminder.id,
            label: reminder.label,
            amount: reminder.amount,
            frequency: reminder.frequency,
            due_day: reminder.due_day ?? 1,
            due_month: reminder.due_month ?? 1,
        })
        setShowForm(true)
    }

    async function handleSave(e) {
        e.preventDefault()
        if (!business?.id) return
        setSaving(true)
        setError(null)

        const payload = {
            business_id: business.id,
            label: form.label.trim(),
            amount: Number(form.amount) || 0,
            frequency: form.frequency,
            due_day: form.frequency === 'daily' ? null : Number(form.due_day),
            due_month: form.frequency === 'yearly' ? Number(form.due_month) : null,
        }

        const query = form.id
            ? supabase.from('recurring_reminders').update(payload).eq('id', form.id)
            : supabase.from('recurring_reminders').insert(payload)

        const { error } = await query
        setSaving(false)
        if (error) {
            setError(error.message)
            return
        }
        setShowForm(false)
        setForm(emptyForm)
        load()
    }

    async function toggleActive(reminder) {
        await supabase
            .from('recurring_reminders')
            .update({ is_active: !reminder.is_active })
            .eq('id', reminder.id)
        load()
    }

    async function remove(reminder) {
        if (!confirm(`Delete the "${reminder.label}" reminder?`)) return
        await supabase.from('recurring_reminders').delete().eq('id', reminder.id)
        load()
    }

    function describeSchedule(r) {
        if (r.frequency === 'daily') return 'Every day at 6:00 PM'
        if (r.frequency === 'weekly') return `Every ${WEEKDAYS[r.due_day] ?? '—'} at 6:00 PM`
        if (r.frequency === 'monthly') return `Day ${r.due_day} of every month, 6:00 PM`
        if (r.frequency === 'yearly') {
            const monthName = new Date(2000, (r.due_month ?? 1) - 1, 1).toLocaleString('en', { month: 'long' })
            return `${monthName} ${r.due_day} every year, 6:00 PM`
        }
        return ''
    }

    if (loading) {
        return <div className="min-h-[40vh] flex items-center justify-center text-muted text-sm">Loading reminders…</div>
    }

    return (
        <>
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="font-display text-xl font-semibold">Payment reminders</h1>
                        <p className="text-sm text-muted mt-1">
                            A popup notification arrives at 6:00 PM on any day a reminder is due — even if the app is closed.
                        </p>
                        <button
                            onClick={() => setTestMode(true)}
                            className="mt-2 text-xs text-brand-dark font-medium border border-brand-light bg-brand-light px-3 py-1.5 rounded-md hover:bg-brand/10 transition-colors"
                        >
                            🔔 Test popup now
                        </button>
                    </div>
                </div>

                {/* Quick add for the common three */}
                {!showForm && (
                    <div className="flex flex-wrap gap-2">
                        {QUICK_ADD.map((q) => (
                            <button
                                key={q.label}
                                onClick={() => openNew(q)}
                                className="text-sm px-3 py-1.5 rounded-full border hover:bg-black/5"
                            >
                                + {q.label}
                            </button>
                        ))}
                        <button
                            onClick={() => openNew()}
                            className="text-sm px-3 py-1.5 rounded-full border hover:bg-black/5"
                        >
                            + Custom reminder
                        </button>
                    </div>
                )}

                {/* Form */}
                {showForm && (
                    <form onSubmit={handleSave} className="border rounded-lg p-4 space-y-4">
                        <div>
                            <label className="text-sm font-medium">Label</label>
                            <input
                                type="text"
                                required
                                value={form.label}
                                onChange={(e) => setForm({ ...form, label: e.target.value })}
                                placeholder="e.g. Tax, Rent, Workers pay"
                                className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Amount</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                value={form.amount}
                                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                placeholder="0.00"
                                className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Repeats</label>
                            <select
                                value={form.frequency}
                                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                                className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                            >
                                {FREQUENCIES.map((f) => (
                                    <option key={f.value} value={f.value}>
                                        {f.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {form.frequency === 'weekly' && (
                            <div>
                                <label className="text-sm font-medium">Day of the week</label>
                                <select
                                    value={form.due_day}
                                    onChange={(e) => setForm({ ...form, due_day: e.target.value })}
                                    className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                                >
                                    {WEEKDAYS.map((day, i) => (
                                        <option key={day} value={i}>
                                            {day}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {(form.frequency === 'monthly' || form.frequency === 'yearly') && (
                            <div>
                                <label className="text-sm font-medium">Day of the month</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="31"
                                    required
                                    value={form.due_day}
                                    onChange={(e) => setForm({ ...form, due_day: e.target.value })}
                                    className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                                />
                            </div>
                        )}

                        {form.frequency === 'yearly' && (
                            <div>
                                <label className="text-sm font-medium">Month</label>
                                <select
                                    value={form.due_month}
                                    onChange={(e) => setForm({ ...form, due_month: e.target.value })}
                                    className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                                >
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <option key={i} value={i + 1}>
                                            {new Date(2000, i, 1).toLocaleString('en', { month: 'long' })}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {error && <p className="text-sm text-red-600">{error}</p>}

                        <div className="flex gap-2 pt-1">
                            <button type="submit" disabled={saving} className="btn-primary">
                                {saving ? 'Saving…' : form.id ? 'Save changes' : 'Add reminder'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowForm(false)
                                    setForm(emptyForm)
                                    setError(null)
                                }}
                                className="text-sm text-muted px-3 py-2"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}

                {/* List */}
                {reminders.length === 0 && !showForm ? (
                    <p className="text-sm text-muted">No reminders yet. Add tax, rent, or workers' pay above to get started.</p>
                ) : (
                    <ul className="divide-y border rounded-lg">
                        {reminders.map((r) => (
                            <li key={r.id} className="p-4 flex items-center justify-between gap-4">
                                <div className={!r.is_active ? 'opacity-50' : ''}>
                                    <p className="font-medium">{r.label}</p>
                                    <p className="text-sm text-muted">
                                        UGX {Number(r.amount).toLocaleString()} · {describeSchedule(r)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <button onClick={() => toggleActive(r)} className="text-sm text-muted underline">
                                        {r.is_active ? 'Pause' : 'Resume'}
                                    </button>
                                    <button onClick={() => openEdit(r)} className="text-sm text-muted underline">
                                        Edit
                                    </button>
                                    <button onClick={() => remove(r)} className="text-sm text-red-600 underline">
                                        Delete
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {testMode && <ReminderPopup businessId={business?.id} forceShow={true} onClose={() => setTestMode(false)} />}
        </>
    )
}