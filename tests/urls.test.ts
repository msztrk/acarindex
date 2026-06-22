/**
 * URL Parity Testleri
 * PHP urlYap() vs TypeScript urlYap() — birebir eşleşmeli
 *
 * Çalıştır: npx vitest run tests/urls.test.ts
 */

import { describe, it, expect } from 'vitest'
import { urlYap } from '../lib/urls/slug'
import { parseArticlePath, extractArticleId, buildArticleUrl } from '../lib/urls/article'
import { buildAuthorUrl, parseAuthorSlugAndId } from '../lib/urls/author'
import { parseJournalSegment, buildJournalPathSegment, parseIssueIdSegment } from '../lib/urls/journal'
import { buildLegacyPdfUrl, hasPdf } from '../lib/pdf/legacy-url'

// ─── urlYap parity ───────────────────────────────────────────────────────────
describe('urlYap', () => {
  it('Türkçe karakterleri dönüştürür', () => {
    expect(urlYap('Türkçe Başlık')).toBe('turkce-baslik')
    expect(urlYap('Şeker Fabrikası')).toBe('seker-fabrikasi')
    expect(urlYap('Ğırlık')).toBe('girlik')
    expect(urlYap('İstanbul Üniversitesi')).toBe('istanbul-universitesi')
  })

  it('Türkçe yazar ve kurum adlarından slug üretir (önce ASCII, sonra lowercase)', () => {
    expect(urlYap('İsmail Şentürk')).toBe('ismail-senturk')
    expect(urlYap('Işık Üniversitesi')).toBe('isik-universitesi')
    expect(urlYap('Çağlayan Öztürk')).toBe('caglayan-ozturk')
    expect(urlYap('Özcan Tunahan')).toBe('ozcan-tunahan')
  })

  it('Noktalama ve özel karakterleri kaldırır', () => {
    expect(urlYap('Merhaba, Dünya!')).toBe('merhaba-dunya')
    expect(urlYap("Yazar'ın Makalesi")).toBe('yazarin-makalesi')
    expect(urlYap('A & B')).toBe('a-b')
  })

  it('Fazla boşluk ve tireleri tekilleştirir', () => {
    expect(urlYap('  çok   boşluklu   ')).toBe('cok-bosluklu')
    expect(urlYap('tire--tire')).toBe('tire-tire')
    expect(urlYap('-baştaki-tire-')).toBe('bastaki-tire')
  })

  it('Boş/null girdide boş string döner', () => {
    expect(urlYap('')).toBe('')
    expect(urlYap(null)).toBe('')
    expect(urlYap(undefined)).toBe('')
  })

  it('Sadece rakamlar korunur', () => {
    expect(urlYap('123')).toBe('123')
    expect(urlYap('2024 Yılı')).toBe('2024-yili')
  })

  it('Gerçek makale başlığı örnekleri', () => {
    expect(urlYap('Millî Mücadele Döneminde Türk Basını')).toBe(
      'milli-mucadele-doneminde-turk-basini',
    )
    expect(urlYap('Hz. Peygamber\'in Şehit Aileleriyle Münasebetleri')).toBe(
      'hz-peygamberin-sehit-aileleriyle-munasebetleri',
    )
  })
})

// ─── parseArticlePath ────────────────────────────────────────────────────────
describe('parseArticlePath', () => {
  it('Geçerli makale path\'ini parse eder', () => {
    const result = parseArticlePath('turkish-studies', 'milli-mucadele-809939')
    expect(result).toEqual({
      journalSlug: 'turkish-studies',
      articleSlug: 'milli-mucadele',
      articleId: 809939,
    })
  })

  it('ID olmayan path\'i reddeder', () => {
    expect(parseArticlePath('turkish-studies', 'makale-adi')).toBeNull()
    expect(parseArticlePath('turkish-studies', '')).toBeNull()
  })

  it('Sıfır veya negatif ID reddeder', () => {
    expect(parseArticlePath('j', 'slug-0')).toBeNull()
  })
})

// ─── extractArticleId ────────────────────────────────────────────────────────
describe('extractArticleId', () => {
  it('Son sayısal segmenti çıkarır', () => {
    expect(extractArticleId('milli-mucadele-809939')).toBe(809939)
    expect(extractArticleId('a-1')).toBe(1)
  })

  it('Sayı olmayan son segmentte null döner', () => {
    expect(extractArticleId('sadece-slug')).toBeNull()
    expect(extractArticleId('')).toBeNull()
  })
})

