import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Apply the saved/system theme before React mounts, so there's no flash of
// the wrong theme on load (dark mode is just a class on <html>, but if we
// waited for ThemeProvider's useEffect to run after first paint, a
// dark-mode user would briefly see the light theme every time the app
// loads).
;(function applyInitialTheme() {
  try {
    const stored = localStorage.getItem('stocktracer_theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = stored === 'dark' || (stored !== 'light' && prefersDark)
    document.documentElement.classList.toggle('dark', isDark)
  } catch {
    // If anything here fails, default to light — ThemeProvider will
    // reconcile the class once React mounts anyway.
  }
})()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register the service worker so the browser recognizes this as an
// installable app. Registered after load so it never delays the first paint.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err)
    })
  })
}
