// PIN hashing using browser built-in Web Crypto API — no packages needed.
// Uses SHA-256 with the staff member's ID as a per-user salt so two staff
// with the same PIN produce different hashes.

export async function hashPin(pin, staffId) {
    const encoder = new TextEncoder()
    const data = encoder.encode(pin + ':' + staffId + ':stocktracer')
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// A hashed PIN is 64 hex chars; a plain PIN is 4 digits
export function isHashed(pin) {
    return pin && pin.length === 64
}