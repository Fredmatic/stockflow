import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import BusinessTypePicker from '../components/BusinessTypePicker'
import { getProfile, servicesEnabled } from '../lib/businessTypes'

const SOCIAL_PLATFORMS = ['TikTok', 'Instagram', 'Facebook', 'X (Twitter)']

export default function BusinessInfo() {
    const { business, setBusiness } = useAuth()

    const [tagline, setTagline] = useState(business?.tagline || '')
    const [location, setLocation] = useState(business?.location || '')
    const [phone, setPhone] = useState(business?.phone || '')
    const [socialPlatform, setSocialPlatform] = useState(business?.social_platform || '')
    const [socialHandle, setSocialHandle] = useState(business?.social_handle || '')

    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    async function handleSave(e) {
        e.preventDefault()
        if (!business?.id) return
        setSaving(true)
        setError('')
        setMessage('')

        const updates = {
            tagline: tagline.trim() || null,
            location: location.trim() || null,
            phone: phone.trim() || null,
            social_platform: socialHandle.trim() ? (socialPlatform || null) : null,
            social_handle: socialHandle.trim() || null,
        }

        const { error: err } = await supabase.from('businesses').update(updates).eq('id', business.id)
        setSaving(false)
        if (err) {
            setError(err.message)
            return
        }
        setBusiness((prev) => (prev ? { ...prev, ...updates } : prev))
        setMessage('Saved.')
        setTimeout(() => setMessage(''), 3000)
    }

    return (
        <div className="max-w-md space-y-6">
            <div>
                <h1 className="font-display text-xl font-semibold">Business info</h1>
                <p className="text-muted text-sm">
                    Shown on your receipts — location, contact, and the WhatsApp QR code your customers scan.
                    Anything left blank is simply left off the receipt.
                </p>
            </div>

            <form onSubmit={handleSave} className="card p-4 space-y-4">
                <div>
                    <label className="text-sm font-medium block mb-1">Tagline</label>
                    <input
                        className="input w-full"
                        placeholder="e.g. Fashion • Style • Quality"
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value)}
                    />
                </div>

                <div>
                    <label className="text-sm font-medium block mb-1">Location</label>
                    <input
                        className="input w-full"
                        placeholder="e.g. Bwaise Kikuubo Arcade"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                    />
                </div>

                <div>
                    <label className="text-sm font-medium block mb-1">Phone / WhatsApp number</label>
                    <input
                        className="input w-full"
                        placeholder="e.g. 0740193837"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                    />
                    <p className="text-xs text-muted mt-1">
                        Used for "Call/WhatsApp" on your receipt, and to generate your receipt's QR code.
                        Enter it the way you'd tell a customer to dial it — Ugandan numbers starting with 0 are handled automatically.
                    </p>
                </div>

                <div>
                    <label className="text-sm font-medium block mb-1">Social media (optional)</label>
                    <div className="flex gap-2">
                        <select
                            className="input"
                            style={{ flex: '0 0 130px' }}
                            value={socialPlatform}
                            onChange={(e) => setSocialPlatform(e.target.value)}
                        >
                            <option value="">Platform</option>
                            {SOCIAL_PLATFORMS.map((p) => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                        <input
                            className="input flex-1"
                            placeholder="e.g. Fredmatic"
                            value={socialHandle}
                            onChange={(e) => setSocialHandle(e.target.value)}
                        />
                    </div>
                </div>

                {message && <p className="text-sm text-brand-dark">{message}</p>}
                {error && <p className="text-sm text-brick">{error}</p>}

                <button type="submit" disabled={saving} className="btn-primary w-full">
                    {saving ? 'Saving…' : 'Save business info'}
                </button>
            </form>

            <SetupCard />
        </div>
    )
}

// Name, kind of business, and which modules are switched on.
function SetupCard() {
    const { business, setBusiness } = useAuth()
    const [name, setName] = useState(business?.name || '')
    const [type, setType] = useState(business?.type || 'retail')
    const [services, setServices] = useState(servicesEnabled(business))
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    // Picking another type resets the Services switch to that type's default.
    function changeType(t) {
        setType(t)
        setServices(!!getProfile(t).modules.services)
    }

    async function save(e) {
        e.preventDefault()
        setSaving(true)
        setError('')
        const updates = {
            name: name.trim() || business.name,
            type,
            settings: { ...(business.settings || {}), services },
        }
        const { error: err } = await supabase.from('businesses').update(updates).eq('id', business.id)
        setSaving(false)
        if (err) return setError(err.message)
        setBusiness((prev) => (prev ? { ...prev, ...updates } : prev))
        setMessage('Saved — your menus now match this business.')
        setTimeout(() => setMessage(''), 3000)
    }

    return (
        <form onSubmit={save} className="card p-4 space-y-4">
            <div>
                <h2 className="font-display text-sm font-semibold">Business setup</h2>
                <p className="text-xs text-muted">Changing the type changes the menus, fields and wording. Your data is not touched.</p>
            </div>
            <div>
                <label className="text-sm font-medium block mb-1">Business name</label>
                <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
                <label className="text-sm font-medium block mb-1">Type of business</label>
                <BusinessTypePicker value={type} onChange={changeType} />
            </div>
            <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="w-4 h-4 mt-0.5" checked={services} onChange={(e) => setServices(e.target.checked)} />
                <span>
                    Also offer services (repairs, bookings, haircuts…)
                    <span className="block text-xs text-muted">Adds a Services page with staff commission, deposits and job tracking.</span>
                </span>
            </label>
            {message && <p className="text-sm text-brand-dark">{message}</p>}
            {error && <p className="text-sm text-brick">{error}</p>}
            <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Saving…' : 'Save setup'}</button>
        </form>
    )
}