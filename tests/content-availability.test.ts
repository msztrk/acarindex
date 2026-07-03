import { describe, expect, it } from 'vitest'
import {
  hasEnglishArticleContent,
  hasEnglishJournalContent,
  getAvailableLocales,
  computeArticleHasEnContent,
} from '@/lib/i18n/content-availability'
import { buildArticleMetadataAlternates } from '@/lib/seo/hreflang'

const base = 'https://www.acarindex.com'

describe('hasEnglishArticleContent', () => {
  it('accepts English title + abstract', () => {
    expect(
      hasEnglishArticleContent({
        titleEn: 'National Struggle in Turkey',
        abstractEn: 'This paper examines the national struggle period in detail.',
      }),
    ).toBe(true)
  })

  it('rejects title-only without abstract unless language is en', () => {
    expect(
      hasEnglishArticleContent({
        titleEn: 'Short Title Only Here',
        abstractEn: null,
        language: 'tr',
      }),
    ).toBe(false)
  })

  it('rejects fully empty English fields', () => {
    expect(
      hasEnglishArticleContent({
        titleEn: null,
        abstractEn: null,
        language: 'tr',
      }),
    ).toBe(false)
  })

  it('accepts slug_en fallback row when language is en', () => {
    expect(
      hasEnglishArticleContent({
        titleEn: 'English Article Title Here',
        abstractEn: null,
        language: 'en',
      }),
    ).toBe(true)
  })

  it('accepts English document with Turkish fields empty', () => {
    expect(
      hasEnglishArticleContent({
        titleEn: 'Fully English Article Title',
        abstractEn: 'A sufficiently long English abstract for indexing.',
        titleTr: null,
        abstractTr: null,
        language: 'en',
      }),
    ).toBe(true)
  })

  it('accepts bilingual article with both locales available', () => {
    const article = {
      titleTr: 'Milli Mücadele Dönemi',
      titleEn: 'National Struggle Period',
      abstractTr: 'Türkçe özet metni yeterince uzun bir açıklama içerir.',
      abstractEn: 'English abstract with enough characters for indexing.',
      language: 'tr',
    }
    expect(hasEnglishArticleContent(article)).toBe(true)
    expect(getAvailableLocales(article, 'article')).toContain('en')
    expect(getAvailableLocales(article, 'article')).toContain('tr')
  })
})

describe('hreflang metadata', () => {
  const row = {
    id: 1,
    slug: 'foo',
    slugTr: 'foo-tr',
    slugEn: 'foo-en',
    legacyJournalSlug: 'journal-tr',
    legacyJournalSlugEn: 'journal-en',
    titleEn: 'English Title Long Enough',
    abstractEn: 'English abstract content that is long enough for SEO rules.',
    hasEnContent: true,
  }

  it('includes en hreflang when English content exists', () => {
    const alt = buildArticleMetadataAlternates(base, row, 'tr')
    expect(alt.languages?.en).toBeTruthy()
    expect(alt.languages?.tr).toBeTruthy()
    expect(alt.languages?.['x-default']).toBe(alt.languages?.tr)
  })

  it('omits en hreflang when only slug fallback exists', () => {
    const alt = buildArticleMetadataAlternates(
      base,
      {
        ...row,
        hasEnContent: false,
        titleEn: 'Same As Turkish',
        abstractEn: null,
        language: 'tr',
      },
      'tr',
    )
    expect(alt.languages?.en).toBeUndefined()
  })
})

describe('hasEnglishJournalContent', () => {
  it('requires meaningful English title', () => {
    expect(hasEnglishJournalContent({ titleEn: 'Journal of Turkish Studies' })).toBe(true)
    expect(hasEnglishJournalContent({ titleEn: 'Short' })).toBe(false)
  })
})

describe('computeArticleHasEnContent', () => {
  it('matches hasEnglishArticleContent', () => {
    const fields = {
      titleEn: 'Title Here OK',
      abstractEn: 'Abstract long enough for validation checks.',
    }
    expect(computeArticleHasEnContent(fields)).toBe(hasEnglishArticleContent(fields))
  })
})
