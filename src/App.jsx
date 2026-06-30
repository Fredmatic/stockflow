import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { canAccess } from './lib/permissions'
import Login from './pages/Login'
import StaffPicker from './pages/StaffPicker'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import StockIn from './pages/StockIn'
import Sell from './pages/Sell'
import Sales from './pages/Sales'
import Customers from './pages/Customers'
import Lenders from './pages/Lenders'
import Staff from './pages/Staff'
import Expenses from './pages/Expenses'

function Gate({ children }) {
  const { session, business, businessLoading, businessError, activeStaff, loading, signOut } = useAuth()
  const location = useLocation()

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted text-sm">Loading…</div>
  if (!session) return <Login />
  if (businessLoading) return <div className="min-h-screen flex items-center justify-center text-muted text-sm">Setting up your business…</div>
  if (!business) return <NoBusinessScreen error={businessError} onSignOut={signOut} />
  // Allow reaching the Staff page even before anyone has picked an active
  // staff member — the owner needs this to add their team in the first place.
  if (!activeStaff && location.pathname !== '/staff') return <StaffPicker />
  return children
}

// Shown when someone is genuinely signed in but has no business linked to
// their account — most commonly because they signed up, but never clicked
// the email confirmation link before the business row could be created
// (Row Level Security blocks the insert until there's a real session).
// Previously this state looked identical to "still loading", leaving people
// stuck on a spinner forever with no way out.
function NoBusinessScreen({ error, onSignOut }) {
  const isMissingBusiness = error === 'NO_BUSINESS'
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-4">
        <h1 className="font-display text-lg font-semibold">
          {isMissingBusiness ? "We can't find a business on this account" : 'Something went wrong'}
        </h1>
        <p className="text-sm text-muted">
          {isMissingBusiness
            ? "This usually happens if you signed up but didn't finish confirming your email before trying to log in. Check your inbox for a confirmation link, then sign in again — or sign up again with the same email if you've already confirmed."
            : `We couldn't load your business: ${error}. Check your connection and try signing in again.`}
        </p>
        <button onClick={onSignOut} className="btn-primary w-full">
          Sign out and try again
        </button>
      </div>
    </div>
  )
}

function Restricted({ path, children }) {
  const { activeStaff } = useAuth()
  if (path === '/staff' && !activeStaff) return children
  if (canAccess(path, activeStaff)) return children
  return <Navigate to="/" replace state={{ blockedFrom: path }} />
}

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Gate>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<Restricted path="/products"><Products /></Restricted>} />
              <Route path="/stock-in" element={<Restricted path="/stock-in"><StockIn /></Restricted>} />
              <Route path="/sell" element={<Restricted path="/sell"><Sell /></Restricted>} />
              <Route path="/sales" element={<Restricted path="/sales"><Sales /></Restricted>} />
              <Route path="/customers" element={<Restricted path="/customers"><Customers /></Restricted>} />
              <Route path="/lenders" element={<Restricted path="/lenders"><Lenders /></Restricted>} />
              <Route path="/expenses" element={<Restricted path="/expenses"><Expenses /></Restricted>} />
              <Route path="/staff" element={<Restricted path="/staff"><Staff /></Restricted>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Gate>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  )
}