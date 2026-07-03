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
    excludedFallbackSlugUrls,
    duplicateEnSlugs,
    flagDrift,
  ] = await Promise.all([
    prisma.article.count({ where: { status: 'published' } }),
    prisma.article.count({
      where: { status: 'published', slugEn: { not: null } },
    }),
    prisma.article.count({ where: publishedEnglishArticleWhere }),
    prisma.article.count({
      where: { status: 'published', hasEnContent: false },
    }),
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM articles
      WHERE status = 'published'
        AND has_en_content = false
        AND slug_en IS NOT NULL
        AND slug_tr IS NOT NULL
        AND slug_en = slug_tr`,
    prisma.$queryRaw<{ slug_en: string; n: bigint }[]>`
      SELECT slug_en, COUNT(*) AS n FROM articles
      WHERE status = 'published' AND has_en_content = true AND slug_en IS NOT NULL
      GROUP BY slug_en HAVING COUNT(*) > 1 LIMIT 10`,
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM articles
      WHERE status = 'published'
        AND has_en_content IS DISTINCT FROM (
          title_en IS NOT NULL
          AND char_length(trim(title_en)) >= 10
          AND (
            (abstract_en IS NOT NULL AND char_length(trim(abstract_en)) >= 20)
            OR lower(trim(coalesce(nullif(trim(document_language), ''), nullif(trim(language), ''), ''))) LIKE 'en%'
          )
        )`,
    prisma.article.count({
      where: {
        status: 'published',
        hasEnContent: false,
        titleEn: { not: null },
        OR: [
          { abstractEn: { not: null } },
          { language: { startsWith: 'en', mode: 'insensitive' } },
          { documentLanguage: { startsWith: 'en', mode: 'insensitive' } },
        ],
      },
    }),
  ])

  const sampleCheck = await prisma.article.findMany({
    where: { status: 'published' },
    take: 500,
    orderBy: { id: 'desc' },
    select: {
      titleEn: true,
      abstractEn: true,
      language: true,
      documentLanguage: true,
      hasEnContent: true,
      slugEn: true,
    },
  })

  let hreflangWouldIncludeEnWithoutContent = 0
  for (const row of sampleCheck) {
    const computed = computeArticleHasEnContent(row)
    if (!computed && row.slugEn && row.hasEnContent) {
      hreflangWouldIncludeEnWithoutContent++
    }
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
      abstractEn: true,
      language: true,
      documentLanguage: true,
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
      abstractEn: a.abstractEn,
      language: a.language,
      documentLanguage: a.documentLanguage,
      hasEnContent: a.hasEnContent,
    }),
  }))

  const englishSitemapEligible = articlesWithRealEnglishContent
  const enPageCount = englishSitemapEligible > 0 ? Math.ceil(englishSitemapEligible / PAGE_SIZE) : 0

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
      en_sitemap_includes_non_english_content: enSetIncludesNonContent,
      hreflang_flag_mismatch_sample: hreflangWouldIncludeEnWithoutContent,
      has_en_content_flag_drift: Number(flagDrift[0]?.n ?? 0),
      duplicate_en_slug_groups: duplicateEnSlugs.map((r) => ({
        slug_en: r.slug_en,
        count: Number(r.n),
      })),
    },
    samplePaths,
    ok:
      enSetIncludesNonContent === 0 &&
      Number(flagDrift[0]?.n ?? 0) === 0 &&
      duplicateEnSlugs.length === 0 &&
      hreflangWouldIncludeEnWithoutContent === 0,
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
