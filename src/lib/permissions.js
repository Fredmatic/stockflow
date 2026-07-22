// Single source of truth for who can see/use which page.
// The Supabase Auth session belongs to the *business*, not to whoever is
// standing at the device right now — the owner often stays signed in on a
// shared till all day while different staff/cashiers tap their own name and
// PIN. So the only honest signal for "who is using the app right now" is
// activeStaff.role, picked on the StaffPicker screen.

export const ROUTE_ACCESS = {
  '/dashboard': ['owner', 'staff', 'cashier'],
  '/products': ['owner', 'staff'],
  '/stock-in': ['owner', 'staff'],
  '/sell': ['owner', 'staff', 'cashier'],
  '/sales': ['owner', 'staff'],
  '/customers': ['owner', 'staff'],
  '/lenders': ['owner'],
  '/expenses': ['owner'],
  '/spending': ['owner'],
  '/staff': ['owner'],
  '/reports': ['owner'],
  '/reminders': ['owner'],
}

export function canAccess(path, activeStaff) {
  const role = activeStaff?.role || null
  const allowed = ROUTE_ACCESS[path]
  if (!allowed) return true // unknown routes aren't restricted here
  return role ? allowed.includes(role) : false
}