import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase env vars. Copy .env.example to .env and fill in your project URL and anon key.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

// Automatically clear a dead/invalid token so the user gets sent back
// to the login page cleanly instead of being stuck in a broken state.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' && !session) {
    supabase.auth.signOut()
  }
  if (event === 'SIGNED_OUT') {
    localStorage.removeItem(`sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`)
  }
})