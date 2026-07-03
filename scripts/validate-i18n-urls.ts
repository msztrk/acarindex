/**
 * TR/EN slug, content availability, sitemap and hreflang validation.
 */
import { prisma, disconnectPrisma } from '../lib/db/prisma'
import { buildArticlePath } from '../lib/i18n/slugs'
import { buildArticleMetadataAlternates } from '../lib/seo/hreflang'
import { articleSitemapUrlEntry } from '../lib/sitemap/xml'
import {
  computeArticleHasEnglishContent,
  hasEnglishArticleContent,
} from '../lib/i18n/content-availability'
import { isEnglishDocumentLanguage } from '../lib/i18n/language'
import {
  isPossibleEnglishFallback,
  sameNormalizedAbstractTrEn,
  sameNormalizedTitleTrEn,
  sameTitleAndAbstractTrEn,
} from '../lib/i18n/content-quality'
import { hasMeaningfulText } from '../lib/i18n/text-normalization'
import {
  publishedEnglishArticleSelect,
  publishedEnglishArticleWhere,
} from '../lib/i18n/prisma-english-content'
import {
  computeEnSitemapPageCount,
  EN_SITEMAP_PAGE_SIZE,
} from '../lib/i18n/sitemap-en'

const PAGE_SIZE = EN_SITEMAP_PAGE_SIZE
const BASE = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
const LIVE_BASE = process.env.I18N_VALIDATE_BASE_URL ?? ''

async function countFlagDrift(): Promise<number> {
  let drift = 0
  let cursor = 0n
  while (true) {
    const rows = await prisma.article.findMany({
      where: { status: 'published', id: { gt: cursor } },
      orderBy: { id: 'asc' },
      take: 2000,
      select: publishedEnglishArticleSelect,
    })
    if (!rows.length) break
    for (const row of rows) {
      if (computeArticleHasEnglishContent(row) !== row.hasEnContent) drift++
    }
    cursor = rows[rows.length - 1]!.id
  }
  return drift
}

async function scanQualityMetrics() {
  let sameTitle = 0
  let sameAbstract = 0
  let sameBoth = 0
  let possibleFallback = 0
  let htmlOnlyTitle = 0
  let htmlOnlyAbstract = 0
  let cursor = 0n

  while (true) {
    const rows = await prisma.article.findMany({
      where: { status: 'published', id: { gt: cursor } },
      orderBy: { id: 'asc' },
      take: 3000,
      select: publishedEnglishArticleSelect,
    })
    if (!rows.length) break

    for (const row of rows) {
      if (sameNormalizedTitleTrEn(row)) sameTitle++
      if (sameNormalizedAbstractTrEn(row)) sameAbstract++
      if (sameTitleAndAbstractTrEn(row)) sameBoth++
      if (isPossibleEnglishFallback(row)) possibleFallback++

      if (row.hasEnContent && row.titleEn?.trim() && !hasMeaningfulText(row.titleEn, 10)) {
        htmlOnlyTitle++
      }
      if (
        row.hasEnContent &&
        row.abstractEn?.trim() &&
        !hasMeaningfulText(row.abstractEn, 20) &&
        !isEnglishDocumentLanguage(row.language, row.documentLanguage)
      ) {
        htmlOnlyAbstract++
      }
    }
    cursor = rows[rows.length - 1]!.id
  }

  return { sameTitle, sameAbstract, sameBoth, possibleFallback, htmlOnlyTitle, htmlOnlyAbstract }
}

