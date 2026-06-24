import { describe, expect, it } from 'vitest'
import {
  buildArticleCanonicalPath,
  isAliasCycle,
  resolveArticleSlug,
  slugWithLegacyIdSuffix,
} from '@/lib/etl/article-slug-policy'

describe('article-slug-policy', () => {
  const journal = 'test-journal'
  const base = 'normal-makale-basligi'

  it('owner keeps base slug', () => {
    const r = resolveArticleSlug({
      baseSlug: base,
      legacyId: 100,
      legacyJournalSlug: journal,
      existingSlug: null,
      conflictingArticleLegacyId: 200,
    })
    expect(r.slug).toBe(base)
    expect(r.urlAlias).toBeNull()
  })

  it('non-owner gets legacy id suffix', () => {
    const r = resolveArticleSlug({
      baseSlug: base,
      legacyId: 200,
      legacyJournalSlug: journal,
      existingSlug: null,
      conflictingArticleLegacyId: 100,
    })
    expect(r.slug).toBe(slugWithLegacyIdSuffix(base, 200))
    expect(r.urlAlias).toBeNull()
  })

  it('creates alias when fixing existing duplicate slug', () => {
    const r = resolveArticleSlug({
      baseSlug: base,
      legacyId: 123456,
      legacyJournalSlug: journal,
      existingSlug: base,
      conflictingArticleLegacyId: 100,
    })
    expect(r.slug).toBe(`${base}-123456`)
    expect(r.urlAlias).toEqual({
      legacyPath: buildArticleCanonicalPath(journal, base, 123456),
      canonicalPath: buildArticleCanonicalPath(journal, `${base}-123456`, 123456),
      entityType: 'article',
      entityId: 123456,
      httpStatus: 301,
    })
  })

  it('idempotent when already suffixed', () => {
    const suffixed = slugWithLegacyIdSuffix(base, 123456)
    const r = resolveArticleSlug({
      baseSlug: base,
      legacyId: 123456,
      legacyJournalSlug: journal,
      existingSlug: suffixed,
      conflictingArticleLegacyId: 100,
    })
    expect(r.slug).toBe(suffixed)
    expect(r.urlAlias).toBeNull()
  })

  it('detects alias cycle', () => {
    const map = new Map<string, string>([
      ['/b', '/c'],
      ['/c', '/a'],
    ])
    expect(isAliasCycle('/a', '/b', map)).toBe(true)
    expect(isAliasCycle('/x', '/y', map)).toBe(false)
  })
})
