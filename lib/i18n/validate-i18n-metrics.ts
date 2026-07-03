/**
 * Pure helpers for validate-i18n-urls.ts report assembly.
 * Separates computed EN content counts from EN sitemap eligibility counts.
 */

export type EnSitemapExclusionArticleRow = {
  status: string
  hasEnContent: boolean
  slugEn?: string | null
  journal?: { status: string } | null
}

export type EnSitemapExclusionBreakdown = {
  byArticleStatus: number
  byMissingSlug: number
  byMissingJournal: number
  byJournalStatus: number
}

export type ValidateI18nContentMetricsInput = {
  totalPublishedArticles: number
  currentComputedEnContent: number
  currentEnSitemapEligible: number
  exclusionBreakdown: EnSitemapExclusionBreakdown
  previousComputedEnContent?: number
  previousEnSitemapEligible?: number
}

export type ValidateI18nContentMetrics = {
  total_published_articles: number
  articles_with_computed_en_content: number
  articles_without_computed_en_content: number
  articles_eligible_for_en_sitemap: number
  articles_excluded_from_en_sitemap: number
  articles_excluded_by_journal_status: number
  articles_excluded_by_missing_journal: number
  articles_excluded_by_article_status: number
  articles_excluded_by_missing_slug: number
  previous_computed_en_content: number
  current_computed_en_content: number
  computed_en_content_delta: number
  previous_en_sitemap_eligible: number
  current_en_sitemap_eligible: number
  en_sitemap_eligible_delta: number
}

/** Mirrors publishedEnglishArticleWhere without changing the Prisma query. */
export function isArticleEligibleForEnSitemap(row: EnSitemapExclusionArticleRow): boolean {
  return (
    row.status === 'published' &&
    row.hasEnContent &&
    !!row.slugEn?.trim() &&
    row.journal?.status === 'published'
  )
}

/** Assign each excluded article to exactly one reporting bucket (priority order). */
export function classifyEnSitemapExclusion(
  row: EnSitemapExclusionArticleRow,
): keyof EnSitemapExclusionBreakdown {
  if (row.status !== 'published') return 'byArticleStatus'
  if (!row.slugEn?.trim()) return 'byMissingSlug'
  if (!row.journal) return 'byMissingJournal'
  if (row.journal.status !== 'published') return 'byJournalStatus'
  if (!row.hasEnContent) return 'byArticleStatus'
  return 'byJournalStatus'
}

export function sumEnSitemapExclusionBreakdown(breakdown: EnSitemapExclusionBreakdown): number {
  return (
    breakdown.byArticleStatus +
    breakdown.byMissingSlug +
    breakdown.byMissingJournal +
    breakdown.byJournalStatus
  )
}

export function countEnSitemapExclusionBreakdown(
  rows: EnSitemapExclusionArticleRow[],
  hasComputedEnContent: (row: EnSitemapExclusionArticleRow) => boolean,
): EnSitemapExclusionBreakdown {
  const breakdown: EnSitemapExclusionBreakdown = {
    byArticleStatus: 0,
    byMissingSlug: 0,
    byMissingJournal: 0,
    byJournalStatus: 0,
  }

  for (const row of rows) {
    if (!hasComputedEnContent(row)) continue
    if (isArticleEligibleForEnSitemap(row)) continue
    breakdown[classifyEnSitemapExclusion(row)]++
  }

  return breakdown
}

export function buildValidateI18nContentMetrics(
  input: ValidateI18nContentMetricsInput,
): ValidateI18nContentMetrics {
  const articlesExcludedFromEnSitemap =
    input.currentComputedEnContent - input.currentEnSitemapEligible

  const previousComputedEnContent =
    input.previousComputedEnContent ?? input.currentComputedEnContent
  const previousEnSitemapEligible =
    input.previousEnSitemapEligible ?? input.currentEnSitemapEligible

  const breakdownSum = sumEnSitemapExclusionBreakdown(input.exclusionBreakdown)
  if (breakdownSum !== articlesExcludedFromEnSitemap) {
    throw new Error(
      `EN sitemap exclusion breakdown sum (${breakdownSum}) != articles_excluded_from_en_sitemap (${articlesExcludedFromEnSitemap})`,
    )
  }

  return {
    total_published_articles: input.totalPublishedArticles,
    articles_with_computed_en_content: input.currentComputedEnContent,
    articles_without_computed_en_content:
      input.totalPublishedArticles - input.currentComputedEnContent,
    articles_eligible_for_en_sitemap: input.currentEnSitemapEligible,
    articles_excluded_from_en_sitemap: articlesExcludedFromEnSitemap,
    articles_excluded_by_journal_status: input.exclusionBreakdown.byJournalStatus,
    articles_excluded_by_missing_journal: input.exclusionBreakdown.byMissingJournal,
    articles_excluded_by_article_status: input.exclusionBreakdown.byArticleStatus,
    articles_excluded_by_missing_slug: input.exclusionBreakdown.byMissingSlug,
    previous_computed_en_content: previousComputedEnContent,
    current_computed_en_content: input.currentComputedEnContent,
    computed_en_content_delta:
      input.currentComputedEnContent - previousComputedEnContent,
    previous_en_sitemap_eligible: previousEnSitemapEligible,
    current_en_sitemap_eligible: input.currentEnSitemapEligible,
    en_sitemap_eligible_delta:
      input.currentEnSitemapEligible - previousEnSitemapEligible,
  }
}

/** Guard against comparing content counts to sitemap counts in delta fields. */
export function assertNoCrossFilterDeltas(metrics: ValidateI18nContentMetrics): void {
  const misleadingContentVsSitemap =
    metrics.en_sitemap_eligible_delta ===
    metrics.current_en_sitemap_eligible - metrics.previous_computed_en_content

  const misleadingSitemapVsContent =
    metrics.computed_en_content_delta ===
    metrics.current_computed_en_content - metrics.previous_en_sitemap_eligible

  if (misleadingContentVsSitemap || misleadingSitemapVsContent) {
    throw new Error('Delta fields must not compare content and sitemap filter sets')
  }
}

export function parseOptionalIntEnv(name: string): number | undefined {
  const raw = process.env[name]?.trim()
  if (!raw) return undefined
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) ? value : undefined
}
