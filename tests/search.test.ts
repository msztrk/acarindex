/**
 * Arama logic testleri
 * - parsePrefixQuery: pure function
 * - buildSearchCondition: pure function
 */

import { describe, it, expect } from 'vitest'
import { parsePrefixQuery, buildSearchCondition } from '../lib/search/search'
import { expandSearchTerms } from '../lib/search/normalize'

// ─── parsePrefixQuery ─────────────────────────────────────────────────────────
describe('parsePrefixQuery', () => {
  it('prefix yoksa area=all döner', () => {
    expect(parsePrefixQuery('dil eğitimi')).toEqual({ q: 'dil eğitimi', area: 'all' })
  })

  it('author: prefix ayrıştırır', () => {
    expect(parsePrefixQuery('author:Ahmet Yılmaz')).toEqual({ q: 'Ahmet Yılmaz', area: 'author' })
  })

  it('title: prefix ayrıştırır', () => {
    expect(parsePrefixQuery('title:matematik eğitimi')).toEqual({ q: 'matematik eğitimi', area: 'title' })
  })

  it('keyword: prefix ayrıştırır', () => {
    expect(parsePrefixQuery('keyword:biyoloji')).toEqual({ q: 'biyoloji', area: 'keywords' })
  })

  it('abstract: prefix artık desteklenmiyor — ham sorgu döner', () => {
    expect(parsePrefixQuery('abstract:nicel araştırma')).toEqual({ q: 'abstract:nicel araştırma', area: 'all' })
  })

  it('bilinmeyen prefix varsa ham sorgu döner', () => {
    expect(parsePrefixQuery('doi:10.1234/abc')).toEqual({ q: 'doi:10.1234/abc', area: 'all' })
  })

  it('prefix sonrası boş değerde ham sorgu döner', () => {
    expect(parsePrefixQuery('author:')).toEqual({ q: 'author:', area: 'all' })
  })

  it('boş string → boş q, area=all', () => {
    expect(parsePrefixQuery('')).toEqual({ q: '', area: 'all' })
  })

  it('büyük harf prefix de tanınır (case insensitive)', () => {
    expect(parsePrefixQuery('AUTHOR:Smith')).toEqual({ q: 'Smith', area: 'author' })
  })

  it('karma büyük-küçük harf prefix', () => {
    expect(parsePrefixQuery('Title:eğitim')).toEqual({ q: 'eğitim', area: 'title' })
  })
})

// ─── buildSearchCondition ─────────────────────────────────────────────────────
describe('buildSearchCondition', () => {
  it('area=all başlık, yazar ve anahtar kelime alanlarını kapsar (özet hariç)', () => {
    const condition = buildSearchCondition('all', 'test')
    expect(condition).toContain('title_tr.ilike.*test*')
    expect(condition).toContain('title_en.ilike.*test*')
    expect(condition).toContain('authors_raw.ilike.*test*')
    expect(condition).toContain('keywords_tr.ilike.*test*')
    expect(condition).toContain('keywords_en.ilike.*test*')
    expect(condition).not.toContain('abstract')
    expect(condition.split(',').length).toBe(5)
  })

  it('area=title sadece başlık alanlarını içerir', () => {
    const condition = buildSearchCondition('title', 'matematik')
    expect(condition).toContain('title_tr.ilike.*matematik*')
    expect(condition).toContain('title_en.ilike.*matematik*')
    expect(condition).not.toContain('authors_raw')
    expect(condition).not.toContain('abstract')
  })

  it('area=author sadece authors_raw içerir', () => {
    const condition = buildSearchCondition('author', 'Yılmaz')
    expect(condition).toBe('authors_raw.ilike.*Yilmaz*')
  })

  it('area=keywords keyword alanlarını içerir', () => {
    const condition = buildSearchCondition('keywords', 'eğitim')
    expect(condition).toContain('keywords_tr.ilike.*egitim*')
    expect(condition).toContain('keywords_en.ilike.*egitim*')
    expect(condition).not.toContain('title_tr')
  })

  it('tek tırnak karakteri SQL injection guard\'a takılır', () => {
    const condition = buildSearchCondition('title', "O'Brien")
    expect(condition).toContain("O''Brien")
    expect(condition).not.toContain("O'Brien")
  })
})

describe('expandSearchTerms', () => {
  it('orijinal ve normalize terimleri birlikte döner', () => {
    expect(expandSearchTerms('Geliştirme')).toEqual(['Geliştirme', 'Gelistirme'])
  })

  it('ASCII sorguda yalnızca bir terim', () => {
    expect(expandSearchTerms('test')).toEqual(['test'])
  })
})
