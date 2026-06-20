/**
 * ETL utility testleri
 * - parsePages: sayfa aralığı parse
 * - parseAuthors: virgülle ayrılmış yazar ayrıştırma
 * - normalizeAuthorName: yazar adı normalizasyonu
 */

import { describe, it, expect } from 'vitest'
import { parsePages, parseAuthors, normalizeAuthorName } from '../lib/etl/utils'

// ─── parsePages ───────────────────────────────────────────────────────────────
describe('parsePages', () => {
  it('tire ile ayrılmış aralık', () => {
    expect(parsePages('1-15')).toEqual({ start: 1, end: 15 })
  })

  it('em dash ile ayrılmış aralık', () => {
    expect(parsePages('23–45')).toEqual({ start: 23, end: 45 })
  })

  it('boşluklu aralık', () => {
    expect(parsePages('100 - 120')).toEqual({ start: 100, end: 120 })
  })

  it('tek sayfa', () => {
    expect(parsePages('7')).toEqual({ start: 7, end: null })
  })

  it('null girdi', () => {
    expect(parsePages(null)).toEqual({ start: null, end: null })
  })

  it('boş string', () => {
    expect(parsePages('')).toEqual({ start: null, end: null })
  })

  it('metin içeriyorsa parse edilemez', () => {
    expect(parsePages('s.1-15')).toEqual({ start: null, end: null })
    expect(parsePages('pp.1-10')).toEqual({ start: null, end: null })
  })

  it('büyük sayfa numaraları', () => {
    expect(parsePages('1001-1050')).toEqual({ start: 1001, end: 1050 })
  })
})

// ─── parseAuthors ─────────────────────────────────────────────────────────────
describe('parseAuthors', () => {
  it('tek yazar', () => {
    expect(parseAuthors('Ahmet Yılmaz')).toEqual(['Ahmet Yılmaz'])
  })

  it('birden fazla yazar', () => {
    expect(parseAuthors('Ahmet Yılmaz, Fatma Şahin, Mehmet Demir')).toEqual([
      'Ahmet Yılmaz',
      'Fatma Şahin',
      'Mehmet Demir',
    ])
  })

  it('null/undefined → boş liste', () => {
    expect(parseAuthors(null)).toEqual([])
    expect(parseAuthors(undefined)).toEqual([])
  })

  it('boş string → boş liste', () => {
    expect(parseAuthors('')).toEqual([])
  })

  it('tek karakter isimleri filtreler', () => {
    const result = parseAuthors('A, Ahmet Yılmaz, B')
    expect(result).not.toContain('A')
    expect(result).not.toContain('B')
    expect(result).toContain('Ahmet Yılmaz')
  })

  it('sadece noktalama içeren isimleri filtreler', () => {
    const result = parseAuthors('Prof. Dr. Ahmet Yılmaz, , Fatma Şahin')
    expect(result.some((n) => n.trim() === '')).toBe(false)
  })

  it('baştaki/sondaki boşlukları trim eder', () => {
    const result = parseAuthors('  Ahmet Yılmaz  ,  Fatma Şahin  ')
    expect(result).toContain('Ahmet Yılmaz')
    expect(result).toContain('Fatma Şahin')
  })
})

// ─── normalizeAuthorName ──────────────────────────────────────────────────────
describe('normalizeAuthorName', () => {
  it('baştaki non-alphabetic karakterleri kaldırır', () => {
    // Sadece başındaki/sonundaki harf dışı karakterler silinir
    // "Prof." harfle başladığı için değişmez
    expect(normalizeAuthorName('.Ahmet Yılmaz')).toBe('Ahmet Yılmaz')
    expect(normalizeAuthorName('- Ahmet Yılmaz')).toBe('Ahmet Yılmaz')
  })

  it('ünvanlar (Prof. Dr.) fonksiyon kapsamında kaldırılmaz — test belgesi', () => {
    // normalizeAuthorName ünvan soyma yapmaz; sadece non-alpha baş/son temizler
    expect(normalizeAuthorName('Prof. Dr. Ahmet')).toBe('Prof. Dr. Ahmet')
  })

  it('sondaki noktalamayı kaldırır', () => {
    expect(normalizeAuthorName('Ahmet Yılmaz.')).toBe('Ahmet Yılmaz')
  })

  it('birden fazla boşluğu tek boşluğa düşürür', () => {
    expect(normalizeAuthorName('Ahmet   Yılmaz')).toBe('Ahmet Yılmaz')
  })

  it('normal isim değişmez', () => {
    expect(normalizeAuthorName('Fatma Şahin')).toBe('Fatma Şahin')
  })

  it('Türkçe karakter içeren isim', () => {
    expect(normalizeAuthorName('İbrahim Çelik')).toBe('İbrahim Çelik')
  })
})