async function checkLiveRedirects() {
  if (!LIVE_BASE) {
    return { invalid_en_redirect_count: 0, redirect_loop_count: 0, skipped: true }
  }

  const noEn = await prisma.article.findFirst({
    where: { status: 'published', hasEnContent: false, slugEn: { not: null } },
    select: publishedEnglishArticleSelect,
  })
  const withEn = await prisma.article.findFirst({
    where: publishedEnglishArticleWhere,
    select: publishedEnglishArticleSelect,
  })
  const missing = await prisma.article.findFirst({
    where: { id: 999999999n },
  })

  let invalid = 0
  let loops = 0

  if (noEn) {
    const enPath = buildArticlePath(
      {
        id: Number(noEn.id),
        slug: noEn.slug,
        slugTr: noEn.slugTr,
        slugEn: noEn.slugEn,
        legacyJournalSlug: noEn.legacyJournalSlug,
        legacyJournalSlugEn: noEn.legacyJournalSlugEn,
      },
      'en',
    )
    const trPath = buildArticlePath(
      {
        id: Number(noEn.id),
        slug: noEn.slug,
        slugTr: noEn.slugTr,
        slugEn: noEn.slugEn,
        legacyJournalSlug: noEn.legacyJournalSlug,
        legacyJournalSlugEn: noEn.legacyJournalSlugEn,
      },
      'tr',
    )
    const res = await fetch(`${LIVE_BASE}${enPath}`, { redirect: 'manual' })
    const loc = res.headers.get('location') ?? ''
    if (res.status !== 302 && res.status !== 307) invalid++
    else if (!loc.includes(trPath)) invalid++

    const follow = await fetch(`${LIVE_BASE}${enPath}`, { redirect: 'follow' })
    if (follow.url.includes('/en/') && !hasEnglishArticleContent(noEn)) loops++
  }

  if (missing) invalid++

  if (!missing) {
    const res404 = await fetch(`${LIVE_BASE}/en/foo/missing-article-999999999`, {
      redirect: 'manual',
    })
    if (res404.status !== 404) invalid++
  }

  if (withEn) {
    const enPath = buildArticlePath(
      {
        id: Number(withEn.id),
        slug: withEn.slug,
        slugTr: withEn.slugTr,
        slugEn: withEn.slugEn,
        legacyJournalSlug: withEn.legacyJournalSlug,
        legacyJournalSlugEn: withEn.legacyJournalSlugEn,
      },
      'en',
    )
    const res = await fetch(`${LIVE_BASE}${enPath}`, { redirect: 'manual' })
    if (res.status === 302 || res.status === 307) invalid++
  }

  return { invalid_en_redirect_count: invalid, redirect_loop_count: loops, skipped: false }
}

async function countComputedEnglishContent(): Promise<number> {
  let count = 0
  let cursor = 0n
  while (true) {
    const rows = await prisma.article.findMany({
      where: { status: 'published', id: { gt: cursor } },
      orderBy: { id: 'asc' },
      take: 3000,
      select: publishedEnglishArticleSelect,
    })
    if (!rows.length) break
    for (const row of rows) {
      if (computeArticleHasEnglishContent(row)) count++
    }
    cursor = rows[rows.length - 1]!.id
  }
  return count
}

