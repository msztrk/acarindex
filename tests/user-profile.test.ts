import { describe, expect, it } from 'vitest'
import { validateProfileCategorySelections } from '@/lib/user-panel/profile'

describe('validateProfileCategorySelections', () => {
  const allowed = ['Ekonomi', 'Teknoloji', 'Hukuk Veri Tabanı']

  it('accepts empty selections', () => {
    expect(validateProfileCategorySelections('', [], allowed)).toBe(true)
  })

  it('accepts valid science field and interest areas', () => {
    expect(validateProfileCategorySelections('Ekonomi', ['Teknoloji', 'Hukuk Veri Tabanı'], allowed)).toBe(
      true,
    )
  })

  it('rejects unknown science field', () => {
    expect(validateProfileCategorySelections('Bilinmeyen', [], allowed)).toBe(false)
  })

  it('rejects unknown interest area', () => {
    expect(validateProfileCategorySelections('', ['Bilinmeyen'], allowed)).toBe(false)
  })
})
