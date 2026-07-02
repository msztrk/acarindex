import { describe, expect, it } from 'vitest'
import { interestCategoryIds } from '@/lib/personalization/interest-categories'

describe('interestCategoryIds', () => {
  it('returns ids in order', () => {
    expect(
      interestCategoryIds([
        { id: 3, label: 'Sağlık Bilimleri' },
        { id: 1, label: 'Ekonomi' },
      ]),
    ).toEqual([3, 1])
  })
})
