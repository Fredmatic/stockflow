// A stand-in for the Supabase client so screens can be tested without a network.
// Set globalThis.__tables = { sales: [...], customers: [...] } before rendering;
// every query on a table (however it is filtered) resolves to that table's rows.
function builder(table) {
  const rows = () => (globalThis.__tables || {})[table] || []
  const result = () => ({ data: rows(), error: null, count: rows().length })
  const b = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return (resolve) => resolve(result())
        if (prop === 'single' || prop === 'maybeSingle') return () => Promise.resolve({ data: rows()[0] || null, error: null })
        if (prop === 'insert' || prop === 'update' || prop === 'delete' || prop === 'upsert') {
          return (...args) => {
            globalThis.__writes = [...(globalThis.__writes || []), { table, op: String(prop), args }]
            return b
          }
        }
        return () => b
      },
    }
  )
  return b
}

export const supabase = {
  from: (table) => builder(table),
  auth: {
    getSession: () => Promise.resolve({ data: { session: globalThis.__session || null } }),
    signOut: () => Promise.resolve(),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
}
