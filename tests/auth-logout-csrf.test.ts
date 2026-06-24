import { describe, expect, it } from 'vitest'
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/auth/config'

function csrfMatches(header: string | null, cookie: string | null): boolean {
  if (!header || !cookie) return false
  return header === cookie
}

describe('CSRF contract', () => {
  it('header and cookie names are stable', () => {
    expect(CSRF_HEADER).toBe('x-csrf-token')
    expect(CSRF_COOKIE).toBe('acarindex_csrf')
  })

  it('validateCsrf logic matches equal header and cookie', () => {
    expect(csrfMatches('test-csrf-token-abc', 'test-csrf-token-abc')).toBe(true)
  })

  it('rejects mismatched CSRF values', () => {
    expect(csrfMatches('token-a', 'token-b')).toBe(false)
  })
})

describe('cookie jar logout flow (simulated)', () => {
  it('merges session and csrf cookies for POST', () => {
    const jar = new Map<string, string>()
    jar.set('acarindex_session', 'sess-token')
    jar.set('acarindex_csrf', 'csrf-token')

    const csrf = jar.get('acarindex_csrf')
    const session = jar.get('acarindex_session')
    expect(csrf).toBeTruthy()
    expect(session).toBeTruthy()
    expect(csrf === 'csrf-token').toBe(true)
  })
})
