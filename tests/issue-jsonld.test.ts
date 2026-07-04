import { describe, expect, it } from 'vitest'
import { buildIssuePageJsonLd } from '../lib/seo/issue-jsonld'
import type { Article, Issue, Journal } from '../types/database'

const canonicalBase = 'https://www.acarindex.com'
const journalSegment = 'ankara-universitesi-sbf-dergisi-91'

function baseJournal(overrides: Partial<Journal> = {}): Journal {
  return {
    id: 91,
    legacy_id: 91,
    slug: 'ankara-universitesi-sbf-dergisi',
    slug_tr: 'ankara-universitesi-sbf-dergisi',
    slug_en: null,
    has_en_content: false,
    title_tr: 'Ankara Üniversitesi SBF Dergisi',
    title_en: null,
    old_name: null,
    issn: '1303-4259',
    eissn: null,
    publisher: null,
    frequency: null,
    start_year: null,
    publication_format: null,
    publish_language: null,
    subject_category: null,
    topics: null,
    editor_in_chief: null,
    editorial_board: null,
    colophon: null,
    description: null,
    about: null,
    aim_and_scope: null,
    policy: null,
    writing_rules: null,
    price_policy: null,
    indexes_text: null,
    years_indexed: null,
    contact_text: null,
    contact_json: null,
    cover_path: null,
    legacy_link: null,
    category_id: null,
    status: 'published',
    hit_count: 0,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function baseIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 2155,
    legacy_id: 2155,
    journal_id: 91,
    year: 1997,
    issue_number: 'Cilt: 52 - Sayı: 01',
    volume: null,
    issue_label: '1997 / Sayı Cilt: 52 - Sayı: 01',
    dergipark_issue_id: null,
    status: 'published',
    hit_count: 0,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function makeArticle(id: number, title: string, slug: string): Partial<Article> {
  return {
    id,
    slug,
    legacy_journal_slug: 'ankara-universitesi-sbf-dergisi',
    title_tr: title,
    title_en: null,
    authors_raw: null,
    page_start: id,
    page_end: id + 1,
    published_year: 1997,
  }
}

function graphNodes(jsonLd: Record<string, unknown>): Record<string, unknown>[] {
  return (jsonLd['@graph'] as Record<string, unknown>[]) ?? []
}

function findByType(jsonLd: Record<string, unknown>, type: string): Record<string, unknown> | undefined {
  return graphNodes(jsonLd).find((node) => node['@type'] === type)
}

function hasNullishValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (Array.isArray(value)) return value.some(hasNullishValue)
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).some(hasNullishValue)
  return false
}

