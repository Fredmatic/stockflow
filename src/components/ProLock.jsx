// src/components/ProLock.jsx
//
// Wraps a Pro-only feature so Starter owners can SEE it (builds desire to
// upgrade) but can't USE it — content is visually present but dimmed and
// non-interactive, with an upgrade prompt overlaid on top.
//
// Usage:
//   <ProLock feature="Expense management">
//     <ExpensesPageContent />
//   </ProLock>
//
// If business.plan is 'pro' (or missing/unknown — fail open rather than
// locking someone out due to a loading state), children render normally.

import { useAuth } from '../context/AuthContext'
import { isPro } from '../lib/planFeatures'

const WA_NUMBER = '256740193837'

export default function ProLock({ feature, children }) {
    const { business } = useAuth()

    // While business is still loading, don't flash a lock over content that
    // will turn out to be unlocked a moment later.
    if (!business || isPro(business)) {
        return children
    }

    const waText = `Hi, I'm on the Starter plan for "${business.name}" and I'd like to upgrade to Pro to unlock ${feature}.`

    return (
        <div className="relative">
            <div aria-hidden="true" className="pointer-events-none select-none opacity-40 blur-[1.5px]">
                {children}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-paper/60 rounded-lg">
                <div className="bg-paper-raised border border-line rounded-lg shadow-lg p-6 max-w-xs text-center mx-4">
                    <div className="text-2xl mb-2">🔒</div>
                    <p className="font-display font-semibold text-sm mb-1">{feature} is a Pro feature</p>
                    <p className="text-xs text-muted mb-4">
                        Upgrade from Starter to Pro to unlock this for {business.name}.
                    </p>
                    <a
                        href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waText)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary text-sm inline-block w-full"
                    >
                        Upgrade to Pro
                    </a>
                </div>
            </div>
        </div>
    )
}