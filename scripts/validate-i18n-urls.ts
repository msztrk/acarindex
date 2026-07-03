/**
 * TR/EN slug, content availability, sitemap and hreflang validation.
 *
 * Usage: npx tsx --env-file=.env.local scripts/validate-i18n-urls.ts
 */
import { prisma, disconnectPrisma } from '../lib/db/prisma'
import { buildArticlePath } from '../lib/i18n/slugs'
import {
  computeArticleHasEnContent,
  hasEnglishArticleContent,
} from '../lib/i18n/content-availability'
import { publishedEnglishArticleWhere } from '../lib/i18n/prisma-english-content'

const PAGE_SIZE = 5000

async function main() {
  const [
    articlesTotal,
    articlesWithSlugEn,
    articlesWithRealEnglishContent,
    articlesWithoutRealEnglishContent,
    englishSitemapEligible,
    flagMismatch,
    duplicateEnSlugs,
    excludedFallbackSlugUrls,
  ] = await Promise.all([
    prisma.article.count({ where: { status: 'published' } }),
    prisma.article.count({
      where: { status: 'published', slugEn: { not: null } },
    }),
    prisma.article.count({ where: publishedEnglishArticleWhere }),
    prisma.article.count({
      where: { status: 'published', hasEnContent: false },
    }),
    prisma.article.count({ where: publishedEnglishArticleWhere }),
    prisma.article.count({
      where: {
        status: 'published',
        OR: [
          {
            hasEnContent: true,
            NOT: {
              AND: [
                { titleEn: { not: null } },
                {
                  OR: [
                    { abstractEn: { not: null } },
                    { language: { startsWith: 'en', mode: 'insensitive' } },
                    { documentLanguage: { startsWith: 'en', mode: 'insensitive' } },
                  ],
                },
              ],
            },
          },
          { hasEnContent: false, titleEn: { not: null } },
        ],
      },
    }),
    prisma.$queryRaw<{ slug_en: string; n: bigint }[]>`
      SELECT slug_en, COUNT(*) AS n FROM articles
      WHERE status = 'published' AND slug_en IS NOT NULL AND has_en_content = true
      GROUP BY slug_en HAVING COUNT(*) > 1 LIMIT 10`,
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM articles
      WHERE status = 'published'
        AND has_en_content = false
        AND slug_en IS NOT NULL
        AND slug_tr IS NOT NULL
        AND slug_en = slug_tr`,
  ])

  const enSitemapWithoutContent = await prisma.article.count({
    where: {
      status: 'published',
      hasEnContent: false,
      slugEn: { not: null },
    },
  })

  const contentButNotInEnSitemap = await prisma.article.count({
    where: {
      status: 'published',
      hasEnContent: true,
    },
  })

  const sampleMismatch = await prisma.article.findMany({
    where: { status: 'published' },
    take: 500,
    orderBy: { id: 'desc' },
    select: {
      id: true,
      slugTr: true,
      slugEn: true,
      titleEn: true,
      abstractEn: true,
      language: true,
      documentLanguage: true,
      hasEnContent: true,
    },
  })

  let hreflangWouldIncludeEnWithoutContent = 0
  let computedFlagDrift = 0
  for (const row of sampleMismatch) {
    const computed = computeArticleHasEnContent({
      titleEn: row.titleEn,
      abstractEn: row.abstractEn,
      language: row.language,
      documentLanguage: row.documentLanguage,
    })
    if (computed !== row.hasEnContent) computedFlagDrift++
    if (!computed && row.slugEn) hreflangWouldIncludeEnWithoutContent++
  }

  const sampleEn = await prisma.article.findMany({
    where: publishedEnglishArticleWhere,
    take: 5,
    orderBy: { id: 'desc' },
    select: {
      id: true,
      slug: true,
      slugTr: true,
      slugEn: true,
      legacyJournalSlug: true,
      legacyJournalSlugEn: true,
      titleTr: true,
      titleEn: true,
      hasEnContent: true,
    },
  })

  const samplePaths = sampleEn.map((a) => ({
    id: Number(a.id),
    tr: buildArticlePath(
      {
        id: Number(a.id),
        slug: a.slug,
        slugTr: a.slugTr,
        slugEn: a.slugEn,
        legacyJournalSlug: a.legacyJournalSlug,
        legacyJournalSlugEn: a.legacyJournalSlugEn,
      },
      'tr',
    ),
    en: buildArticlePath(
      {
        id: Number(a.id),
        slug: a.slug,
        slugTr: a.slugTr,
        slugEn: a.slugEn,
        legacyJournalSlug: a.legacyJournalSlug,
        legacyJournalSlugEn: a.legacyJournalSlugEn,
      },
      'en',
    ),
    hasRealEnglishContent: hasEnglishArticleContent({
      titleEn: a.titleEn,
      hasEnContent: a.hasEnContent,
    }),
  }))

  const enPageCount = Math.ceil(englishSitemapEligible / PAGE_SIZE)

  const report = {
    total_published_articles: articlesTotal,
    articles_with_slug_en: articlesWithSlugEn,
    articles_with_real_english_content: articlesWithRealEnglishContent,
    articles_without_real_english_content: articlesWithoutRealEnglishContent,
    english_indexable_urls: englishSitemapEligible,
    english_sitemap_urls: englishSitemapEligible,
    english_sitemap_pages: enPageCount,
    english_hreflang_urls: englishSitemapEligible,
    excluded_fallback_slug_urls: Number(excludedFallbackSlugUrls[0]?.n ?? 0),
    checks: {
      en_sitemap_without_english_content: enSitemapWithoutContent,
      hreflang_en_without_content_sample: hreflangWouldIncludeEnWithoutContent,
      english_content_missing_from_en_sitemap:
        contentButNotInEnSitemap === englishSitemapEligible ? 0 : Math.abs(contentButNotInEnSitemap - englishSitemapEligible),
      flag_content_drift_sample: computedFlagDrift,
      duplicate_en_slug_groups: duplicateEnSlugs.map((r) => ({
        slug_en: r.slug_en,
        count: Number(r.n),
      })),
      coarse_flag_mismatch: flagMismatch,
    },
    samplePaths,
    ok:
      enSitemapWithoutContent === 0 &&
      duplicateEnSlugs.length === 0 &&
      contentButNotInEnSitemap === englishSitemapEligible &&
      computedFlagDrift === 0,
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