// ─── buildArticleUrl ─────────────────────────────────────────────────────────
describe('buildArticleUrl', () => {
  it('Canonical URL üretir', () => {
    expect(
      buildArticleUrl('turkish-studies', 'Millî Mücadele Döneminde Türk Basını', 809939),
    ).toBe('/turkish-studies/milli-mucadele-doneminde-turk-basini-809939')
  })
})

// ─── parseJournalSegment ─────────────────────────────────────────────────────
describe('parseJournalSegment', () => {
  it('Dergi segment parse eder', () => {
    expect(parseJournalSegment('turkish-studies-123')).toEqual({
      journalSlug: 'turkish-studies',
      journalId: 123,
    })
  })

  it('Geçersiz segmentte null döner', () => {
    expect(parseJournalSegment('sadece-slug')).toBeNull()
    expect(parseJournalSegment('')).toBeNull()
  })
})

// ─── buildJournalPathSegment ─────────────────────────────────────────────────
describe('buildJournalPathSegment', () => {
  it('Segment üretir', () => {
    expect(buildJournalPathSegment('Turkish Studies Dergisi', 456)).toBe(
      'turkish-studies-dergisi-456',
    )
  })
})

// ─── buildLegacyPdfUrl ───────────────────────────────────────────────────────
describe('buildLegacyPdfUrl', () => {
  it('Relative path\'e base URL ekler', () => {
    const url = buildLegacyPdfUrl('dosyalar/makale/acarindex-123.pdf')
    expect(url).toBe('https://www.acarindex.com/dosyalar/makale/acarindex-123.pdf')
  })

  it('Harici URL olduğu gibi döner', () => {
    expect(buildLegacyPdfUrl('https://example.com/file.pdf')).toBe(
      'https://example.com/file.pdf',
    )
  })

  it('Eksik / boş / sentinel değerlerde null döner', () => {
    expect(buildLegacyPdfUrl(null)).toBeNull()
    expect(buildLegacyPdfUrl('')).toBeNull()
    expect(buildLegacyPdfUrl('pdf-bulunamadi')).toBeNull()
  })
})

describe('hasPdf', () => {
  it('PDF varsa true döner', () => {
    expect(hasPdf('dosyalar/makale/file.pdf')).toBe(true)
  })
  it('PDF yoksa false döner', () => {
    expect(hasPdf('pdf-bulunamadi')).toBe(false)
    expect(hasPdf(null)).toBe(false)
  })
})

// ─── parseIssueIdSegment ─────────────────────────────────────────────────────
describe('parseIssueIdSegment', () => {
  it('pozitif tam sayı issue ID döner', () => {
    expect(parseIssueIdSegment('2155')).toBe(2155)
    expect(parseIssueIdSegment('1')).toBe(1)
  })

  it('sayısal olmayan segmenti reddeder', () => {
    expect(parseIssueIdSegment('abc')).toBeNull()
    expect(parseIssueIdSegment('12abc')).toBeNull()
    expect(parseIssueIdSegment('')).toBeNull()
  })

  it('sıfır ve negatif ID reddeder', () => {
    expect(parseIssueIdSegment('0')).toBeNull()
    expect(parseIssueIdSegment('-1')).toBeNull()
  })
})

// ─── journal issue route HTTP ────────────────────────────────────────────────
const issueRouteBase = process.env.ISSUE_ROUTE_TEST_BASE_URL
const describeIssueRouteHttp = issueRouteBase ? describe : describe.skip

