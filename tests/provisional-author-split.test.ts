/**
 * Provisional author split (migration 019) unit tests.
 */

import { describe, it, expect } from 'vitest'
import {
  planProvisionalAuthorSplit,
  splitProvisionalLegacyId,
  isAmbiguousProvisionalRelationSet,
  articleAuthorSourceKeysForPositions,
} from '../lib/etl/provisional-author-split'
import { articleAuthorSourceKey } from '../lib/etl/author-source-key'
import { buildAuthorRobots, shouldEmitAuthorProfileJsonLd } from '../lib/authors/robots'

describe('provisional author split plan', () => {
  it('iki makaleye bağlı provisional iki deterministik author planına ayrılır', () => {
    const plan = planProvisionalAuthorSplit([
      { articleId: 5000, authorPosition: 1 },
      { articleId: 8000, authorPosition: 3 },
    ])
    expect(plan).toHaveLength(2)
    expect(plan[0].keepOriginalAuthor).toBe(true)
    expect(plan[1].keepOriginalAuthor).toBe(false)
    expect(plan[0].sourceKey).toBe('article:5000:position:1')
    expect(plan[1].sourceKey).toBe('article:8000:position:3')
  })

  it('her yeni author doğru source key alır', () => {
    const plan = planProvisionalAuthorSplit([
      { articleId: 22, authorPosition: 1 },
      { articleId: 24, authorPosition: 1 },
    ])
    expect(plan.map((p) => p.sourceKey)).toEqual([
      'article:22:position:1',
      'article:24:position:1',
    ])
  })

  it('article-author position korunur', () => {
    const plan = planProvisionalAuthorSplit([
      { articleId: 45, authorPosition: 2 },
      { articleId: 50, authorPosition: 2 },
    ])
    expect(plan[0].authorPosition).toBe(2)
    expect(plan[1].authorPosition).toBe(2)
  })

  it('tek ilişkili provisional belirsiz değildir', () => {
    expect(isAmbiguousProvisionalRelationSet([{ articleId: 1, authorPosition: 1 }])).toBe(false)
  })

  it('canonical split kapsamına girmez (belirsizlik yalnızca çoklu ilişki)', () => {
    expect(
      isAmbiguousProvisionalRelationSet([
        { articleId: 1, authorPosition: 1 },
        { articleId: 2, authorPosition: 1 },
      ]),
    ).toBe(true)
  })

  it('100+ author position source key çakışması oluşturmaz', () => {
    const positions = Array.from({ length: 120 }, (_, i) => i + 1)
    const keys = articleAuthorSourceKeysForPositions(999, positions)
    expect(new Set(keys).size).toBe(120)
    expect(keys[0]).toBe(articleAuthorSourceKey(999, 1))
    expect(keys[119]).toBe(articleAuthorSourceKey(999, 120))
  })

  it('split legacy_id article_id×100 formülünden farklıdır', () => {
    const splitLeg = splitProvisionalLegacyId(5000, 3)
    expect(splitLeg).toBe(-500_000_003)
    expect(splitLeg).not.toBe(-(5000 * 100 + 3))
  })

  it('migration ikinci çalışmada no-op — belirsiz kayıt kalmaz', () => {
    expect(isAmbiguousProvisionalRelationSet([{ articleId: 22, authorPosition: 1 }])).toBe(false)
  })
})

describe('author profile robots after split', () => {
  it('split edilen provisional profil noindex', () => {
    expect(buildAuthorRobots({ is_provisional: true })).toEqual({ index: false, follow: true })
    expect(shouldEmitAuthorProfileJsonLd({ is_provisional: true })).toBe(false)
  })

  it('canonical profil index', () => {
    expect(buildAuthorRobots({ is_provisional: false })).toEqual({ index: true, follow: true })
    expect(shouldEmitAuthorProfileJsonLd({ is_provisional: false })).toBe(true)
  })
})
