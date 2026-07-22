import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { canAccess } from '../lib/permissions'
import { hasTutorialBeenDismissed } from '../lib/tutorialStorage'
import TutorialPopup from './TutorialPopup'
import BirthdayPopup from './BirthdayPopup'
import TrialBanner from './TrialBanner'
import { supabase } from '../lib/supabase'
import { queueCount } from '../lib/offlineQueue'
import Calculator from './Calculator'
import ReminderPopup from './ReminderPopup'
import { ScannerModal, ScanIcon } from './Scanner'

const NAV_ITEMS = [
    { to: '/dashboard', label: 'Dashboard', icon: '◧' },
    { to: '/products', label: 'Products', icon: '▤' },
    { to: '/stock-in', label: 'Stock In', icon: '↓' },
    { to: '/sell', label: 'Sell', icon: '↑' },
    { to: '/sales', label: 'Sales', icon: '◫' },
    { to: '/customers', label: 'Customers', icon: '⊙' },
    { to: '/lenders', label: 'People I Owe', icon: '◐' },
    { to: '/expenses', label: 'Expenses', icon: '−' },
    { to: '/spending', label: 'Spending', icon: '◆' },
    { to: '/reminders', label: 'Reminders', icon: '⏰' },
    { to: '/staff', label: 'Staff', icon: '◍' },
    { to: '/reports', label: 'Reports', icon: '📊' },
]

