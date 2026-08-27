// src/hooks/usePushNotifications.js
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

// businessId: the owner's business.id from useAuth() — reminders and their
// push subscriptions are scoped per business, same as everything else here.
export function usePushNotifications(businessId) {
    const [supported, setSupported] = useState(true)
    const [permission, setPermission] = useState(
        typeof Notification !== 'undefined' ? Notification.permission : 'default'
    )
    const [subscribed, setSubscribed] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            setSupported(false)
            return
        }
        navigator.serviceWorker.register('/sw.js').catch((err) => setError(err.message))
    }, [])

    // Check whether this exact device already has a saved subscription.
    useEffect(() => {
        if (!businessId || !supported) return
            ; (async () => {
                const reg = await navigator.serviceWorker.ready
                const existing = await reg.pushManager.getSubscription()
                if (!existing) return
                const { data } = await supabase
                    .from('push_subscriptions')
                    .select('id')
                    .eq('endpoint', existing.endpoint)
                    .maybeSingle()
                setSubscribed(!!data)
            })()
    }, [businessId, supported])

    const subscribe = useCallback(async () => {
        if (!businessId) return
        setLoading(true)
        setError(null)
        try {
            const reg = await navigator.serviceWorker.ready
            const perm = await Notification.requestPermission()
            setPermission(perm)
            if (perm !== 'granted') {
                setError('Notifications were not allowed for this site.')
                return
            }

            let sub = await reg.pushManager.getSubscription()
            if (!sub) {
                sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                })
            }

            const json = sub.toJSON()
            const { error: dbError } = await supabase.from('push_subscriptions').upsert(
                {
                    business_id: businessId,
                    endpoint: json.endpoint,
                    p256dh: json.keys.p256dh,
                    auth: json.keys.auth,
                },
                { onConflict: 'endpoint' }
            )
            if (dbError) throw dbError
            setSubscribed(true)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [businessId])

    const unsubscribe = useCallback(async () => {
        setLoading(true)
        try {
            const reg = await navigator.serviceWorker.ready
            const sub = await reg.pushManager.getSubscription()
            if (sub) {
                await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
                await sub.unsubscribe()
            }
            setSubscribed(false)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [])

    return { supported, permission, subscribed, loading, error, subscribe, unsubscribe }
}