import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HOME_HERO_TITLE,
  sanitizePlainText,
  validateHomeHeroInput,
} from '@/lib/site-content/home-hero'

describe('home hero site content', () => {
  it('uses default title when empty', () => {
    const result = validateHomeHeroInput({ title: '', subtitle: null })
    expect(result.title).toBe(DEFAULT_HOME_HERO_TITLE)
    expect(result.subtitle).toBeNull()
  })

  it('rejects HTML in title', () => {
    expect(() => validateHomeHeroInput({ title: '<b>x</b>' })).toThrow(/HTML/)
  })

  it('accepts plain subtitle', () => {
    const result = validateHomeHeroInput({
      title: 'Özel başlık',
      subtitle: 'Kısa açıklama',
    })
    expect(result.title).toBe('Özel başlık')
    expect(result.subtitle).toBe('Kısa açıklama')
  })

  it('sanitizes control characters', () => {
    expect(sanitizePlainText('  Merhaba  ', 50)).toBe('Merhaba')
  })
})

describe('public session helpers', () => {
  it('builds initials from name', async () => {
    const { initialsFromUser, displayNameFromUser } = await import('@/lib/auth/public-session')
    expect(initialsFromUser({ email: 'a@b.com', name: 'Ali Veli' })).toBe('AV')
    expect(displayNameFromUser({ email: 'test@acar.com', name: null })).toBe('test')
  })
})
