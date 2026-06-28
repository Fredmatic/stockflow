import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
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
import Staff from './pages/Staff'
import Expenses from './pages/Expenses'

function Gate({ children }) {
  const { session, business, activeStaff, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted text-sm">Loading…</div>
  if (!session) return <Login />
  if (!business) return <div className="min-h-screen flex items-center justify-center text-muted text-sm">Setting up your business…</div>
  // Allow reaching the Staff page even before anyone has picked an active
  // staff member — the owner needs this to add their team in the first place.
  if (!activeStaff && location.pathname !== '/staff') return <StaffPicker />
  return children
}
function Restricted({ path, children }) {
  const { activeStaff } = useAuth()
  if (path === '/staff' && !activeStaff) return children
  if (canAccess(path, activeStaff)) return children
  return <Navigate to="/" replace state={{ blockedFrom: path }} />
}

export default function App() {
  return (
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
              <Route path="/expenses" element={<Restricted path="/expenses"><Expenses /></Restricted>} />
              <Route path="/staff" element={<Restricted path="/staff"><Staff /></Restricted>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Gate>
      </BrowserRouter>
    </AuthProvider>
  )
}