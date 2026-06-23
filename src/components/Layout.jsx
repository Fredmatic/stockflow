import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canAccess } from '../lib/permissions'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '◧' },
  { to: '/products', label: 'Products', icon: '▤' },
  { to: '/stock-in', label: 'Stock In', icon: '↓' },
  { to: '/sell', label: 'Sell', icon: '↑' },
  { to: '/sales', label: 'Sales', icon: '◫' },
  { to: '/staff', label: 'Staff', icon: '◍' },
]

export default function Layout() {
  const { business, activeStaff, switchUser, signOut } = useAuth()
  const visibleNavItems = NAV_ITEMS.filter((item) => canAccess(item.to, activeStaff))

  return (
    <div className="min-h-screen flex">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-56 flex-col border-r border-line bg-paper-raised">
        <div className="px-5 py-5 ledger-rule">
          <div className="font-display font-semibold text-brand-dark">StockFlow</div>
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
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-line bg-paper-raised">
          <div>
            <div className="font-display font-semibold text-brand-dark text-sm">StockFlow</div>
            <div className="text-xs text-muted">{business?.name}</div>
          </div>
          <button onClick={switchUser} className="text-xs text-brand-dark font-medium">
            {activeStaff?.name} ▾
          </button>
        </header>

        <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8">
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
    </div>
  )
}
