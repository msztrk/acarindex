import { describe, expect, it } from 'vitest'

function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

describe('JsonLd serialization', () => {
  it('Türkçe karakterleri korur', () => {
    const data = { name: 'Ankara Üniversitesi SBF Dergisi — Cilt 52' }
    const parsed = JSON.parse(serializeJsonLd(data))
    expect(parsed.name).toBe('Ankara Üniversitesi SBF Dergisi — Cilt 52')
  })

  it('< karakterini güvenli biçimde serileştirir ve parse sonrası geri döner', () => {
    const data = {
      '@type': 'ScholarlyArticle',
      name: 'Başlık <test> & örnek',
    }
    const serialized = serializeJsonLd(data)
    expect(serialized).not.toContain('<test>')
    expect(serialized).toContain('\\u003c')

    const parsed = JSON.parse(serialized)
    expect(parsed.name).toBe('Başlık <test> & örnek')
  })

  it('ScholarlyArticle ve Periodical örneklerini geçerli JSON olarak üretir', () => {
    const scholarly = serializeJsonLd({
      '@context': 'https://schema.org',
      '@type': 'ScholarlyArticle',
      headline: 'Türkçe makale',
      url: 'https://www.acarindex.com/demo/makale-1',
    })
    const periodical = serializeJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Periodical',
      name: 'Dergi Adı',
      url: 'https://www.acarindex.com/journals/demo-1',
    })

    expect(JSON.parse(scholarly)).toMatchObject({ '@type': 'ScholarlyArticle' })
    expect(JSON.parse(periodical)).toMatchObject({ '@type': 'Periodical' })
  })

  it('PublicationIssue graph örneğini geçerli JSON olarak üretir', () => {
    const issueGraph = serializeJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'PublicationIssue',
          '@id': 'https://www.acarindex.com/journals/demo-91/sayi/2155#issue',
          name: 'Dergi — Cilt 52, Sayı 01 (1997)',
        },
      ],
    })

    const parsed = JSON.parse(issueGraph)
    expect(parsed['@graph'][0]['@type']).toBe('PublicationIssue')
  })

  it('ProfilePage ve Person örneğini geçerli JSON olarak üretir', () => {
    const authorGraph = serializeJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'ProfilePage',
          '@id': 'https://www.acarindex.com/authors/demo-1#profile',
          name: 'Demo Yazar – Makaleleri ve Akademik Yayınları',
          mainEntity: { '@id': 'https://www.acarindex.com/authors/demo-1#person' },
        },
        {
          '@type': 'Person',
          '@id': 'https://www.acarindex.com/authors/demo-1#person',
          name: 'Demo Yazar',
        },
      ],
    })

    const parsed = JSON.parse(authorGraph)
    expect(parsed['@graph'][0]['@type']).toBe('ProfilePage')
    expect(parsed['@graph'][1]['@type']).toBe('Person')
  })
})
