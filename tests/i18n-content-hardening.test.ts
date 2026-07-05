import { describe, expect, it } from 'vitest'
import {
  computeArticleHasEnglishContent,
  computeJournalHasEnglishContent,
  hasEnglishArticleContent,
} from '@/lib/i18n/content-availability'
import {
  assessEnglishArticleContentQuality,
  isPossibleEnglishFallback,
} from '@/lib/i18n/content-quality'
import {
  shouldRedirectEnArticleToTr,
  shouldRedirectEnJournalToTr,
} from '@/lib/i18n/en-route-guard'
import {
  isEnglishLanguage,
  isTurkishLanguage,
  normalizeLanguageCode,
} from '@/lib/i18n/language'
import { pickLocalizedAbstract, pickLocalizedJournalDescription, buildArticleAbstractSections, pickAlternateTitle } from '@/lib/i18n/pick-localized-text'
import { buildArticlePath } from '@/lib/i18n/slugs'
import {
  computeEnSitemapPageCount,
  isBeyondEnSitemapPages,
} from '@/lib/i18n/sitemap-en'
import {
  hasMeaningfulText,
  isPunctuationOnly,
} from '@/lib/i18n/text-normalization'
import { buildArticleMetadataAlternates } from '@/lib/seo/hreflang'
import { buildArticleUrl } from '@/lib/urls/article'
import { buildPdfViewerUrl } from '@/lib/pdf/legacy-url'
import { publishedEnglishArticleWhere } from '@/lib/i18n/prisma-english-content'

const base = 'https://www.acarindex.com'

describe('language normalization', () => {
  it.each(['en', 'EN', 'eng', 'English', 'en-US'])(
    'treats %s as English',
    (value) => {
      expect(normalizeLanguageCode(value)).toBe('en')
      expect(isEnglishLanguage(value)).toBe(true)
    },
  )

  it.each(['tr', 'TR', 'tur', 'turkish', 'türkçe', 'tr-TR'])(
    'treats %s as Turkish',
    (value) => {
      expect(normalizeLanguageCode(value)).toBe('tr')
      expect(isTurkishLanguage(value)).toBe(true)
    },
  )
})

describe('text normalization', () => {
  it('rejects html-only abstract', () => {
    expect(hasMeaningfulText('<p><br></p>', 20)).toBe(false)
  })

  it('rejects nbsp-only text', () => {
    expect(hasMeaningfulText('<div>&nbsp;</div>', 10)).toBe(false)
  })

  it('rejects punctuation-only text', () => {
    expect(isPunctuationOnly('---')).toBe(true)
    expect(hasMeaningfulText('<p>---</p>', 10)).toBe(false)
  })
})

describe('English article content rules', () => {
  it('accepts title + real abstract', () => {
    expect(
      hasEnglishArticleContent({
        titleEn: 'National Struggle Period',
        abstractEn: 'This paper examines the national struggle in sufficient detail.',
      }),
    ).toBe(true)
  })

  it('accepts title + English language without abstract', () => {
    expect(
      hasEnglishArticleContent({
        titleEn: 'English Article Title Here',
        abstractEn: null,
        language: 'en-US',
      }),
    ).toBe(true)
  })

  it('rejects title-only when language is Turkish', () => {
    expect(
      hasEnglishArticleContent({
        titleEn: 'English Title Long Enough',
        abstractEn: null,
        language: 'tr',
      }),
    ).toBe(false)
  })
})

describe('slug_en = slug_tr with real EN content', () => {
  const row = {
    id: 42,
    slug: 'shared-slug',
    slugTr: 'shared-slug',
    slugEn: 'shared-slug',
    legacyJournalSlug: 'journal-tr',
    legacyJournalSlugEn: 'journal-en',
    titleEn: 'English Article Title Here',
    abstractEn: 'English abstract with enough characters for indexing rules.',
    hasEnContent: true,
  }

  it('builds EN path and allows EN locale', () => {
    expect(buildArticlePath(row, 'en')).toBe('/en/journal-en/shared-slug-42')
    expect(shouldRedirectEnArticleToTr('en', row)).toBe(false)
  })
})

describe('EN route guard', () => {
  const articleRow = {
    id: 99,
    slug: 'foo',
    slugTr: 'foo',
    slugEn: 'foo-en',
    legacyJournalSlug: 'j-tr',
    legacyJournalSlugEn: 'j-en',
  }

  it('redirects EN URL when slug_en exists but no EN content', () => {
    expect(
      shouldRedirectEnArticleToTr('en', {
        ...articleRow,
        has_en_content: false,
        titleEn: 'Short',
        abstractEn: null,
        language: 'tr',
      }),
    ).toBe(true)
  })

  it('does not redirect TR locale', () => {
    expect(
      shouldRedirectEnArticleToTr('tr', {
        has_en_content: false,
        titleEn: null,
        abstractEn: null,
        language: 'tr',
      }),
    ).toBe(false)
  })

  it('missing article is handled at page layer (404), not redirect guard', () => {
    expect(shouldRedirectEnArticleToTr('en', { has_en_content: false })).toBe(true)
  })
})

