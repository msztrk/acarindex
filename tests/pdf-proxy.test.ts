/**
 * PDF Proxy güvenlik testleri
 * - buildLegacyPdfUrl: genişletilmiş edge case testleri
 * - PDF proxy domain whitelist mantığı
 */

import { describe, it, expect } from 'vitest'
import { buildLegacyPdfUrl, hasPdf } from '../lib/pdf/legacy-url'

// ─── buildLegacyPdfUrl genişletilmiş ─────────────────────────────────────────
describe('buildLegacyPdfUrl — edge cases', () => {
  it('relative path başında slash olmadan', () => {
    expect(buildLegacyPdfUrl('dosyalar/makale.pdf')).toBe(
      'https://www.acarindex.com/dosyalar/makale.pdf',
    )
  })

  it('relative path başında birden fazla slash', () => {
    expect(buildLegacyPdfUrl('//dosyalar/makale.pdf')).toBe(
      'https://www.acarindex.com/dosyalar/makale.pdf',
    )
  })

  it('HTTPS URL aynen döner', () => {
    expect(buildLegacyPdfUrl('https://cdn.acarindex.com/file.pdf')).toBe(
      'https://cdn.acarindex.com/file.pdf',
    )
  })

  it('HTTP URL aynen döner', () => {
    expect(buildLegacyPdfUrl('http://www.acarindex.com/old.pdf')).toBe(
      'http://www.acarindex.com/old.pdf',
    )
  })

  it('null → null', () => {
    expect(buildLegacyPdfUrl(null)).toBeNull()
  })

  it('undefined → null', () => {
    expect(buildLegacyPdfUrl(undefined)).toBeNull()
  })

  it('boş string → null', () => {
    expect(buildLegacyPdfUrl('')).toBeNull()
  })

  it('sadece boşluk → null', () => {
    expect(buildLegacyPdfUrl('   ')).toBeNull()
  })

  it("'pdf-bulunamadi' sentinel → null", () => {
    expect(buildLegacyPdfUrl('pdf-bulunamadi')).toBeNull()
  })

  it("boşluk etrafında 'pdf-bulunamadi' sentinel → null", () => {
    expect(buildLegacyPdfUrl('  pdf-bulunamadi  ')).toBeNull()
  })
})

// ─── hasPdf ───────────────────────────────────────────────────────────────────
describe('hasPdf', () => {
  it('geçerli path → true', () => {
    expect(hasPdf('dosyalar/makale.pdf')).toBe(true)
  })

  it('HTTPS URL → true', () => {
    expect(hasPdf('https://www.acarindex.com/file.pdf')).toBe(true)
  })

  it('null → false', () => {
    expect(hasPdf(null)).toBe(false)
  })

  it("sentinel → false", () => {
    expect(hasPdf('pdf-bulunamadi')).toBe(false)
  })

  it('boş string → false', () => {
    expect(hasPdf('')).toBe(false)
  })
})

// ─── Domain whitelist logic (proxy koruması) ──────────────────────────────────
describe('PDF proxy domain whitelist mantığı', () => {
  const ALLOWED_HOSTS = new Set([
    'www.acarindex.com',
    'acarindex.com',
    'cdn.acarindex.com',
  ])

  function isAllowed(url: string): boolean {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
      return ALLOWED_HOSTS.has(parsed.hostname)
    } catch {
      return false
    }
  }

  it('www.acarindex.com geçerli', () => {
    expect(isAllowed('https://www.acarindex.com/pdfs/file.pdf')).toBe(true)
  })

  it('cdn.acarindex.com geçerli', () => {
    expect(isAllowed('https://cdn.acarindex.com/file.pdf')).toBe(true)
  })

  it('dış domain reddedilir', () => {
    expect(isAllowed('https://evil.com/malware.pdf')).toBe(false)
  })

  it('subdomain reddedilir (alt-subdomain)', () => {
    expect(isAllowed('https://sub.evil.acarindex.com/file.pdf')).toBe(false)
  })

  it('file:// protocol reddedilir', () => {
    expect(isAllowed('file:///etc/passwd')).toBe(false)
  })

  it('javascript: protocol reddedilir', () => {
    expect(isAllowed('javascript:alert(1)')).toBe(false)
  })

  it('geçersiz URL reddedilir', () => {
    expect(isAllowed('not a url')).toBe(false)
  })
})
