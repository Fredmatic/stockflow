import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [business, setBusiness] = useState(null)
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
        sessionStorage.removeItem('stockflow_active_staff')
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Once logged in, load this owner's business and restore the
  // active staff/cashier pick from this browser tab's session.
  useEffect(() => {
    if (!session) return
    supabase
      .from('businesses')
      .select('*')
      .eq('owner_auth_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setBusiness(data)
      })
    const saved = sessionStorage.getItem('stockflow_active_staff')
    if (saved) setActiveStaff(JSON.parse(saved))
  }, [session])

  function chooseStaff(staff) {
    setActiveStaff(staff)
    sessionStorage.setItem('stockflow_active_staff', JSON.stringify(staff))
  }

  function switchUser() {
    setActiveStaff(null)
    sessionStorage.removeItem('stockflow_active_staff')
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ session, business, setBusiness, activeStaff, chooseStaff, switchUser, signOut, loading }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