describeIssueRouteHttp('journal issue route HTTP', () => {
  const base = issueRouteBase!
  const sbfJournal = `${base}/journals/ankara-universitesi-sbf-dergisi-91`
  const otherJournal =
    `${base}/journals/yonetim-ve-ekonomi-celal-bayar-universitesi-iktisadi-ve-idari-bilimler-fakultesi-dergisi-101`

  async function fetchStatus(path: string): Promise<number> {
    const response = await fetch(path)
    return response.status
  }

  function metaDescription(html: string): string | undefined {
    return html.match(/name="description" content="([^"]+)"/)?.[1]
  }

  function extractIssueJsonLd(html: string): Record<string, unknown> | null {
    const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    for (const match of scripts) {
      const parsed = JSON.parse(match[1]) as Record<string, unknown>
      const graph = parsed['@graph'] as Array<Record<string, unknown>> | undefined
      if (graph?.some((node) => node['@type'] === 'PublicationIssue')) {
        return parsed
      }
    }
    return null
  }

  function findGraphType(jsonLd: Record<string, unknown>, type: string): Record<string, unknown> | undefined {
    const graph = jsonLd['@graph'] as Array<Record<string, unknown>> | undefined
    return graph?.find((node) => node['@type'] === type)
  }

  it('geçerli sayı → 200', async () => {
    const status = await fetchStatus(`${sbfJournal}/sayi/2155`)
    expect(status).toBe(200)
    const html = await (await fetch(`${sbfJournal}/sayi/2155`)).text()
    expect(html).toContain('Cilt 52')
    expect(html).toMatch(/rel="canonical" href="[^"]*\/sayi\/2155"/)
    expect(html.replace(/<!-- -->/g, '')).toContain('45 makale')
    expect(metaDescription(html)).toContain('45 akademik makale')

    const jsonLd = extractIssueJsonLd(html)
    expect(jsonLd).not.toBeNull()
    expect(findGraphType(jsonLd!, 'PublicationIssue')).toBeDefined()
    expect(findGraphType(jsonLd!, 'ItemList')?.numberOfItems).toBe(45)
    expect(html).toContain('PublicationIssue')
  })

  it('28 makaleli sayı → 200 ve metadata count', async () => {
    const url = `${otherJournal}/sayi/2647`
    expect(await fetchStatus(url)).toBe(200)
    const html = await (await fetch(url)).text()
    expect(html.replace(/<!-- -->/g, '')).toContain('28 makale')
    expect(metaDescription(html)).toContain('28 akademik makale')
  })

  it('boş ama geçerli sayı → 200', async () => {
    const status = await fetchStatus(`${sbfJournal}/sayi/37951`)
    expect(status).toBe(200)
    const html = await (await fetch(`${sbfJournal}/sayi/37951`)).text()
    expect(html).toContain('Bu sayıda listelenecek makale bulunmuyor.')
    expect(html).toMatch(/rel="canonical" href="[^"]*\/sayi\/37951"/)
    expect(metaDescription(html)).toContain('akademik makaleleri inceleyin.')
    expect(metaDescription(html)).not.toMatch(/\d+ akademik makale/)

    const jsonLd = extractIssueJsonLd(html)
    expect(jsonLd).not.toBeNull()
    expect(findGraphType(jsonLd!, 'PublicationIssue')).toBeDefined()
    expect(findGraphType(jsonLd!, 'ItemList')).toBeUndefined()
    expect(findGraphType(jsonLd!, 'PublicationIssue')?.hasPart).toBeUndefined()
  })

  it('olmayan sayı → 404', async () => {
    const status = await fetchStatus(`${sbfJournal}/sayi/999999999`)
    expect(status).toBe(404)
    const html = await (await fetch(`${sbfJournal}/sayi/999999999`)).text()
    expect(html).not.toMatch(/rel="canonical" href="[^"]*\/sayi\/999999999"/)
    expect(html).not.toMatch(/property="og:url" content="[^"]*\/sayi\/999999999"/)
    expect(extractIssueJsonLd(html)).toBeNull()
  })

  it('sayı yanlış dergi altında → 404', async () => {
    const status = await fetchStatus(`${otherJournal}/sayi/2155`)
    expect(status).toBe(404)
  })

  it('sayısal olmayan issue ID → 404', async () => {
    expect(await fetchStatus(`${sbfJournal}/sayi/abc`)).toBe(404)
    expect(await fetchStatus(`${sbfJournal}/sayi/-1`)).toBe(404)
    expect(await fetchStatus(`${sbfJournal}/sayi/0`)).toBe(404)
  })
})

// ─── journal archive route HTTP ────────────────────────────────────────────────
const describeArchiveRouteHttp = issueRouteBase ? describe : describe.skip

