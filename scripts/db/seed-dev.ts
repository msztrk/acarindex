/**
 * Development fixture seed — GERÇEK AcarIndex verisi değildir.
 *
 * Varsayılan: dry-run (veritabanına yazmaz).
 * Yazmak için: npm run db:seed:dev -- --write
 *
 * Production ortamında çalışması engellenir (ALLOW_DEV_SEED=1 hariç).
 */
import { prisma } from '@/lib/db/prisma'

export const DEV_FIXTURE_MARKER = 'dev-fixture'
export const DEV_SEED_RUN_ID = 'dev-fixture-seed-v1'

const JOURNAL_COUNT = 10
const ISSUES_PER_JOURNAL = 3
const ARTICLES_TOTAL = 300

const CATEGORY_IDS = [99001, 99002]
const JOURNAL_ID_START = 9910001
const ISSUE_ID_START = 9920001
const ARTICLE_ID_START = 9930001

const LONG_TITLE_TR =
  'Çok uzun başlık örneği: Türkiye\'de sosyal bilimler alanında yapılan araştırmaların metodolojik yaklaşımları ve disiplinler arası etkileşim dinamikleri üzerine kapsamlı bir değerlendirme'
const LONG_TITLE_EN =
  'An exceptionally long English title examining methodological approaches and interdisciplinary dynamics in social science research across multiple institutional contexts'

const LONG_AUTHORS =
  'Yazar Bir, Yazar İkinci, Yazar Üçüncü, Yazar Dördüncü, Yazar Beşinci, Yazar Altıncı, Yazar Yedinci, Yazar Sekizinci, Yazar Dokuzuncu, Yazar Onuncu'

export function assertSeedAllowed() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_SEED !== '1') {
    throw new Error(
      'Development fixture seed production ortamında çalıştırılamaz. ALLOW_DEV_SEED=1 yalnızca acil test için.',
    )
  }
}

export async function isDevFixturePresent(): Promise<boolean> {
  const count = await prisma.journal.count({
    where: { slug: { startsWith: `${DEV_FIXTURE_MARKER}-j-` } },
  })
  return count > 0
}

export function describeDevFixturePlan() {
  return {
    marker: DEV_FIXTURE_MARKER,
    disclaimer: 'Synthetic development fixture — not real AcarIndex catalog data',
    journals: JOURNAL_COUNT,
    issues: JOURNAL_COUNT * ISSUES_PER_JOURNAL,
    articles: ARTICLES_TOTAL,
    categories: CATEGORY_IDS.length,
    features: [
      'single and multi-author',
      'long titles (TR/EN)',
      'DOI and no-DOI',
      'PDF and no-PDF',
      'missing abstract',
      'long author lists',
      'empty issue',
      'provisional authors',
      'article_authors relations',
    ],
  }
}

async function upsertCategories() {
  for (let i = 0; i < CATEGORY_IDS.length; i++) {
    const id = CATEGORY_IDS[i]
    await prisma.category.upsert({
      where: { id: BigInt(id) },
      create: {
        id: BigInt(id),
        nameTr: `Geliştirme Kategori ${i + 1}`,
        nameEn: `Development Category ${i + 1}`,
        slug: `${DEV_FIXTURE_MARKER}-cat-${i + 1}`,
        active: true,
      },
      update: {
        nameTr: `Geliştirme Kategori ${i + 1}`,
        nameEn: `Development Category ${i + 1}`,
        active: true,
      },
    })
  }
}

async function upsertJournals() {
  for (let j = 0; j < JOURNAL_COUNT; j++) {
    const id = JOURNAL_ID_START + j
    const slug = `${DEV_FIXTURE_MARKER}-j-${j + 1}`
    await prisma.journal.upsert({
      where: { id: BigInt(id) },
      create: {
        id: BigInt(id),
        slug,
        titleTr: `Geliştirme Dergisi ${j + 1}`,
        titleEn: `Development Journal ${j + 1}`,
        issn: j % 2 === 0 ? `2999-${String(j).padStart(4, '0')}` : null,
        publisher: 'Dev Fixture Press',
        categoryId: BigInt(CATEGORY_IDS[j % CATEGORY_IDS.length]),
        status: 'published',
      },
      update: {
        titleTr: `Geliştirme Dergisi ${j + 1}`,
        status: 'published',
      },
    })
  }
}

