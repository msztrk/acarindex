/**
 * Citation metadata testleri
 * buildCitationData() pure fonksiyonu test edilir.
 */

import { describe, it, expect } from 'vitest'
import { buildCitationData } from '../components/seo/CitationMeta'

const baseProps = {
  title: 'Türkçe Akademik Makale Başlığı',
  authors: ['Ahmet Yılmaz', 'Fatma Şahin'],
  journalTitle: 'Eğitim Araştırmaları Dergisi',
}

describe('buildCitationData', () => {
  it('temel alanları doldurur', () => {
    const data = buildCitationData(baseProps)
    expect(data.citation_title).toBe('Türkçe Akademik Makale Başlığı')
    expect(data.citation_authors).toEqual(['Ahmet Yılmaz', 'Fatma Şahin'])
    expect(data.citation_journal_title).toBe('Eğitim Araştırmaları Dergisi')
  })

  it('citation_publication_date yıl ile doldurulur (citation_date değil)', () => {
    const data = buildCitationData({ ...baseProps, year: 2023 })
    expect(data.citation_publication_date).toBe('2023')
    // citation_date anahtarı olmamalı
    expect(Object.keys(data)).not.toContain('citation_date')
  })

  it('year null ise citation_publication_date null döner', () => {
    const data = buildCitationData({ ...baseProps, year: null })
    expect(data.citation_publication_date).toBeNull()
  })

  it('sayfa numaraları number olarak kabul edilir', () => {
    const data = buildCitationData({ ...baseProps, pageStart: 10, pageEnd: 25 })
    expect(data.citation_firstpage).toBe('10')
    expect(data.citation_lastpage).toBe('25')
  })

  it('pageStart=0 → null (falsy)', () => {
    const data = buildCitationData({ ...baseProps, pageStart: 0 })
    // 0 null olarak değerlendirilmemeli — ama pageStart=0 akademik metinlerde anlamsız
    // Kodda `!= null` check var, 0 geçer
    expect(data.citation_firstpage).toBe('0')
  })

  it('HTTP olmayan pdf URL → null', () => {
    const data = buildCitationData({ ...baseProps, pdfUrl: '/dosya/makale.pdf' })
    expect(data.citation_pdf_url).toBeNull()
  })

  it('HTTPS pdf URL geçer', () => {
    const data = buildCitationData({
      ...baseProps,
      pdfUrl: 'https://www.acarindex.com/pdfs/makale.pdf',
    })
    expect(data.citation_pdf_url).toBe('https://www.acarindex.com/pdfs/makale.pdf')
  })

  it('abstract HTML taglarını strip eder', () => {
    const data = buildCitationData({
      ...baseProps,
      abstract: '<p>Bu makale <strong>eğitim</strong> üzerinedir.</p>',
    })
    expect(data.citation_abstract).toBe('Bu makale eğitim üzerinedir.')
    expect(data.citation_abstract).not.toContain('<')
    expect(data.citation_abstract).not.toContain('>')
  })

  it('abstract null ise null döner', () => {
    const data = buildCitationData({ ...baseProps, abstract: null })
    expect(data.citation_abstract).toBeNull()
  })

  it('1500 karakterden uzun abstract kesilir', () => {
    const longAbstract = 'A'.repeat(2000)
    const data = buildCitationData({ ...baseProps, abstract: longAbstract })
    expect(data.citation_abstract!.length).toBe(1500)
  })

  it('DOI geçilince doldurulur', () => {
    const data = buildCitationData({ ...baseProps, doi: '10.1234/test.2023' })
    expect(data.citation_doi).toBe('10.1234/test.2023')
  })

  it('language geçilince doldurulur', () => {
    const data = buildCitationData({ ...baseProps, language: 'tr' })
    expect(data.citation_language).toBe('tr')
  })

  it('eksik opsiyonel alanlar null döner', () => {
    const data = buildCitationData(baseProps)
    expect(data.citation_issn).toBeNull()
    expect(data.citation_volume).toBeNull()
    expect(data.citation_issue).toBeNull()
    expect(data.citation_firstpage).toBeNull()
    expect(data.citation_lastpage).toBeNull()
    expect(data.citation_pdf_url).toBeNull()
    expect(data.citation_doi).toBeNull()
    expect(data.citation_language).toBeNull()
    expect(data.citation_abstract).toBeNull()
  })
})
