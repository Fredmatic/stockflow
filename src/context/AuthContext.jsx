import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [business, setBusiness] = useState(null)
  const [businessLoading, setBusinessLoading] = useState(false)
  const [businessError, setBusinessError] = useState(null)
  const [activeStaff, setActiveStaff] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (!newSession) {
        setBusiness(null)
        setActiveStaff(null)
        sessionStorage.removeItem('stocktracer_active_staff')
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Once logged in, load this owner's business and restore the
  // active staff/cashier pick from this browser tab's session.
  useEffect(() => {
    if (!session) return
    let cancelled = false

    async function loadBusiness() {
      setBusinessLoading(true)
      setBusinessError(null)
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_auth_id', session.user.id)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        // A real failure (network, RLS, etc) — surface it instead of
        // leaving the person stuck on a loading screen forever.
        setBusinessError(error.message)
      } else if (!data) {
        // The request succeeded but no business is linked to this
        // account — most commonly because signup's email confirmation
        // step was never completed, so the business row never got
        // created. Distinct from a real error: nothing is broken, the
        // person just needs to finish setting up.
        setBusinessError('NO_BUSINESS')
      }
      setBusiness(data)
      setBusinessLoading(false)
    }

    loadBusiness()
    const saved = sessionStorage.getItem('stocktracer_active_staff')
    if (saved) setActiveStaff(JSON.parse(saved))

    return () => {
      cancelled = true
    }
  }, [session])

  function chooseStaff(staff) {
    setActiveStaff(staff)
    sessionStorage.setItem('stocktracer_active_staff', JSON.stringify(staff))
  }

  function switchUser() {
    setActiveStaff(null)
    sessionStorage.removeItem('stocktracer_active_staff')
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        business,
        setBusiness,
        businessLoading,
        businessError,
        activeStaff,
        chooseStaff,
        switchUser,
        signOut,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