async function upsertIssues() {
  let issueIdx = 0
  for (let j = 0; j < JOURNAL_COUNT; j++) {
    const journalId = JOURNAL_ID_START + j
    for (let s = 0; s < ISSUES_PER_JOURNAL; s++) {
      const id = ISSUE_ID_START + issueIdx
      issueIdx++
      const isEmptyIssue = issueIdx === JOURNAL_COUNT * ISSUES_PER_JOURNAL
      await prisma.issue.upsert({
        where: { id: BigInt(id) },
        create: {
          id: BigInt(id),
          journalId: BigInt(journalId),
          year: 2020 + (s % 5),
          issueNumber: String(s + 1).padStart(2, '0'),
          issueLabel: isEmptyIssue ? 'Boş sayı (fixture)' : `Sayı ${s + 1}`,
          status: 'published',
        },
        update: {
          year: 2020 + (s % 5),
          status: 'published',
        },
      })
    }
  }
}

async function upsertAuthors() {
  const authors = [
    { key: '1', name: 'Tek Yazar Fixture', provisional: false },
    { key: '2', name: 'İkinci Yazar Fixture', provisional: false },
    { key: 'prov', name: 'Provisional Yazar (doğrulanmadı)', provisional: true },
  ]
  for (const a of authors) {
    const sourceKey = `${DEV_FIXTURE_MARKER}-author-${a.key}`
    await prisma.author.upsert({
      where: { sourceKey },
      create: {
        sourceKey,
        name: a.name,
        slug: `${DEV_FIXTURE_MARKER}-author-${a.key}`,
        isProvisional: a.provisional,
      },
      update: {
        name: a.name,
        isProvisional: a.provisional,
      },
    })
  }
}

