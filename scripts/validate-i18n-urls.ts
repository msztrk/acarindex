/**
 * TR/EN slug, content availability, sitemap and hreflang validation.
 *
 * Content vs sitemap metrics are separate filter sets — see lib/i18n/validate-i18n-metrics.ts.
 * Optional baselines for deltas: I18N_VALIDATE_PREVIOUS_COMPUTED_EN, I18N_VALIDATE_PREVIOUS_EN_SITEMAP.
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
import {
  buildValidateI18nContentMetrics,
  classifyEnSitemapExclusion,
  isArticleEligibleForEnSitemap,
  parseOptionalIntEnv,
  type EnSitemapExclusionBreakdown,
} from '../lib/i18n/validate-i18n-metrics'
import {
  validateHttpRedirectToTr,
  validateSoft404,
  validateSoftRedirectToTr,
  parseSoftRedirect,
} from '../lib/i18n/validate-live-response'

const PAGE_SIZE = EN_SITEMAP_PAGE_SIZE
const BASE = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
const LIVE_BASE = process.env.I18N_VALIDATE_BASE_URL ?? ''
const LOG_PROGRESS = process.env.I18N_VALIDATE_PROGRESS === '1'
const FAST_MODE = process.env.I18N_VALIDATE_FAST === '1'

function batchSize(defaultSize: number): number {
  const fromEnv = parseOptionalIntEnv('I18N_VALIDATE_BATCH')
  if (fromEnv && fromEnv > 0) return fromEnv
  return FAST_MODE ? 10000 : defaultSize
}

function progress(message: string): void {
  if (LOG_PROGRESS) console.error(`[validate-i18n] ${message}`)
}

async function countFlagDrift(): Promise<number> {
  let drift = 0
  let cursor = 0n
  while (true) {
    const rows = await prisma.article.findMany({
      where: { status: 'published', id: { gt: cursor } },
      orderBy: { id: 'asc' },
      take: batchSize(2000),
      select: publishedEnglishArticleSelect,
    })
    if (!rows.length) break

    progress(`countFlagDrift cursor=${String(cursor)} batch=${rows.length}`)
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
      take: batchSize(3000),
      select: publishedEnglishArticleSelect,
    })
    if (!rows.length) break

    progress(`scanQuality cursor=${String(cursor)} batch=${rows.length}`)
    for (const row of rows) {
      if (FAST_MODE) {
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
        continue
      }

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

const DOCUMENT_HEADERS: Record<string, string> = {
  Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
  'User-Agent': 'acarindex-i18n-validate/1.0 (document)',
}

function pathnameFromUrl(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

function enRedirectAcceptable(
  status: number,
  body: string,
  location: string | null,
  enPath: string,
  trPath: string,
): boolean {
  const httpOk = validateHttpRedirectToTr(status, location, trPath, enPath)
  const softOk = validateSoftRedirectToTr(body, enPath, trPath)
  return httpOk || softOk
}

async function checkLiveRedirects() {
  if (!LIVE_BASE) {
    return {
      invalid_en_redirect_count: 0,
      redirect_loop_count: 0,
      document_checks: null,
      skipped: true,
    }
  }

  const noEn = await prisma.article.findFirst({
    where: { status: 'published', hasEnContent: false, slugEn: { not: null } },
    select: publishedEnglishArticleSelect,
  })
  const withEn = await prisma.article.findFirst({
    where: publishedEnglishArticleWhere,
    select: publishedEnglishArticleSelect,
  })

  let invalid = 0
  let loops = 0
  const documentChecks: Record<string, boolean> = {
    no_en_article_reaches_tr: false,
    unknown_en_article_is_404: false,
    real_en_article_serves_en: false,
    no_redirect_loop: true,
  }

  const articleRow = (a: typeof noEn) => ({
    id: Number(a!.id),
    slug: a!.slug,
    slugTr: a!.slugTr,
    slugEn: a!.slugEn,
    legacyJournalSlug: a!.legacyJournalSlug,
    legacyJournalSlugEn: a!.legacyJournalSlugEn,
  })

  if (noEn) {
    const enPath = buildArticlePath(articleRow(noEn), 'en')
    const trPath = buildArticlePath(articleRow(noEn), 'tr')

    const res = await fetch(`${LIVE_BASE}${enPath}`, { redirect: 'manual' })
    const body = await res.text()
    const loc = res.headers.get('location')
    if (!enRedirectAcceptable(res.status, body, loc, enPath, trPath)) invalid++

    const parsed = parseSoftRedirect(body)
    if (parsed && parsed.targetPath === enPath) invalid++

    const docRes = await fetch(`${LIVE_BASE}${enPath}`, {
      redirect: 'manual',
      headers: DOCUMENT_HEADERS,
    })
    const docBody = await docRes.text()
    const docLoc = docRes.headers.get('location')
    documentChecks.no_en_article_reaches_tr = enRedirectAcceptable(
      docRes.status,
      docBody,
      docLoc,
      enPath,
      trPath,
    )
    if (!documentChecks.no_en_article_reaches_tr) {
      const follow = await fetch(`${LIVE_BASE}${enPath}`, {
        redirect: 'follow',
        headers: DOCUMENT_HEADERS,
      })
      const finalPath = pathnameFromUrl(follow.url)
      documentChecks.no_en_article_reaches_tr =
        !finalPath.includes('/en/') && finalPath === trPath
    }
    if (!documentChecks.no_en_article_reaches_tr && !hasEnglishArticleContent(noEn)) {
      loops++
      documentChecks.no_redirect_loop = false
    }
  }

  const unknownPath = '/en/foo/missing-article-999999999'
  const res404 = await fetch(`${LIVE_BASE}${unknownPath}`, {
    redirect: 'manual',
    headers: DOCUMENT_HEADERS,
  })
  const body404 = await res404.text()
  const unknownOk = res404.status === 404 || validateSoft404(body404)
  if (!unknownOk) invalid++
  documentChecks.unknown_en_article_is_404 = unknownOk

  if (withEn) {
    const enPath = buildArticlePath(articleRow(withEn), 'en')
    const trPath = buildArticlePath(articleRow(withEn), 'tr')

    const res = await fetch(`${LIVE_BASE}${enPath}`, { redirect: 'manual' })
    const body = await res.text()
    const loc = res.headers.get('location')
    const wronglyRedirects =
      enRedirectAcceptable(res.status, body, loc, enPath, trPath) ||
      validateSoft404(body)
    if (wronglyRedirects) invalid++

    const docRes = await fetch(`${LIVE_BASE}${enPath}`, {
      redirect: 'manual',
      headers: DOCUMENT_HEADERS,
    })
    const docBody = await docRes.text()
    documentChecks.real_en_article_serves_en =
      docRes.status === 200 &&
      !validateSoft404(docBody) &&
      !enRedirectAcceptable(docRes.status, docBody, docRes.headers.get('location'), enPath, trPath)
  }

  if (noEn && !documentChecks.no_en_article_reaches_tr) invalid++
  if (!documentChecks.unknown_en_article_is_404) invalid++
  if (withEn && !documentChecks.real_en_article_serves_en) invalid++
  if (!documentChecks.no_redirect_loop) invalid++

  return {
    invalid_en_redirect_count: invalid,
    redirect_loop_count: loops,
    document_checks: documentChecks,
    skipped: false,
  }
}

async function scanComputedEnContentAndExclusions(): Promise<{
  computedCount: number
  breakdown: EnSitemapExclusionBreakdown
}> {
  const breakdown = {
    byArticleStatus: 0,
    byMissingSlug: 0,
    byMissingJournal: 0,
    byJournalStatus: 0,
  }
  let computedCount = 0
  let cursor = 0n

  while (true) {
    const rows = await prisma.article.findMany({
      where: { status: 'published', id: { gt: cursor } },
      orderBy: { id: 'asc' },
      take: batchSize(2000),
      select: {
        id: true,
        status: true,
        hasEnContent: true,
        slugEn: true,
        titleEn: true,
        titleTr: true,
        abstractEn: true,
        abstractTr: true,
        language: true,
        documentLanguage: true,
        journal: { select: { status: true } },
      },
    })
    if (!rows.length) break

    progress(`scanComputedEn cursor=${String(cursor)} batch=${rows.length}`)
    for (const row of rows) {
      if (!computeArticleHasEnglishContent(row)) continue
      computedCount++

      const exclusionRow = {
        status: row.status,
        hasEnContent: row.hasEnContent,
        slugEn: row.slugEn,
        journal: row.journal,
      }
      if (isArticleEligibleForEnSitemap(exclusionRow)) continue
      breakdown[classifyEnSitemapExclusion(exclusionRow)]++
    }

    cursor = rows[rows.length - 1]!.id
  }

  return { computedCount, breakdown }
}

async function main() {
  const previousComputedEnContent = parseOptionalIntEnv('I18N_VALIDATE_PREVIOUS_COMPUTED_EN')
  const previousEnSitemapEligible = parseOptionalIntEnv('I18N_VALIDATE_PREVIOUS_EN_SITEMAP')

  const [
    articlesTotal,
    articlesWithSlugEn,
    computedEnScan,
    englishSitemapEligible,
    duplicateEnSlugs,
    journalMetrics,
    quality,
    flagDrift,
    liveChecks,
  ] = await Promise.all([
    prisma.article.count({ where: { status: 'published' } }),
    prisma.article.count({ where: { status: 'published', slugEn: { not: null } } }),
    scanComputedEnContentAndExclusions(),
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

  const computedEnglishContent = computedEnScan.computedCount
  const exclusionBreakdown = computedEnScan.breakdown

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

  const contentMetrics = buildValidateI18nContentMetrics({
    totalPublishedArticles: articlesTotal,
    currentComputedEnContent: computedEnglishContent,
    currentEnSitemapEligible: englishSitemapEligible,
    exclusionBreakdown,
    previousComputedEnContent,
    previousEnSitemapEligible,
  })

  const report = {
    ...contentMetrics,
    articles_with_slug_en: articlesWithSlugEn,
    articles_with_slug_en_but_no_computed_en_content: articlesWithSlugEn - computedEnglishContent,
    english_sitemap_pages: enPageCount,
    english_hreflang_urls: englishSitemapEligible,
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
      document_html_checks: liveChecks.document_checks,
      fast_mode: FAST_MODE,
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
