// public/sw.js
//
// Minimal service worker whose only job is to receive push events and show
// a notification, and to focus/open the app when that notification is
// tapped. This is separate from any future offline-caching service worker —
// if you add one later (e.g. via vite-plugin-pwa), merge this push/
// notificationclick logic into that single file rather than registering two
// service workers.

self.addEventListener('install', () => {
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
    let data = {}
    try {
        data = event.data ? event.data.json() : {}
    } catch {
        data = { title: 'Payment reminder', body: event.data ? event.data.text() : '' }
    }

    const title = data.title || 'StockTracer reminder'
    const options = {
        body: data.body || '',
        icon: '/apple-touch-icon.png',
        badge: '/apple-touch-icon.png',
        tag: data.reminderId ? `reminder-${data.reminderId}` : undefined,
        data: { reminderId: data.reminderId, url: '/reminders' },
    }

    event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const targetUrl = event.notification.data?.url || '/reminders'

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(targetUrl) && 'focus' in client) {
                    return client.focus()
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl)
            }
        })
    )
})