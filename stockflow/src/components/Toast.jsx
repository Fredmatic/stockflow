// Small fixed-position confirmation banner. Pulled out of Sell.jsx, which
// used to render three copies of an inline "message" block (mobile products
// column, desktop cart column, cart drawer) so at least one was always on
// screen — fragile, and easy to miss if you'd scrolled. This renders once,
// fixed to the top of the viewport, above everything including the cart
// drawer, so a confirmation is never scrolled out of view or hidden behind
// an overlay that just closed.

const STYLES = {
    success: { bg: 'var(--color-brand-light)', fg: 'var(--color-brand-dark)', icon: '✓' },
    error: { bg: 'var(--color-brick-light)', fg: 'var(--color-brick)', icon: '✕' },
    warning: { bg: 'var(--color-amber-light)', fg: 'var(--color-amber)', icon: '⚠' },
    offline: { bg: 'var(--color-amber-light)', fg: 'var(--color-amber)', icon: '📴' },
    info: { bg: 'var(--color-brand-light)', fg: 'var(--color-brand-dark)', icon: 'ℹ' },
}

export default function Toast({ type = 'info', message, action, onDismiss }) {
    if (!message) return null
    const s = STYLES[type] || STYLES.info

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed top-3 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-1.5rem)] max-w-sm rounded-lg shadow-lg px-4 py-3 flex items-start gap-2.5"
            style={{ background: s.bg, animation: 'toast-in 220ms ease-out' }}
        >
            <span className="text-base leading-5 shrink-0" style={{ color: s.fg }}>{s.icon}</span>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug" style={{ color: s.fg }}>{message}</p>
                {action && <div className="mt-2">{action}</div>}
            </div>
            {onDismiss && (
                <button
                    onClick={onDismiss}
                    aria-label="Dismiss"
                    className="text-xs opacity-60 hover:opacity-100 shrink-0 mt-0.5"
                    style={{ color: s.fg }}
                >
                    ✕
                </button>
            )}
        </div>
    )
}