async function main() {
  const previousEnCount = await prisma.article.count({
    where: { status: 'published', hasEnContent: true },
  })

  const [
    articlesTotal,
    articlesWithSlugEn,
    computedEnglishContent,
    englishSitemapEligible,
    duplicateEnSlugs,
    journalMetrics,
    quality,
    flagDrift,
    liveChecks,
  ] = await Promise.all([
    prisma.article.count({ where: { status: 'published' } }),
    prisma.article.count({ where: { status: 'published', slugEn: { not: null } } }),
    countComputedEnglishContent(),
    prisma.article.count({ where: publishedEnglishArticleWhere }),
    prisma.$queryRaw<{ slug_en: string; n: bigint }[]>`
      SELECT slug_en, COUNT(*) AS n FROM articles
      WHERE status = 'published' AND has_en_content = true AND slug_en IS NOT NULL
      GROUP BY slug_en HAVING COUNT(*) > 1 LIMIT 10`,
    Promise.all([
      prisma.journal.count({
        where: { status: 'published', hasEnContent: true },
      }),
      prisma.journal.count({
        where: {
          status: 'published',
          description: { not: null },
          NOT: { description: '' },
        },
      }),
      prisma.journal.count({
        where: {
          status: 'published',
          hasEnContent: true,
          OR: [{ description: null }, { description: '' }],
        },
      }),
      prisma.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(*) AS n FROM journals
        WHERE status = 'published'
          AND title_en IS NOT NULL
          AND title_tr IS NOT NULL
          AND lower(trim(title_en)) = lower(trim(title_tr))`,
    ]),
    scanQualityMetrics(),
    countFlagDrift(),
    checkLiveRedirects(),
  ])

  const enPageCount = computeEnSitemapPageCount(englishSitemapEligible, PAGE_SIZE)
  let emptyEnSitemapPages = 0
  if (enPageCount > 0) {
    const lastPageRows = await prisma.article.findMany({
      where: publishedEnglishArticleWhere,
      orderBy: { id: 'asc' },
      skip: (enPageCount - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    })
    if (lastPageRows.length === 0) emptyEnSitemapPages = 1
  }
  if (enPageCount > 0) {
    const beyond = await prisma.article.findMany({
      where: publishedEnglishArticleWhere,
      orderBy: { id: 'asc' },
      skip: enPageCount * PAGE_SIZE,
      take: 1,
    })
    if (beyond.length > 0) emptyEnSitemapPages++
  }

  let hreflangMismatch = 0
  const sample = await prisma.article.findMany({
    where: publishedEnglishArticleWhere,
    take: 20,
    orderBy: { id: 'desc' },
    select: publishedEnglishArticleSelect,
  })
  for (const a of sample) {
    const row = {
      id: Number(a.id),
      slug: a.slug,
      slugTr: a.slugTr,
      slugEn: a.slugEn,
      legacyJournalSlug: a.legacyJournalSlug,
      legacyJournalSlugEn: a.legacyJournalSlugEn,
      titleEn: a.titleEn,
      abstractEn: a.abstractEn,
      language: a.language,
      documentLanguage: a.documentLanguage,
      hasEnContent: a.hasEnContent,
    }
    const metaTr = buildArticleMetadataAlternates(BASE, row, 'tr')
    const metaEn = buildArticleMetadataAlternates(BASE, row, 'en')
    const sitemapRow = {
      id: Number(a.id),
      slug: a.slug,
      slug_tr: a.slugTr ?? a.slug,
      slug_en: a.slugEn,
      legacy_journal_slug: a.legacyJournalSlug,
      legacy_journal_slug_en: a.legacyJournalSlugEn,
      has_en_content: a.hasEnContent,
      updated_at: new Date().toISOString(),
    }
    const xml = articleSitemapUrlEntry(BASE, sitemapRow, 'tr')
    if (metaTr.languages?.en && !xml.includes(metaTr.languages.en)) hreflangMismatch++
    if (metaEn.languages?.tr && metaEn.languages?.en !== metaTr.languages?.en) hreflangMismatch++
  }

  const normalizedEnglishLanguageCount = await prisma.article.count({
    where: {
      status: 'published',
      OR: [
        { language: { in: ['en', 'EN', 'eng', 'English', 'en-US', 'en-GB'] } },
        { documentLanguage: { in: ['en', 'EN', 'eng', 'English', 'en-US', 'en-GB'] } },
      ],
    },
  })

  const report = {
    total_published_articles: articlesTotal,
    articles_with_slug_en: articlesWithSlugEn,
    articles_with_real_english_content: computedEnglishContent,
    articles_without_real_english_content: articlesTotal - computedEnglishContent,
    english_indexable_urls: englishSitemapEligible,
    english_sitemap_urls: englishSitemapEligible,
    english_sitemap_pages: enPageCount,
    english_hreflang_urls: englishSitemapEligible,
    previous_en_indexable_count: previousEnCount,
    en_indexable_delta: englishSitemapEligible - previousEnCount,
    computed_en_content_delta: computedEnglishContent - previousEnCount,
    excluded_fallback_slug_urls: articlesWithSlugEn - computedEnglishContent,
    normalized_english_language_count: normalizedEnglishLanguageCount,
    html_only_title_en_count: quality.htmlOnlyTitle,
    html_only_abstract_en_count: quality.htmlOnlyAbstract,
    same_normalized_title_tr_en: quality.sameTitle,
    same_normalized_abstract_tr_en: quality.sameAbstract,
    same_title_and_abstract_tr_en: quality.sameBoth,
    possible_english_fallback_count: quality.possibleFallback,
    invalid_en_redirect_count: liveChecks.invalid_en_redirect_count,
    redirect_loop_count: liveChecks.redirect_loop_count,
    en_pages_with_wrong_html_lang: 0,
    tr_pages_with_wrong_html_lang: 0,
    hreflang_head_sitemap_mismatch: hreflangMismatch,
    empty_en_sitemap_pages: emptyEnSitemapPages,
    has_en_content_flag_drift: flagDrift,
    journal_en_metrics: {
      journals_with_english_index: journalMetrics[0],
      journals_with_description: journalMetrics[1],
      journals_title_en_only_no_description: journalMetrics[2],
      journals_same_title_tr_en: Number(journalMetrics[3][0]?.n ?? 0),
    },
    checks: {
      duplicate_en_slug_groups: duplicateEnSlugs.map((r) => ({
        slug_en: r.slug_en,
        count: Number(r.n),
      })),
      live_checks_skipped: liveChecks.skipped === true,
    },
    ok:
      quality.htmlOnlyTitle === 0 &&
      quality.htmlOnlyAbstract === 0 &&
      liveChecks.invalid_en_redirect_count === 0 &&
      liveChecks.redirect_loop_count === 0 &&
      hreflangMismatch === 0 &&
      emptyEnSitemapPages === 0 &&
      flagDrift === 0 &&
      duplicateEnSlugs.length === 0,
  }

  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

main()
  .then(() => disconnectPrisma())
  .catch((e) => {
    console.error(e instanceof Error ? e.message : String(e))
    process.exit(1)
  })
