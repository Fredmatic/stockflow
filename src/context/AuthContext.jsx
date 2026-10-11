import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hashPin } from '../lib/pinHash'
<<<<<<< HEAD
=======
import { setErrorContext } from '../lib/errorLog'
import { readPendingBusiness, clearPendingBusiness } from '../lib/pendingBusiness'
>>>>>>> f61ec8e (new feature)

const AuthContext = createContext(null)

// One owner login can run several businesses. `business` is always the ONE
// the owner is looking at right now — every page already reads `business`, so
// switching business simply swaps what they see, with no per-page changes.
//
// Staff PIN picks are remembered PER business (a barber in the salon is not
// automatically a cashier in the hardware store).
const ACTIVE_BUSINESS_KEY = 'stocktracer_active_business'
const staffKey = (businessId) => `stocktracer_active_staff_${businessId}`

// Should a business added later share the first business's trial/plan?
// true  → one subscription covers all the owner's businesses
// false → every business gets its own fresh trial / plan
const SHARE_SUBSCRIPTION_ACROSS_BUSINESSES = true

function readSavedStaff(businessId) {
  try {
    const raw = sessionStorage.getItem(staffKey(businessId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [businesses, setBusinesses] = useState([])
  const [activeBusinessId, setActiveBusinessId] = useState(() => localStorage.getItem(ACTIVE_BUSINESS_KEY))
  const [businessLoading, setBusinessLoading] = useState(false)
  const [businessError, setBusinessError] = useState(null)
  // Staff picked this session, per business. Missing key = "not loaded yet,
  // fall back to what this browser tab remembered"; null = "signed out of it".
  const [staffByBusiness, setStaffByBusiness] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      // If the stored token is invalid/expired, wipe it and start fresh
      if (error || !data.session) {
        supabase.auth.signOut()
        setSession(null)
      } else {
        setSession(data.session)
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'TOKEN_REFRESHED' && !newSession) {
        // Refresh failed — clear everything so user sees the login page
        supabase.auth.signOut()
        return
      }
      setSession(newSession)
      if (!newSession) {
        setBusinesses([])
        setStaffByBusiness({})
        setActiveBusinessId(null)
        Object.keys(sessionStorage)
          .filter((k) => k.startsWith('stocktracer_active_staff'))
          .forEach((k) => sessionStorage.removeItem(k))
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // Load every business this owner runs.
  const fetchBusinesses = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_auth_id', userId)
      .order('created_at', { ascending: true })
    return { data: data || [], error }
  }, [])

  useEffect(() => {
    if (!session) return
    let cancelled = false

    async function loadBusinesses() {
      setBusinessLoading(true)
      setBusinessError(null)
<<<<<<< HEAD
      const { data, error } = await fetchBusinesses(session.user.id)
=======
      let { data, error } = await fetchBusinesses(session.user.id)
>>>>>>> f61ec8e (new feature)
      if (cancelled) return

      // First sign-in after confirming their email: create the business they
      // described at signup (it could not be saved before they had a session).
      if (!error && data.length === 0) {
        const pending = readPendingBusiness(session.user.email)
        if (pending) {
          const { error: insertError } = await supabase.from('businesses').insert({
            owner_auth_id: session.user.id,
            name: pending.name,
            type: pending.type,
            owner_name: pending.ownerName || null,
          })
          if (!insertError) {
            clearPendingBusiness()
            localStorage.setItem('stocktracer_new_account', '1') // sends them to add their first staff member
            ;({ data, error } = await fetchBusinesses(session.user.id))
            if (cancelled) return
          }
        }
      }

      if (error) {
        // A real failure (network, RLS, etc) — surface it instead of
        // leaving the person stuck on a loading screen forever.
        setBusinessError(error.message)
      } else if (data.length === 0) {
        // The request worked but no business is linked to this account —
        // most commonly the signup email was never confirmed.
        setBusinessError('NO_BUSINESS')
      }
      setBusinesses(data)
      setBusinessLoading(false)
    }

    loadBusinesses()
    return () => {
      cancelled = true
    }
  }, [session, fetchBusinesses])

  // The active business: the remembered one if it still exists, else the first.
  const business = useMemo(
    () => businesses.find((b) => b.id === activeBusinessId) || businesses[0] || null,
    [businesses, activeBusinessId]
  )

  // Who is using the till in the active business — computed during render so
  // there is no one-frame flash of the staff picker when switching business.
  const activeStaff = business
    ? business.id in staffByBusiness
      ? staffByBusiness[business.id]
      : readSavedStaff(business.id)
    : null

<<<<<<< HEAD
=======
  useEffect(() => {
    setErrorContext({ businessId: business?.id })
  }, [business?.id])

>>>>>>> f61ec8e (new feature)
  // Pages call setBusiness(prev => ({...prev, ...changes})) after editing the
  // business. Keep that working: it updates the active business inside the list.
  const setBusiness = useCallback(
    (updater) => {
      setBusinesses((list) =>
        list.map((b) => {
          if (b.id !== business?.id) return b
          const next = typeof updater === 'function' ? updater(b) : updater
          return next || b
        })
      )
    },
    [business?.id]
  )

  function chooseStaff(staff, forBusinessId) {
    const id = forBusinessId || business?.id
    if (!id) return
    sessionStorage.setItem(staffKey(id), JSON.stringify(staff))
    setStaffByBusiness((m) => ({ ...m, [id]: staff }))
  }

  function switchUser() {
    if (!business) return
    sessionStorage.removeItem(staffKey(business.id))
    setStaffByBusiness((m) => ({ ...m, [business.id]: null }))
  }

  // Switch which business the owner is working in.
  function switchBusiness(id) {
    if (!businesses.some((b) => b.id === id)) return
    localStorage.setItem(ACTIVE_BUSINESS_KEY, id)
    setActiveBusinessId(id)
  }

  async function refreshBusinesses() {
    if (!session) return
    const { data } = await fetchBusinesses(session.user.id)
    setBusinesses(data)
  }

  // Add another business under the same login.
  // `pin` becomes the owner's PIN inside the NEW business (PINs are salted
  // per staff member, so an existing PIN cannot simply be copied across).
  async function createBusiness({ name, type, pin }) {
    if (!session) throw new Error('You are signed out.')
    const primary = businesses[0]

    const row = {
      owner_auth_id: session.user.id,
      name: name.trim(),
      type,
      owner_name: business?.owner_name || activeStaff?.name || null,
    }
    if (SHARE_SUBSCRIPTION_ACROSS_BUSINESSES && primary) {
      for (const key of ['plan', 'subscription_status', 'trial_ends_at']) {
        if (primary[key] !== undefined && primary[key] !== null) row[key] = primary[key]
      }
    }

    const { data: created, error } = await supabase.from('businesses').insert(row).select().single()
    if (error) throw error

    // The owner is the first staff member of the new business.
    const staffId = crypto.randomUUID()
    const hashed = await hashPin(pin, staffId)
    const { data: ownerStaff, error: staffError } = await supabase
      .from('staff_users')
      .insert({
        id: staffId,
        business_id: created.id,
        name: activeStaff?.name || business?.owner_name || 'Owner',
        role: 'owner',
        pin: hashed,
      })
      .select()
      .single()
    if (staffError) {
      // Don't leave a business nobody can get into.
      await supabase.from('businesses').delete().eq('id', created.id)
      throw staffError
    }

    sessionStorage.setItem(staffKey(created.id), JSON.stringify(ownerStaff))
    setStaffByBusiness((m) => ({ ...m, [created.id]: ownerStaff }))
    setBusinesses((list) => [...list, created])
    localStorage.setItem(ACTIVE_BUSINESS_KEY, created.id)
    setActiveBusinessId(created.id)
    return created
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        business,
        businesses,
        setBusiness,
        switchBusiness,
        createBusiness,
        refreshBusinesses,
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

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