describe('has_en_content recompute', () => {
  it('becomes true when EN content is added', () => {
    const before = computeArticleHasEnglishContent({
      titleEn: 'Title Long Enough',
      abstractEn: null,
      language: 'tr',
    })
    const after = computeArticleHasEnglishContent({
      titleEn: 'Title Long Enough',
      abstractEn: 'A sufficiently long English abstract for indexing.',
      language: 'tr',
    })
    expect(before).toBe(false)
    expect(after).toBe(true)
  })

  it('becomes false when EN abstract is removed and language is TR', () => {
    const before = computeArticleHasEnglishContent({
      titleEn: 'Title Long Enough',
      abstractEn: 'A sufficiently long English abstract for indexing.',
      language: 'tr',
    })
    const after = computeArticleHasEnglishContent({
      titleEn: 'Title Long Enough',
      abstractEn: null,
      language: 'tr',
    })
    expect(before).toBe(true)
    expect(after).toBe(false)
  })
})

describe('canonical and hreflang parity', () => {
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

  it('TR page canonical and hreflang', () => {
    const alt = buildArticleMetadataAlternates(base, row, 'tr')
    expect(alt.canonical).toBe(`${base}/journal-tr/foo-tr-1`)
    expect(alt.languages?.tr).toBe(`${base}/journal-tr/foo-tr-1`)
    expect(alt.languages?.en).toBe(`${base}/en/journal-en/foo-en-1`)
    expect(alt.languages?.['x-default']).toBe(alt.languages?.tr)
  })

  it('EN page canonical and hreflang', () => {
    const alt = buildArticleMetadataAlternates(base, row, 'en')
    expect(alt.canonical).toBe(`${base}/en/journal-en/foo-en-1`)
    expect(alt.languages?.tr).toBe(`${base}/journal-tr/foo-tr-1`)
    expect(alt.languages?.en).toBe(`${base}/en/journal-en/foo-en-1`)
  })

  it('omits en hreflang without EN content', () => {
    const alt = buildArticleMetadataAlternates(
      base,
      { ...row, hasEnContent: false, titleEn: 'x', abstractEn: null, language: 'tr' },
      'tr',
    )
    expect(alt.languages?.en).toBeUndefined()
    expect(alt.languages?.['x-default']).toBe(alt.languages?.tr)
  })
})

describe('EN sitemap eligibility', () => {
  it('excludes articles without has_en_content', () => {
    expect(publishedEnglishArticleWhere.hasEnContent).toBe(true)
    expect(
      hasEnglishArticleContent({
        titleEn: 'Short',
        abstractEn: null,
        language: 'tr',
      }),
    ).toBe(false)
  })

  it('computes page count without empty trailing page', () => {
    expect(computeEnSitemapPageCount(381605)).toBe(77)
    expect(isBeyondEnSitemapPages(78, 381605)).toBe(true)
    expect(isBeyondEnSitemapPages(77, 381605)).toBe(false)
  })
})

describe('html lang and localized metadata', () => {
  it('pickLocalizedAbstract avoids TR fallback on EN pages', () => {
    expect(
      pickLocalizedAbstract('Türkçe özet metni yeterince uzundur.', null, 'en'),
    ).toBeUndefined()
    expect(
      pickLocalizedAbstract(
        'Türkçe özet',
        'English abstract with enough characters for metadata.',
        'en',
      ),
    ).toBe('English abstract with enough characters for metadata.')
  })

  it('pickLocalizedJournalDescription hides TR description on EN', () => {
    expect(pickLocalizedJournalDescription('Türkçe dergi açıklaması', 'en')).toBeUndefined()
    expect(pickLocalizedJournalDescription('Türkçe dergi açıklaması', 'tr')).toBe(
      'Türkçe dergi açıklaması',
    )
  })

  it('buildArticleAbstractSections puts English abstract first on EN pages', () => {
    expect(
      buildArticleAbstractSections(
        'Türkçe özet metni burada yer alır.',
        'English abstract text appears here.',
        'en',
      ).map((section) => section.heading),
    ).toEqual(['Abstract', 'Özet'])
  })

  it('pickAlternateTitle returns Turkish subtitle on EN pages', () => {
    expect(
      pickAlternateTitle(
        'Türkçe Başlık',
        'English Title',
        'en',
        'English Title',
      ),
    ).toBe('Türkçe Başlık')
  })

  it('journal EN index requires title_en', () => {
    expect(computeJournalHasEnglishContent({ titleEn: 'Journal of Turkish Studies' })).toBe(true)
    expect(shouldRedirectEnJournalToTr('en', { titleEn: 'Short' })).toBe(true)
  })
})

describe('TR URLs and PDF paths unchanged', () => {
  it('keeps TR article URL pattern', () => {
    expect(buildArticleUrl('turkish-studies', 'Milli Mücadele', 809939)).toBe(
      '/turkish-studies/milli-mucadele-809939',
    )
  })

  it('keeps PDF viewer path', () => {
    expect(buildPdfViewerUrl(809939)).toBe('/pdfs/809939')
  })
})

describe('possible_fallback quality metric', () => {
  it('flags identical TR/EN text when language is not English', () => {
    const article = {
      titleTr: 'Same Title Here OK',
      titleEn: 'Same Title Here OK',
      abstractTr: 'Identical abstract text long enough for comparison checks.',
      abstractEn: 'Identical abstract text long enough for comparison checks.',
      language: 'tr',
    }
    expect(assessEnglishArticleContentQuality(article)).toBe('possible_fallback')
    expect(isPossibleEnglishFallback(article)).toBe(true)
    expect(hasEnglishArticleContent(article)).toBe(true)
  })
})