export default function Layout() {
    const { business, activeStaff, switchUser, signOut } = useAuth()
    const { theme, toggleTheme } = useTheme()
    const location = useLocation()
    const navigate = useNavigate()
    const [showGlobalScanner, setShowGlobalScanner] = useState(false)
    const canSell = canAccess('/sell', activeStaff)

    // Lets someone scan a barcode from *any* page — Dashboard, Products,
    // wherever — and land straight in Sell with that item already added to
    // the cart, instead of having to first navigate to Sell and use the
    // scan button buried in its search bar. Sell.jsx picks up
    // `scannedBarcode` from location.state on mount/update (see its
    // useEffect) and clears it once handled so it doesn't re-fire.
    function handleGlobalScan(code) {
        setShowGlobalScanner(false)
        navigate('/sell', { state: { scannedBarcode: code, scannedAt: Date.now() } })
    }

    // Same bootstrap exception as App.jsx's <Restricted>: before anyone has
    // picked a staff member, /staff must still be reachable so the owner can
    // add the first team member at all.
    const visibleNavItems = NAV_ITEMS.filter(
        (item) => (item.to === '/staff' && !activeStaff) || canAccess(item.to, activeStaff)
    )

    // Mobile bottom tab bar: keep it to a max of 4 tabs so it never feels
    // cramped, however many sections the signed-in role can see. Anything
    // past that lives behind a "More" sheet instead of squeezing in.
    const BOTTOM_TAB_LIMIT = 4
    const primaryNavItems = visibleNavItems.slice(0, BOTTOM_TAB_LIMIT)
    const overflowNavItems = visibleNavItems.slice(BOTTOM_TAB_LIMIT)
    const isOnOverflowRoute = overflowNavItems.some((item) => item.to === location.pathname)
    const [showMoreMenu, setShowMoreMenu] = useState(false)

    // Show the walkthrough right after someone picks their name/PIN, unless
    // they've already told us (on this device) not to show it again. Computed
    // during render (not in an effect) so it's correct on the very first paint
    // after activeStaff changes, with no extra render cycle.
    const [tutorialDismissedThisSession, setTutorialDismissedThisSession] = useState(false)

    // Reset dismissal when staff changes. Must be useEffect — calling setState
    // conditionally during render causes React error #301.
    useEffect(() => {
        setTutorialDismissedThisSession(false)
    }, [activeStaff?.id])

    const showTutorial = !!activeStaff && !tutorialDismissedThisSession && !hasTutorialBeenDismissed(activeStaff.id)

    const [showCalculator, setShowCalculator] = useState(false)
    const [showMobileMenu, setShowMobileMenu] = useState(false)
    const [overdueCount, setOverdueCount] = useState(0)
    const [overdueLenderCount, setOverdueLenderCount] = useState(0)
    const [pendingSales, setPendingSales] = useState(0)

    useEffect(() => {
        setPendingSales(queueCount())
        const interval = setInterval(() => setPendingSales(queueCount()), 5000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        if (!business) return
        async function checkOverdue() {
            const today = new Date().toISOString().split('T')[0]
            const { data } = await supabase
                .from('customers')
                .select('id')
                .eq('business_id', business.id)
                .eq('is_active', true)
                .lt('payment_due_date', today)
                .not('payment_due_date', 'is', null)
            setOverdueCount((data || []).length)

            checkOverdue()
            const interval = setInterval(checkOverdue, 60000)
            return () => clearInterval(interval)
        }
    }, [business])

    useEffect(() => {
        if (!business) return
        async function checkOverdue() {
            const today = new Date().toISOString().split('T')[0]
            const { data } = await supabase
                .from('debtor_summary')
                .select('customer_id, balance')
                .eq('business_id', business.id)
                .gt('balance', 0)

            const customerIds = (data || []).map(d => d.customer_id)
            if (customerIds.length === 0) { setOverdueCount(0); return }

            const { data: overdue } = await supabase
                .from('customers')
                .select('id')
                .eq('business_id', business.id)
                .eq('is_active', true)
                .lt('payment_due_date', today)
                .not('payment_due_date', 'is', null)
                .in('id', customerIds)
            setOverdueCount((overdue || []).length)
        }
        checkOverdue()
        const interval = setInterval(checkOverdue, 60000)
        return () => clearInterval(interval)
    }, [business])

    return (
        <div className="min-h-screen flex">
            {/* Sidebar — desktop */}
            <aside className="hidden md:flex w-56 flex-col border-r border-line bg-paper-raised">
                <div className="px-5 py-5 ledger-rule">
                    <div className="font-display font-semibold text-brand-dark">StockTracer</div>
                    <div className="text-xs text-muted mt-0.5 truncate">{business?.name}</div>
                </div>
                <nav className="flex-1 px-3 py-4 space-y-1">
                    {visibleNavItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-brand-light text-brand-dark' : 'text-ink hover:bg-paper'
                                }`
                            }
                        >
                            <span className="font-mono">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
                <div className="px-5 py-4 ledger-rule border-t">
                    <div className="text-sm font-medium">{activeStaff?.name}</div>
                    <div className="text-xs text-muted uppercase tracking-wide mb-3">{activeStaff?.role}</div>
                    <button onClick={toggleTheme} className="text-xs text-brand-dark font-medium block mb-1">
                        {theme === 'dark' ? '☀ Light mode' : '🌙 Dark mode'}
                    </button>
                    <button onClick={switchUser} className="text-xs text-brand-dark font-medium block mb-1">
                        Switch user
                    </button>
                    <button onClick={signOut} className="text-xs text-muted block">
                        Sign out owner
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col">
                <header className="safe-top md:hidden sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-line bg-paper-raised">
                    <div>
                        <div className="font-display font-semibold text-brand-dark text-sm">StockTracer</div>
                        <div className="text-xs text-muted">{business?.name}</div>
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => setShowMobileMenu((v) => !v)}
                            className="text-xs text-brand-dark font-medium flex items-center gap-1"
                        >
                            {activeStaff?.name} ▾
                        </button>
                        {showMobileMenu && (
                            <>
                                <div className="fixed inset-0 z-20" onClick={() => setShowMobileMenu(false)} />
                                <div className="absolute right-0 top-full mt-2 w-44 bg-paper-raised border border-line rounded-md shadow-lg z-30 py-1">
                                    <div className="px-3 py-2 border-b border-line">
                                        <div className="text-sm font-medium">{activeStaff?.name}</div>
                                        <div className="text-xs text-muted uppercase tracking-wide">{activeStaff?.role}</div>
                                    </div>
                                    <button
                                        onClick={() => { toggleTheme() }}
                                        className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-paper"
                                    >
                                        {theme === 'dark' ? '☀ Light mode' : '🌙 Dark mode'}
                                    </button>
                                    <button
                                        onClick={() => { setShowMobileMenu(false); switchUser() }}
                                        className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-paper"
                                    >
                                        Switch user
                                    </button>
                                    <button
                                        onClick={() => { setShowMobileMenu(false); signOut() }}
                                        className="w-full text-left px-3 py-2 text-sm text-brick hover:bg-paper"
                                    >
                                        Sign out owner
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </header>

                <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8">
                    <TrialBanner business={business} />
                    {pendingSales > 0 && (
                        <div className="mb-4 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-700 rounded-md px-4 py-2 text-sm font-medium">
                            <span>📴</span>
                            <span>{pendingSales} sale{pendingSales !== 1 ? 's' : ''} waiting to sync — keep this device connected to the internet</span>
                        </div>
                    )}

                    {overdueCount > 0 && (
                        <div className="mb-4 flex items-center gap-2 bg-brick/10 border border-brick/30 text-brick rounded-md px-4 py-2 text-sm font-medium">
                            <span>⚠</span>
                            <span>{overdueCount} customer{overdueCount !== 1 ? 's' : ''} past their payment deadline</span>
                            <a href="/customers" className="ml-auto underline text-xs">View</a>
                        </div>
                    )}
                    {overdueLenderCount > 0 && (
                        <div className="mb-4 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-700 rounded-md px-4 py-2 text-sm font-medium">
                            <span>⚠</span>
                            <span>You're past the repayment date for {overdueLenderCount} lender{overdueLenderCount !== 1 ? 's' : ''}</span>
                            <a href="/lenders" className="ml-auto underline text-xs">View</a>
                        </div>
                    )}
                    <Outlet />
                </main>

                {/* Bottom tab bar — mobile */}
                <nav className="safe-bottom-nav md:hidden fixed bottom-0 left-0 right-0 bg-paper-raised border-t border-line flex z-40">
                    {primaryNavItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `flex-1 flex flex-col items-center py-2 text-xs ${isActive ? 'text-brand-dark' : 'text-muted'
                                }`
                            }
                        >
                            <span className="font-mono text-base">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}
                    {overflowNavItems.length > 0 && (
                        <button
                            onClick={() => setShowMoreMenu(true)}
                            className={`flex-1 flex flex-col items-center py-2 text-xs ${isOnOverflowRoute ? 'text-brand-dark' : 'text-muted'
                                }`}
                        >
                            <span className="font-mono text-base">⋯</span>
                            More
                        </button>
                    )}
                </nav>

                {showMoreMenu && (
                    <div className="md:hidden fixed inset-0 z-50 flex items-end" onClick={() => setShowMoreMenu(false)}>
                        <div className="fixed inset-0 bg-black/30" />
                        <div
                            className="relative w-full bg-paper-raised rounded-t-lg p-2 pb-6"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="w-10 h-1 bg-line rounded-full mx-auto my-2" />
                            {overflowNavItems.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    onClick={() => setShowMoreMenu(false)}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium ${isActive ? 'bg-brand-light text-brand-dark' : 'text-ink'
                                        }`
                                    }
                                >
                                    <span className="font-mono w-5 text-center">{item.icon}</span>
                                    {item.label}
                                </NavLink>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {canSell && location.pathname !== '/sell' && (
                <button
                    onClick={() => setShowGlobalScanner(true)}
                    aria-label="Scan a product to sell"
                    className="fab-above-nav fixed left-4 z-40 w-12 h-12 rounded-full bg-brand text-white shadow-lg flex items-center justify-center hover:bg-brand-dark"
                >
                    <ScanIcon />
                </button>
            )}

            {showGlobalScanner && (
                <ScannerModal
                    onResult={handleGlobalScan}
                    onClose={() => setShowGlobalScanner(false)}
                    instructions="Scan a product's barcode to add it straight to a new sale."
                />
            )}

            <button
                onClick={() => setShowCalculator(true)}
                aria-label="Open calculator"
                className="fab-above-nav fixed right-4 z-40 w-12 h-12 rounded-full bg-brand text-white shadow-lg flex items-center justify-center text-lg font-mono hover:bg-brand-dark"
            >
                ÷
            </button>

            {showCalculator && <Calculator onClose={() => setShowCalculator(false)} />}

            <BirthdayPopup name={activeStaff?.name} />
            <ReminderPopup businessId={business?.id} />

            {showTutorial && (
                <TutorialPopup
                    staffId={activeStaff?.id}
                    activeStaff={activeStaff}
                    onClose={() => setTutorialDismissedThisSession(true)}
                />
            )}
        </div>
    )
}