describe('buildIssuePageJsonLd', () => {
  it('45 makaleli sayı için ItemList ve ScholarlyArticle üretir', () => {
    const articles = Array.from({ length: 45 }, (_, i) =>
      makeArticle(1000 + i, `Makale ${i + 1}`, `makale-${i + 1}`),
    )
    const jsonLd = buildIssuePageJsonLd({
      canonicalBase,
      journalSegment,
      journal: baseJournal(),
      issue: baseIssue(),
      articles,
      pageTitle: 'Ankara Üniversitesi SBF Dergisi — Cilt 52, Sayı 01 (1997)',
      description: 'Ankara Üniversitesi SBF Dergisi, Cilt 52 Sayı 01 (1997) içinde yayımlanan 45 akademik makaleyi inceleyin.',
    })

    const issueNode = findByType(jsonLd, 'PublicationIssue')
    const itemList = findByType(jsonLd, 'ItemList')
    const scholarly = graphNodes(jsonLd).filter((node) => node['@type'] === 'ScholarlyArticle')

    expect(issueNode).toBeDefined()
    expect(itemList?.numberOfItems).toBe(45)
    expect(scholarly.length).toBe(45)
    expect((itemList?.itemListElement as Array<{ position: number }>).map((el) => el.position)).toEqual(
      Array.from({ length: 45 }, (_, i) => i + 1),
    )
    expect((issueNode?.hasPart as Array<{ '@id': string }>).length).toBe(45)
  })

  it('boş sayıda ItemList ve hasPart üretmez', () => {
    const jsonLd = buildIssuePageJsonLd({
      canonicalBase,
      journalSegment,
      journal: baseJournal(),
      issue: baseIssue({ id: 37951, issue_number: 'Cilt: 77 - Sayı: 1', year: 2022 }),
      articles: [],
      pageTitle: 'Ankara Üniversitesi SBF Dergisi — Cilt 77, Sayı 1 (2022)',
      description: 'Boş sayı açıklaması',
    })

    expect(findByType(jsonLd, 'PublicationIssue')).toBeDefined()
    expect(findByType(jsonLd, 'ItemList')).toBeUndefined()
    expect(findByType(jsonLd, 'PublicationIssue')?.hasPart).toBeUndefined()
  })

  it('cilt numarası varsa PublicationVolume üretir', () => {
    const jsonLd = buildIssuePageJsonLd({
      canonicalBase,
      journalSegment,
      journal: baseJournal(),
      issue: baseIssue(),
      articles: [makeArticle(1, 'Test', 'test')],
      pageTitle: 'Sayı',
      description: 'Açıklama',
    })

    const volume = findByType(jsonLd, 'PublicationVolume')
    expect(volume?.volumeNumber).toBe('52')
    expect(findByType(jsonLd, 'PublicationIssue')?.isPartOf).toEqual({
      '@id': `${canonicalBase}/journals/${journalSegment}#volume-52`,
    })
  })

  it('sayı numarası ayrıştırılamazsa issueNumber üretmez', () => {
    const jsonLd = buildIssuePageJsonLd({
      canonicalBase,
      journalSegment,
      journal: baseJournal(),
      issue: baseIssue({ issue_number: null, volume: '12', issue_label: 'Cilt 12' }),
      articles: [],
      pageTitle: 'Sayı',
    })

    expect(findByType(jsonLd, 'PublicationIssue')?.issueNumber).toBeUndefined()
    expect(findByType(jsonLd, 'PublicationVolume')?.volumeNumber).toBe('12')
  })

  it('yalnızca yıl etiketinde sahte issueNumber üretmez', () => {
    const jsonLd = buildIssuePageJsonLd({
      canonicalBase,
      journalSegment: 'abant-izzet-baysal-universitesi-ilahiyat-fakultesi-dergisi-4',
      journal: baseJournal({
        id: 4,
        slug: 'abant-izzet-baysal-universitesi-ilahiyat-fakultesi-dergisi',
        title_tr: 'Abant İzzet Baysal Üniversitesi İlahiyat Fakültesi Dergisi',
      }),
      issue: baseIssue({
        id: 65,
        journal_id: 4,
        year: 2019,
        issue_number: null,
        volume: null,
        issue_label: '2019',
      }),
      articles: [makeArticle(1, 'Makale', 'makale')],
      pageTitle: 'Abant İzzet Baysal Üniversitesi İlahiyat Fakültesi Dergisi — 2019',
      description: 'Abant (2019) içinde yayımlanan 13 akademik makaleyi inceleyin.',
    })

    const issueNode = findByType(jsonLd, 'PublicationIssue')
    expect(issueNode?.issueNumber).toBeUndefined()
    expect(issueNode?.datePublished).toBeUndefined()
    expect(issueNode?.name).toBe('Abant İzzet Baysal Üniversitesi İlahiyat Fakültesi Dergisi — 2019')
  })

  it('özel karakter içeren başlıkları güvenli JSON olarak üretir', () => {
    const title = 'Türkçe & özel <karakter> "test"'
    const jsonLd = buildIssuePageJsonLd({
      canonicalBase,
      journalSegment,
      journal: baseJournal({ title_tr: title }),
      issue: baseIssue(),
      articles: [makeArticle(9, title, 'turkce-test')],
      pageTitle: title,
      description: title,
    })

    const serialized = JSON.stringify(jsonLd).replace(/</g, '\\u003c')
    expect(serialized).not.toContain('<karakter>')
    expect(hasNullishValue(jsonLd)).toBe(false)
  })

  it('makale URL’leri mutlak canonical kullanır', () => {
    const article = makeArticle(42, 'Örnek Makale', 'ornek-makale')
    const jsonLd = buildIssuePageJsonLd({
      canonicalBase,
      journalSegment,
      journal: baseJournal(),
      issue: baseIssue(),
      articles: [article],
      pageTitle: 'Sayı',
    })

    const scholarly = findByType(jsonLd, 'ScholarlyArticle')
    expect(scholarly?.['@id']).toBe(
      `${canonicalBase}/ankara-universitesi-sbf-dergisi/ornek-makale-42`,
    )
    expect(scholarly?.url).toBe(`${canonicalBase}/ankara-universitesi-sbf-dergisi/ornek-makale-42`)
  })
})
