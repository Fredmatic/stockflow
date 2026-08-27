// src/lib/planFeatures.js
//
// Single source of truth for what each plan includes. Keep this in sync
// with the PLANS array in src/pages/Landing.jsx — if you change pricing or
// feature lists there, mirror the change here too.

export const PLAN_LIMITS = {
    starter: { staff: 3, products: 500 },
    pro: { staff: Infinity, products: Infinity },
}

// Features that are fully Pro-only (Starter sees them locked, not hidden).
export const PRO_ONLY_FEATURES = {
    expenses: 'Expense management',
    fullReports: 'Full profit reports',
    customerCredit: 'Customer credit tracking',
}

export function isPro(business) {
    return business?.plan === 'pro'
}

export function planLimits(business) {
    return PLAN_LIMITS[business?.plan] || PLAN_LIMITS.starter
}

// Returns { atLimit, remaining, limit } for a countable resource (staff, products).
export function checkLimit(business, resource, currentCount) {
    const limit = planLimits(business)[resource]
    if (limit === Infinity) return { atLimit: false, remaining: Infinity, limit }
    return { atLimit: currentCount >= limit, remaining: Math.max(0, limit - currentCount), limit }
}