/**
 * TR/EN slug and URL validation after ETL.
 *
 * Usage: npx tsx --env-file=.env.local scripts/validate-i18n-urls.ts
 */
import { prisma, disconnectPrisma } from '../lib/db/prisma'
import { buildArticlePath } from '../lib/i18n/slugs'

async function main() {
  const [
    journals,
    articlesTotal,
    articlesWithEn,
    articlesMissingSlugTr,
    duplicateEnSlugs,
  ] = await Promise.all([
    prisma.journal.count({ where: { status: 'published' } }),
    prisma.article.count({ where: { status: 'published' } }),
    prisma.article.count({ where: { status: 'published', slugEn: { not: null } } }),
    prisma.article.count({
      where: { status: 'published', OR: [{ slugTr: null }, { slugTr: '' }] },
    }),
    prisma.$queryRaw<{ slug_en: string; n: bigint }[]>`
      SELECT slug_en, COUNT(*) AS n FROM articles
      WHERE status = 'published' AND slug_en IS NOT NULL
      GROUP BY slug_en HAVING COUNT(*) > 1 LIMIT 10`,
  ])

  const sampleEn = await prisma.article.findMany({
    where: { status: 'published', slugEn: { not: null } },
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
    hasTitleEn: !!a.titleEn?.trim(),
  }))

  const report = {
    journalsPublished: journals,
    articlesPublished: articlesTotal,
    articlesWithEnglishSlug: articlesWithEn,
    articlesMissingSlugTr,
    duplicateEnSlugGroups: duplicateEnSlugs.map((r) => ({
      slug_en: r.slug_en,
      count: Number(r.n),
    })),
    samplePaths,
    ok:
      articlesMissingSlugTr === 0 &&
      duplicateEnSlugs.length === 0 &&
      articlesWithEn > 0,
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
