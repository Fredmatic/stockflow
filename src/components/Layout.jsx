import { useState, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canAccess } from '../lib/permissions'
import { hasTutorialBeenDismissed } from '../lib/tutorialStorage'
import TutorialPopup from './TutorialPopup'
import { supabase } from '../lib/supabase'
import Calculator from './Calculator'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '◧' },
  { to: '/products', label: 'Products', icon: '▤' },
  { to: '/stock-in', label: 'Stock In', icon: '↓' },
  { to: '/sell', label: 'Sell', icon: '↑' },
  { to: '/sales', label: 'Sales', icon: '◫' },
  { to: '/customers', label: 'Customers', icon: '⊙' },
  { to: '/expenses', label: 'Expenses', icon: '−' },
  { to: '/staff', label: 'Staff', icon: '◍' },
]

export default function Layout() {
  const { business, activeStaff, switchUser, signOut } = useAuth()
  // Same bootstrap exception as App.jsx's <Restricted>: before anyone has
  // picked a staff member, /staff must still be reachable so the owner can
  // add the first team member at all.
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => (item.to === '/staff' && !activeStaff) || canAccess(item.to, activeStaff)
  )

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
  const [overdueCount, setOverdueCount] = useState(0)

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
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${
                  isActive ? 'bg-brand-light text-brand-dark' : 'text-ink hover:bg-paper'
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
        <header className="md:hidden sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-line bg-paper-raised">
          <div>
            <div className="font-display font-semibold text-brand-dark text-sm">StockTracer</div>
            <div className="text-xs text-muted">{business?.name}</div>
          </div>
          <button onClick={switchUser} className="text-xs text-brand-dark font-medium">
            {activeStaff?.name} ▾
          </button>
        </header>

        <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8">
          {overdueCount > 0 && (
            <div className="mb-4 flex items-center gap-2 bg-brick/10 border border-brick/30 text-brick rounded-md px-4 py-2 text-sm font-medium">
              <span>⚠</span>
              <span>{overdueCount} customer{overdueCount !== 1 ? 's' : ''} past their payment deadline</span>
              <a href="/customers" className="ml-auto underline text-xs">View</a>
            </div>
          )}
          <Outlet />
        </main>

        {/* Bottom tab bar — mobile */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-paper-raised border-t border-line flex">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-2 text-xs ${
                  isActive ? 'text-brand-dark' : 'text-muted'
                }`
              }
            >
              <span className="font-mono text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <button
        onClick={() => setShowCalculator(true)}
        aria-label="Open calculator"
        className="fixed right-4 bottom-20 md:bottom-6 z-40 w-12 h-12 rounded-full bg-brand text-white shadow-lg flex items-center justify-center text-lg font-mono hover:bg-brand-dark"
      >
        ÷
      </button>

      {showCalculator && <Calculator onClose={() => setShowCalculator(false)} />}

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
