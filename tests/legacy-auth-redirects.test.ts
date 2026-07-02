import { describe, expect, it } from 'vitest'
import {
  isAppReservedPath,
  resolveLegacyAuthRedirect,
  resolveReservedJournalSlugRedirect,
} from '@/lib/seo/legacy-auth-redirects'

describe('legacy auth redirects', () => {
  it('maps Turkish auth URLs', () => {
    expect(resolveLegacyAuthRedirect('/giris')).toBe('/login')
    expect(resolveLegacyAuthRedirect('/kayit')).toBe('/register')
    expect(resolveLegacyAuthRedirect('/nreg')).toBe('/register')
  })

  it('maps legacy profil panel URLs to hesabim', () => {
    expect(resolveLegacyAuthRedirect('/profil')).toBe('/hesabim')
    expect(resolveLegacyAuthRedirect('/profil/ayarlar')).toBe('/hesabim')
    expect(resolveLegacyAuthRedirect('/profil/favoriler')).toBe('/hesabim/kaydedilen')
    expect(resolveLegacyAuthRedirect('/profil/accsess')).toBe('/hesabim/security')
    expect(resolveLegacyAuthRedirect('/profil/unknown-section')).toBe('/hesabim')
  })

  it('protects app routes from url_aliases lookup', () => {
    expect(isAppReservedPath('/hesabim')).toBe(true)
    expect(isAppReservedPath('/hesabim/kaydedilen')).toBe(true)
    expect(isAppReservedPath('/login')).toBe(true)
    expect(isAppReservedPath('/search')).toBe(true)
    expect(isAppReservedPath('/journals/foo-1')).toBe(false)
  })

  it('redirects reserved journal slugs away from article catch-all', () => {
    expect(resolveReservedJournalSlugRedirect('hesabim')).toBe('/hesabim')
    expect(resolveReservedJournalSlugRedirect('profil')).toBe('/hesabim')
    expect(resolveReservedJournalSlugRedirect('giris')).toBe('/login')
    expect(resolveReservedJournalSlugRedirect('turkish-studies')).toBeNull()
  })
})