async function upsertArticlesAndRelations() {
  const issueCount = JOURNAL_COUNT * ISSUES_PER_JOURNAL
  const emptyIssueId = ISSUE_ID_START + issueCount - 1

  for (let a = 0; a < ARTICLES_TOTAL; a++) {
    const id = ARTICLE_ID_START + a
    const journalOffset = a % JOURNAL_COUNT
    const journalId = JOURNAL_ID_START + journalOffset
    const journalSlug = `${DEV_FIXTURE_MARKER}-j-${journalOffset + 1}`
    const issueId = ISSUE_ID_START + (a % (issueCount - 1))
    const useEmptyIssue = a % 47 === 0
    const assignedIssueId = useEmptyIssue ? emptyIssueId : issueId

    const hasDoi = a % 3 !== 0
    const hasPdf = a % 4 !== 0
    const hasAbstract = a % 5 !== 0
    const isLongTitle = a % 11 === 0
    const isEnglish = a % 7 === 0
    const isMultiAuthor = a % 2 === 0

    const titleTr = isLongTitle ? LONG_TITLE_TR : `Geliştirme makale ${a + 1}`
    const titleEn = isEnglish ? (isLongTitle ? LONG_TITLE_EN : `Development article ${a + 1}`) : null
    const slug = `${DEV_FIXTURE_MARKER}-article-${a + 1}`

    await prisma.article.upsert({
      where: { id: BigInt(id) },
      create: {
        id: BigInt(id),
        slug,
        legacyJournalSlug: journalSlug,
        journalId: BigInt(journalId),
        issueId: BigInt(assignedIssueId),
        titleTr,
        titleEn,
        authorsRaw: isMultiAuthor ? LONG_AUTHORS : 'Tek Yazar Fixture',
        abstractTr: hasAbstract ? `Özet metni (fixture) ${a + 1}` : null,
        abstractEn: hasAbstract && isEnglish ? `Abstract text (fixture) ${a + 1}` : null,
        keywordsTr: 'anahtar kelime, fixture, geliştirme',
        doi: hasDoi ? `10.9999/${DEV_FIXTURE_MARKER}.${a + 1}` : null,
        publishedYear: 2020 + (a % 5),
        language: isEnglish ? 'en' : 'tr',
        status: 'published',
      },
      update: {
        titleTr,
        titleEn,
        doi: hasDoi ? `10.9999/${DEV_FIXTURE_MARKER}.${a + 1}` : null,
        status: 'published',
      },
    })

    if (hasPdf) {
      await prisma.pdfFile.upsert({
        where: { articleId: BigInt(id) },
        create: {
          articleId: BigInt(id),
          legacyPdfPath: `uploads/${DEV_FIXTURE_MARKER}/sample-${a + 1}.pdf`,
          fileStatus: 'legacy',
        },
        update: {
          legacyPdfPath: `uploads/${DEV_FIXTURE_MARKER}/sample-${a + 1}.pdf`,
          fileStatus: 'legacy',
        },
      })
    } else {
      await prisma.pdfFile.deleteMany({ where: { articleId: BigInt(id) } })
    }

    const authorKeys = isMultiAuthor
      ? [`${DEV_FIXTURE_MARKER}-author-1`, `${DEV_FIXTURE_MARKER}-author-2`, `${DEV_FIXTURE_MARKER}-author-prov`]
      : [`${DEV_FIXTURE_MARKER}-author-1`]

    for (let pos = 0; pos < authorKeys.length; pos++) {
      const author = await prisma.author.findUnique({ where: { sourceKey: authorKeys[pos] } })
      if (!author) continue
      await prisma.articleAuthor.upsert({
        where: {
          articleId_authorId: {
            articleId: BigInt(id),
            authorId: author.id,
          },
        },
        create: {
          articleId: BigInt(id),
          authorId: author.id,
          authorPosition: pos + 1,
          rawAuthorName: author.name,
        },
        update: {
          authorPosition: pos + 1,
          rawAuthorName: author.name,
        },
      })
    }
  }
}

async function recordSeedRun() {
  await prisma.etlRun.upsert({
    where: { runId: DEV_SEED_RUN_ID },
    create: {
      runId: DEV_SEED_RUN_ID,
      script: 'scripts/db/seed-dev.ts',
      mode: 'dev-fixture',
      targetTable: 'catalog',
      rowsInserted: ARTICLES_TOTAL,
      status: 'completed',
      finishedAt: new Date(),
      notes: DEV_FIXTURE_MARKER,
    },
    update: {
      status: 'completed',
      finishedAt: new Date(),
      rowsInserted: ARTICLES_TOTAL,
    },
  })
}

export async function runDevFixtureSeed(write: boolean): Promise<void> {
  assertSeedAllowed()

  if (!write) {
    const plan = describeDevFixturePlan()
    console.log('[dry-run] Development fixture seed plan:')
    console.log(JSON.stringify(plan, null, 2))
    const present = await isDevFixturePresent()
    console.log(`[dry-run] Fixture already present: ${present}`)
    console.log('[dry-run] Yazmak için: npm run db:seed:dev -- --write')
    return
  }

  if (await isDevFixturePresent()) {
    console.log('Fixture zaten mevcut — idempotent upsert ile güncelleniyor.')
  }

  await upsertCategories()
  await upsertJournals()
  await upsertIssues()
  await upsertAuthors()
  await upsertArticlesAndRelations()
  await recordSeedRun()

  console.log(`Development fixture seed tamamlandı (${DEV_FIXTURE_MARKER}).`)
}

async function main() {
  const write = process.argv.includes('--write')
  await runDevFixtureSeed(write)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
