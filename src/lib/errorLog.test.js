import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./supabase', async () => await import('../test/mockSupabase.js'))
import { scrub, shouldLog, logError, resetErrorLogForTests, setErrorContext } from './errorLog'

beforeEach(() => {
  resetErrorLogForTests()
  globalThis.__writes = []
  globalThis.__session = { user: { id: 'user-1' } }
})

describe('scrub', () => {
  it('removes tokens and secrets before anything is stored', () => {
    expect(scrub('failed with eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop')).toContain('[token]')
    expect(scrub('pin=1234 and password: hunter2')).not.toMatch(/1234|hunter2/)
  })
})

describe('shouldLog', () => {
  it('ignores the same error repeating within a minute', () => {
    expect(shouldLog('boom', 0)).toBe(true)
    expect(shouldLog('boom', 30_000)).toBe(false)
    expect(shouldLog('boom', 61_000)).toBe(true)
  })
})

describe('logError', () => {
  it('saves a crash with the business it happened in', async () => {
    setErrorContext({ businessId: 'biz-9' })
    await logError(new Error('Cannot read properties of undefined'), { source: 'test' })
    const w = globalThis.__writes.find((x) => x.table === 'client_errors')
    expect(w.args[0]).toMatchObject({ user_id: 'user-1', business_id: 'biz-9', message: 'Cannot read properties of undefined' })
  })
  it('stops after 10 errors in a session so it can never flood the database', async () => {
    for (let i = 0; i < 15; i++) await logError(new Error(`distinct error ${i}`))
    expect(globalThis.__writes.filter((x) => x.table === 'client_errors')).toHaveLength(10)
  })
  it('does nothing when signed out', async () => {
    globalThis.__session = null
    await logError(new Error('x'))
    expect(globalThis.__writes).toHaveLength(0)
  })
  it('never throws, even for strange input', async () => {
    await expect(logError(undefined)).resolves.toBeUndefined()
    await expect(logError({ weird: true })).resolves.toBeUndefined()
  })
})
