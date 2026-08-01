// Minimal service worker — exists only so the browser treats this app as
// installable (Chrome/Android requires a registered service worker with a
// fetch handler to show the "Install app" prompt).
//
// Deliberately does NOT cache API calls or pages: this app's data comes live
// from Supabase, and caching it would risk showing stale stock/sales numbers
// after install. If offline support is wanted later, add a real caching
// strategy here.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // Intentionally not intercepting — pass every request straight through to
  // the network. Presence of this handler is what satisfies installability.
})
