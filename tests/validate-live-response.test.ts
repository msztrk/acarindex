import { describe, expect, it } from 'vitest'
import {
  parseSoftRedirect,
  validateHttpRedirectToTr,
  validateSoft404,
  validateSoftRedirectToTr,
  hasAnySoftRedirect,
} from '@/lib/i18n/validate-live-response'

describe('validate-live-response', () => {
  const trPath = '/bilig/kavimler-koprusu-aras-24918'
  const enPath = '/en/bilig/kavimler-koprusu-aras-24918'

  it('parseSoftRedirect extracts target and status', () => {
    const body = 'xNEXT_REDIRECT;replace;/bilig/foo;307;y'
    expect(parseSoftRedirect(body)).toEqual({
      kind: 'replace',
      targetPath: '/bilig/foo',
      statusCode: 307,
    })
  })

  it('rejects body that only mentions NEXT_REDIRECT without digest', () => {
    expect(parseSoftRedirect('NEXT_REDIRECT is a word')).toBeNull()
    expect(validateSoftRedirectToTr('NEXT_REDIRECT is a word', enPath, trPath)).toBe(false)
  })

  it('validateSoftRedirectToTr requires exact TR path and no /en/', () => {
    const okBody = `digest":"NEXT_REDIRECT;replace;${trPath};307;"`
    expect(validateSoftRedirectToTr(okBody, enPath, trPath)).toBe(true)
    expect(validateSoftRedirectToTr(okBody, enPath, '/other/path')).toBe(false)
    const enTarget = `NEXT_REDIRECT;replace;/en/bilig/foo;307;`
    expect(validateSoftRedirectToTr(enTarget, enPath, trPath)).toBe(false)
  })

  it('validateHttpRedirectToTr checks Location header', () => {
    expect(validateHttpRedirectToTr(307, trPath, trPath, enPath)).toBe(true)
    expect(validateHttpRedirectToTr(200, trPath, trPath, enPath)).toBe(false)
    expect(validateHttpRedirectToTr(307, enPath, trPath, enPath)).toBe(false)
  })

  it('validateSoft404 requires digest and not-found marker', () => {
    const ok = 'NEXT_HTTP_ERROR_FALLBACK;404"Makale bulunamadı'
    expect(validateSoft404(ok)).toBe(true)
    expect(validateSoft404('HTTP 200 generic homepage')).toBe(false)
    expect(validateSoft404('NEXT_HTTP_ERROR_FALLBACK;404')).toBe(false)
  })

  it('hasAnySoftRedirect is false for generic 200 HTML', () => {
    expect(hasAnySoftRedirect('<html><body>Hello</body></html>')).toBe(false)
  })
})
