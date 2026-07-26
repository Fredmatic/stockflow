// src/components/PlanLimitBanner.jsx
//
// For countable limits (3 staff / 500 products on Starter) rather than
// fully-locked features. Shows a banner once someone hits their cap, and
// you disable the "Add" button using the same checkLimit() result.
//
// Usage in e.g. Staff.jsx:
//   const { atLimit, remaining, limit } = checkLimit(business, 'staff', staffList.length)
//   <PlanLimitBanner resource="staff members" atLimit={atLimit} limit={limit} />
//   <button disabled={atLimit} onClick={openAddStaffForm}>Add staff</button>

const WA_NUMBER = '256740193837'

export default function PlanLimitBanner({ resource, atLimit, limit, businessName }) {
    if (!atLimit || limit === Infinity) return null

    const waText = `Hi, I've hit the Starter plan limit of ${limit} ${resource} for "${businessName}" and I'd like to upgrade to Pro.`

    return (
        <div className="mb-4 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-700 rounded-md px-4 py-2 text-sm font-medium">
            <span>🔒</span>
            <span>
                You've reached the Starter plan limit of {limit} {resource}.
            </span>
            <a
                href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto underline text-xs shrink-0"
            >
                Upgrade to Pro
            </a>
        </div>
    )
}