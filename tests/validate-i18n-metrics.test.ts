import { describe, expect, it } from 'vitest'
import {
  assertNoCrossFilterDeltas,
  buildValidateI18nContentMetrics,
  classifyEnSitemapExclusion,
  countEnSitemapExclusionBreakdown,
  isArticleEligibleForEnSitemap,
  type EnSitemapExclusionArticleRow,
} from '@/lib/i18n/validate-i18n-metrics'

describe('validate-i18n-metrics', () => {
  it('does not produce a negative cross-filter delta when content count exceeds sitemap count', () => {
    const metrics = buildValidateI18nContentMetrics({
      totalPublishedArticles: 540_122,
      currentComputedEnContent: 381_405,
      currentEnSitemapEligible: 306_771,
      previousComputedEnContent: 381_605,
      previousEnSitemapEligible: 306_771,
      exclusionBreakdown: {
        byArticleStatus: 0,
        byMissingSlug: 0,
        byMissingJournal: 0,
        byJournalStatus: 74_634,
      },
    })

    expect(metrics.computed_en_content_delta).toBe(-200)
    expect(metrics.en_sitemap_eligible_delta).toBe(0)
    expect(metrics.computed_en_content_delta).not.toBe(
      metrics.current_en_sitemap_eligible - metrics.previous_computed_en_content,
    )
    assertNoCrossFilterDeltas(metrics)
  })

  it('computes computed_en_content_delta only from previous and current computed counts', () => {
    const metrics = buildValidateI18nContentMetrics({
      totalPublishedArticles: 100,
      currentComputedEnContent: 80,
      currentEnSitemapEligible: 50,
      previousComputedEnContent: 85,
      previousEnSitemapEligible: 48,
      exclusionBreakdown: {
        byArticleStatus: 0,
        byMissingSlug: 10,
        byMissingJournal: 5,
        byJournalStatus: 15,
      },
    })

    expect(metrics.computed_en_content_delta).toBe(80 - 85)
    expect(metrics.computed_en_content_delta).not.toBe(80 - 48)
  })

  it('computes en_sitemap_eligible_delta only from previous and current sitemap counts', () => {
    const metrics = buildValidateI18nContentMetrics({
      totalPublishedArticles: 100,
      currentComputedEnContent: 80,
      currentEnSitemapEligible: 50,
      previousComputedEnContent: 85,
      previousEnSitemapEligible: 48,
      exclusionBreakdown: {
        byArticleStatus: 0,
        byMissingSlug: 10,
        byMissingJournal: 5,
        byJournalStatus: 15,
      },
    })

    expect(metrics.en_sitemap_eligible_delta).toBe(50 - 48)
    expect(metrics.en_sitemap_eligible_delta).not.toBe(50 - 85)
  })

  it('requires exclusion sub-reasons to sum to articles_excluded_from_en_sitemap', () => {
    expect(() =>
      buildValidateI18nContentMetrics({
        totalPublishedArticles: 100,
        currentComputedEnContent: 80,
        currentEnSitemapEligible: 50,
        exclusionBreakdown: {
          byArticleStatus: 0,
          byMissingSlug: 10,
          byMissingJournal: 5,
          byJournalStatus: 10,
        },
      }),
    ).toThrow(/exclusion breakdown sum/)

    const metrics = buildValidateI18nContentMetrics({
      totalPublishedArticles: 100,
      currentComputedEnContent: 80,
      currentEnSitemapEligible: 50,
      exclusionBreakdown: {
        byArticleStatus: 0,
        byMissingSlug: 10,
        byMissingJournal: 5,
        byJournalStatus: 15,
      },
    })

    expect(metrics.articles_excluded_from_en_sitemap).toBe(30)
    expect(
      metrics.articles_excluded_by_missing_slug +
        metrics.articles_excluded_by_missing_journal +
        metrics.articles_excluded_by_article_status +
        metrics.articles_excluded_by_journal_status,
    ).toBe(metrics.articles_excluded_from_en_sitemap)
  })

  it('classifies exclusion rows into mutually exclusive buckets', () => {
    const rows: EnSitemapExclusionArticleRow[] = [
      {
        status: 'published',
        hasEnContent: true,
        slugEn: null,
        journal: { status: 'published' },
      },
      {
        status: 'published',
        hasEnContent: true,
        slugEn: 'article-slug',
        journal: { status: 'draft' },
      },
      {
        status: 'draft',
        hasEnContent: true,
        slugEn: 'article-slug',
        journal: { status: 'published' },
      },
    ]

    const breakdown = countEnSitemapExclusionBreakdown(rows, () => true)
    expect(breakdown.byMissingSlug).toBe(1)
    expect(breakdown.byJournalStatus).toBe(1)
    expect(breakdown.byArticleStatus).toBe(1)
  })

  it('buildValidateI18nContentMetrics passes ok-style invariants for steady-state beta-like counts', () => {
    const metrics = buildValidateI18nContentMetrics({
      totalPublishedArticles: 540_122,
      currentComputedEnContent: 381_405,
      currentEnSitemapEligible: 306_771,
      exclusionBreakdown: {
        byArticleStatus: 0,
        byMissingSlug: 0,
        byMissingJournal: 0,
        byJournalStatus: 74_634,
      },
    })

    expect(metrics.articles_with_computed_en_content).toBe(381_405)
    expect(metrics.articles_eligible_for_en_sitemap).toBe(306_771)
    expect(metrics.articles_excluded_from_en_sitemap).toBe(74_634)
    expect(metrics.computed_en_content_delta).toBe(0)
    expect(metrics.en_sitemap_eligible_delta).toBe(0)
    assertNoCrossFilterDeltas(metrics)
  })

  it('isArticleEligibleForEnSitemap mirrors sitemap where clause fields', () => {
    expect(
      isArticleEligibleForEnSitemap({
        status: 'published',
        hasEnContent: true,
        slugEn: 'slug',
        journal: { status: 'published' },
      }),
    ).toBe(true)
    expect(
      classifyEnSitemapExclusion({
        status: 'published',
        hasEnContent: true,
        slugEn: 'slug',
        journal: { status: 'archived' },
      }),
    ).toBe('byJournalStatus')
  })
})