describeArchiveRouteHttp('journal archive route HTTP', () => {
  const base = issueRouteBase!
  const sbfArchive = `${base}/journals/ankara-universitesi-sbf-dergisi-91/arsiv`
  const otherArchive =
    `${base}/journals/yonetim-ve-ekonomi-celal-bayar-universitesi-iktisadi-ve-idari-bilimler-fakultesi-dergisi-101/arsiv`
  const emptyArchive =
    `${base}/journals/international-journal-of-applied-sciences-and-computational-engineering-1128/arsiv`
  const abantArchive =
    `${base}/journals/abant-izzet-baysal-universitesi-ilahiyat-fakultesi-dergisi-4/arsiv`

  function extractArchiveJsonLd(html: string): Record<string, unknown> | null {
    const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    for (const match of scripts) {
      const parsed = JSON.parse(match[1]) as Record<string, unknown>
      const graph = parsed['@graph'] as Array<Record<string, unknown>> | undefined
      if (graph?.some((node) => node['@type'] === 'CollectionPage')) {
        return parsed
      }
    }
    return null
  }

  it('geçerli arşiv → 200, canonical ve sayı linki', async () => {
    const response = await fetch(sbfArchive)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toMatch(/rel="canonical" href="[^"]*\/arsiv"/)
    expect(html).toContain('/sayi/2155')
    expect(html).toContain('/sayi/37951')
    expect(html).toContain('CollectionPage')
    const jsonLd = extractArchiveJsonLd(html)
    expect(jsonLd).not.toBeNull()
    const graph = jsonLd!['@graph'] as Array<Record<string, unknown>>
    expect(graph.some((n) => n['@type'] === 'ItemList')).toBe(true)
  })

  it('uzun dergi adlı arşiv → 200', async () => {
    const response = await fetch(otherArchive)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('Yönetim ve Ekonomi')
    expect(html).toMatch(/rel="canonical" href="[^"]*\/arsiv"/)
  })

  it('yalnızca yıl etiketi arşivde tekrar üretmez', async () => {
    const response = await fetch(abantArchive)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('/sayi/65')
    expect(html).not.toContain('2019 (2019)')
  })

  it('boş arşiv → 200 ve boş durum mesajı', async () => {
    const response = await fetch(emptyArchive)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('Bu dergi için henüz arşivlenmiş sayı bulunmuyor.')
    const jsonLd = extractArchiveJsonLd(html)
    if (jsonLd) {
      const graph = jsonLd['@graph'] as Array<Record<string, unknown>>
      expect(graph.some((n) => n['@type'] === 'ItemList')).toBe(false)
    }
  })

  it('geçersiz dergi arşivi → 404', async () => {
    const response = await fetch(`${base}/journals/ankara-universitesi-sbf-dergisi-99999/arsiv`)
    expect(response.status).toBe(404)
  })
})

// ─── author route HTTP ─────────────────────────────────────────────────────────
const describeAuthorRouteHttp = issueRouteBase ? describe : describe.skip

describeAuthorRouteHttp('author route HTTP', () => {
  const base = issueRouteBase!

  function extractAuthorJsonLd(html: string): Record<string, unknown> | null {
    const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    for (const match of scripts) {
      const parsed = JSON.parse(match[1]) as Record<string, unknown>
      const graph = parsed['@graph'] as Array<Record<string, unknown>> | undefined
      if (graph?.some((node) => node['@type'] === 'ProfilePage' || node['@type'] === 'Person')) {
        return parsed
      }
    }
    return null
  }

  it('çok makaleli yazar → 200, canonical ve JSON-LD', async () => {
    const url = `${base}/authors/ahmet-guven-15`
    const response = await fetch(url)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toMatch(/rel="canonical" href="[^"]*\/authors\/ahmet-guven-15"/)
    expect(html).toContain('Ahmet GÜVEN')
    const jsonLd = extractAuthorJsonLd(html)
    expect(jsonLd).not.toBeNull()
    const graph = jsonLd!['@graph'] as Array<Record<string, unknown>>
    expect(graph.some((n) => n['@type'] === 'Person')).toBe(true)
    expect(graph.some((n) => n['@type'] === 'ProfilePage')).toBe(true)
  })

  it('tek makaleli yazar → 200', async () => {
    const response = await fetch(`${base}/authors/murat-sengoz-3`)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('Murat ŞENGÖZ')
  })

  it('yanlış slug + doğru ID → 200 ve doğru canonical', async () => {
    const response = await fetch(`${base}/authors/yanlis-slug-15`)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toMatch(/rel="canonical" href="[^"]*\/authors\/ahmet-guven-15"/)
  })

  it('geçersiz yazar ID → 404', async () => {
    expect((await fetch(`${base}/authors/yazar-abc`)).status).toBe(404)
    expect((await fetch(`${base}/authors/yazar-0`)).status).toBe(404)
    expect((await fetch(`${base}/authors/yazar--1`)).status).toBe(404)
    const invalid = await fetch(`${base}/authors/999999999`)
    expect(invalid.status).toBe(404)
    const html = await invalid.text()
    expect(extractAuthorJsonLd(html)).toBeNull()
  })

  it('makale detay yazar bağlantısı → yazar sayfası 200', async () => {
    const articleUrl = `${base}/enderun/turkiyede-e-devlet-olgusu-ve-bilgi-guvenligi-acisindan-bir-degerlendirme-29`
    const articleHtml = await (await fetch(articleUrl)).text()
    const authorHref = articleHtml.match(/href="(\/authors\/[^"]+)"/)?.[1]
    expect(authorHref).toBeTruthy()
    const authorResponse = await fetch(`${base}${authorHref}`)
    expect(authorResponse.status).toBe(200)
  })
})
