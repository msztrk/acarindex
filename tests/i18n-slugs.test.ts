import { describe, expect, it } from 'vitest'
import { parseLocaleFromPathname, withLocalePath } from '@/lib/i18n/locale'
import { buildArticlePath, buildJournalCatalogPath } from '@/lib/i18n/slugs'

describe('parseLocaleFromPathname', () => {
  it('detects EN prefix', () => {
    expect(parseLocaleFromPathname('/en/journals/foo-1')).toEqual({
      locale: 'en',
      pathnameWithoutLocale: '/journals/foo-1',
    })
  })

  it('defaults to TR', () => {
    expect(parseLocaleFromPathname('/journals/foo-1').locale).toBe('tr')
  })
})

describe('localized paths', () => {
  const article = {
    id: 809939,
    slug: 'milli-mucadele',
    slugTr: 'milli-mucadele',
    slugEn: 'national-struggle',
    legacyJournalSlug: 'turkish-studies',
    legacyJournalSlugEn: 'turkish-studies-en',
    titleEn: 'National Struggle',
  }

  it('builds TR article path', () => {
    expect(buildArticlePath(article, 'tr')).toBe(
      '/turkish-studies/milli-mucadele-809939',
    )
  })

  it('builds EN article path', () => {
    expect(buildArticlePath(article, 'en')).toBe(
      '/en/turkish-studies-en/national-struggle-809939',
    )
  })

  it('builds journal paths', () => {
    const journal = { id: 101, slug: 'foo', slugTr: 'foo', slugEn: 'foo-en' }
    expect(buildJournalCatalogPath(journal, 'tr')).toBe('/journals/foo-101')
    expect(buildJournalCatalogPath(journal, 'en')).toBe('/en/journals/foo-en-101')
    expect(withLocalePath('/search', 'en')).toBe('/en/search')
  })
})
