/**
 * Pilot ETL — MySQL kaynak → yerel PostgreSQL hedef.
 *
 * Varsayılan: dry-run (yazma yok). Gerçek yazma için --write gerekli.
 *
 * Kullanım:
 *   npx tsx scripts/etl-pg/pilot-run.ts
 *   npx tsx scripts/etl-pg/pilot-run.ts --write --article-limit=8000
 *   npx tsx scripts/etl-pg/pilot-run.ts --write --batch-size=500
 */
import mysql from 'mysql2/promise'
import { Prisma } from '@prisma/client'
import { prisma, disconnectPrisma } from '../../lib/db/prisma'
import { urlYap } from '../../lib/urls/slug'
import { mapMakaleAuthorFields } from '../../lib/etl/article-author-source'
import {
  loadAuthorRegistry,
  planAuthorsForArticle,
  assertAuthorRegistryReadyForWrite,
} from '../../lib/etl/run-authors-etl'
import { resolveSourceMysqlConfig } from '../source/mysql-config'
import { validateEtlEnv, logEtlConnectionSummary } from '../lib/etl-guard'
import {
  finishPgEtlRun,
  logPgEtlErrors,
  startPgEtlRun,
  type PgEtlErrorEntry,
} from './lib/pg-etl-run'

const PILOT_JOURNAL_COUNT = 15
const DEFAULT_ARTICLE_LIMIT = 8000
const DEFAULT_BATCH_SIZE = 500

interface PilotArgs {
  write: boolean
  articleLimit: number
  batchSize: number
}

function parseArgs(): PilotArgs {
  const write = process.argv.includes('--write')
  const limitArg = process.argv.find((a) => a.startsWith('--article-limit='))
  const batchArg = process.argv.find((a) => a.startsWith('--batch-size='))
  const articleLimit = limitArg
    ? Math.max(1, parseInt(limitArg.split('=')[1] ?? '', 10) || DEFAULT_ARTICLE_LIMIT)
    : DEFAULT_ARTICLE_LIMIT
  const batchSize = batchArg
    ? Math.max(50, parseInt(batchArg.split('=')[1] ?? '', 10) || DEFAULT_BATCH_SIZE)
    : DEFAULT_BATCH_SIZE
  return { write, articleLimit, batchSize }
}

function buildIssueLabel(yil: string | null, sayi: string | null): string | null {
  const parts: string[] = []
  if (yil?.trim()) parts.push(yil.trim())
  if (sayi?.trim()) parts.push(`Sayı ${sayi.trim()}`)
  return parts.length > 0 ? parts.join(' / ') : null
}

interface LegacyDergi {
  DergiID: number
  DergiBASLIK: string
  Issn: string
  Eissn: string
  YayinARALIGI: string
  Baslangic: string
  Yayinci: string
  Aciklama: string
  Amac: string
  Kapsam: string
  YazimKURALLARI: string
  DergiKUNYESI: string
  EditorKURULU: string
  Iletisim: string
  KategoriID: number
  Resim: string
  contact: string | null
  about: string | null
  aim_and_scope: string | null
  policy: string | null
  indexes: string | null
  price_policy: string | null
  editor: string | null
  topics: string | null
  publisher: string | null
  publish_language: string | null
  years_indexed: string | null
  subject_category: string | null
  publication_format: string | null
  old_name: string | null
  Aktif: number
  Hit: number
  Link: string
}

interface LegacyMakale {
  MakaleID: number
  IlkSAYFA: string
  SonSAYFA: string
  Tarih: string | Date | null
  TitleEN: string
  TitleTR: string
  Yazarlar: string
  OzetEN: string
  OzetTR: string
  KeywordsEN: string
  KeywordsTR: string
  Kaynakca: string
  kaynakgoster: string | null
  BirinciDIL: string
  Konular: string
  Bolum: string
  YazarlarKAYNAKCA: string
  Tarihler: string
  ArsivID: number
  DergiID: number
  Hit: number
  Indirme: number
  YazarID: string
  Kurum: string
  PdfLINK: string
  document_language: string | null
  doi: string | null
  document_type: string | null
  article_type: string | null
  access_type: string | null
  Aktif: number
  issue_id: number
}

async function selectPilotJournalIds(conn: mysql.Connection): Promise<number[]> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT DergiID FROM dergiler ORDER BY Hit DESC, DergiID ASC LIMIT ?`,
    [PILOT_JOURNAL_COUNT],
  )
  return rows.map((r) => r.DergiID as number)
}

async function migrateCategories(
  conn: mysql.Connection,
  journalIds: number[],
  dryRun: boolean,
  errors: PgEtlErrorEntry[],
): Promise<number> {
  const placeholders = journalIds.map(() => '?').join(',')
  const [catRows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT DISTINCT k.KategoriID, k.KategoriBASLIKTR, k.KategoriBASLIKEN, k.KategoriURL
     FROM kategoriler k
     INNER JOIN dergiler d ON d.KategoriID = k.KategoriID
     WHERE d.DergiID IN (${placeholders})`,
    journalIds,
  )
  if (dryRun) return catRows.length

  let upserted = 0
  for (const c of catRows as {
    KategoriID: number
    KategoriBASLIKTR: string
    KategoriBASLIKEN: string
    KategoriURL: string
  }[]) {
    try {
      await prisma.category.upsert({
        where: { id: BigInt(c.KategoriID) },
        create: {
          id: BigInt(c.KategoriID),
          legacyId: BigInt(c.KategoriID),
          nameTr: c.KategoriBASLIKTR || null,
          nameEn: c.KategoriBASLIKEN || null,
          slug: c.KategoriURL || null,
        },
        update: {
          nameTr: c.KategoriBASLIKTR || null,
          nameEn: c.KategoriBASLIKEN || null,
          slug: c.KategoriURL || null,
        },
      })
      upserted++
    } catch (e) {
      errors.push({
        sourceTable: 'kategoriler',
        sourceId: c.KategoriID,
        errorType: 'upsert',
        errorMessage: e instanceof Error ? e.message : String(e),
      })
    }
  }
  return upserted
}

async function migrateJournals(
  conn: mysql.Connection,
  journalIds: number[],
  dryRun: boolean,
  errors: PgEtlErrorEntry[],
): Promise<number> {
  const placeholders = journalIds.map(() => '?').join(',')
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT * FROM dergiler WHERE DergiID IN (${placeholders}) ORDER BY DergiID`,
    journalIds,
  )
  if (dryRun) return rows.length

  let upserted = 0
  for (const raw of rows as LegacyDergi[]) {
    if (!raw.DergiID || !raw.DergiBASLIK?.trim()) {
      errors.push({
        sourceTable: 'dergiler',
        sourceId: raw.DergiID ?? null,
        errorType: 'validation',
        errorMessage: 'DergiID veya DergiBASLIK boş',
      })
      continue
    }

    const aimAndScope =
      raw.aim_and_scope?.trim() ||
      [raw.Amac?.trim(), raw.Kapsam?.trim()].filter(Boolean).join('\n\n') ||
      null
    const publisher = raw.publisher?.trim() || raw.Yayinci?.trim() || null
    let contactJson: Prisma.InputJsonValue | undefined
    if (raw.contact) {
      try {
        contactJson = JSON.parse(raw.contact) as Prisma.InputJsonValue
      } catch {
        contactJson = undefined
      }
    }

    try {
      await prisma.journal.upsert({
        where: { id: BigInt(raw.DergiID) },
        create: {
          id: BigInt(raw.DergiID),
          legacyId: BigInt(raw.DergiID),
          slug: urlYap(raw.DergiBASLIK),
          titleTr: raw.DergiBASLIK.trim(),
          oldName: raw.old_name?.trim() || null,
          issn: raw.Issn?.trim() || null,
          eissn: raw.Eissn?.trim() || null,
          publisher,
          frequency: raw.YayinARALIGI?.trim() || null,
          startYear: raw.Baslangic?.trim() || null,
          publicationFormat: raw.publication_format?.trim() || null,
          publishLanguage: raw.publish_language?.trim() || null,
          subjectCategory: raw.subject_category?.trim() || null,
          topics: raw.topics?.trim() || null,
          editorInChief: raw.editor?.trim() || null,
          editorialBoard: raw.EditorKURULU?.trim() || null,
          colophon: raw.DergiKUNYESI?.trim() || null,
          description: raw.Aciklama?.trim() || null,
          about: raw.about?.trim() || null,
          aimAndScope,
          policy: raw.policy?.trim() || null,
          writingRules: raw.YazimKURALLARI?.trim() || null,
          pricePolicy: raw.price_policy?.trim() || null,
          indexesText: raw.indexes?.trim() || null,
          yearsIndexed: raw.years_indexed?.trim() || null,
          contactText: raw.Iletisim?.trim() || null,
          contactJson,
          coverPath: raw.Resim?.trim() || null,
          legacyLink: raw.Link?.trim() || null,
          categoryId: raw.KategoriID ? BigInt(raw.KategoriID) : null,
          status: raw.Aktif === 1 ? 'published' : 'draft',
          hitCount: raw.Hit || 0,
        },
        update: {
          slug: urlYap(raw.DergiBASLIK),
          titleTr: raw.DergiBASLIK.trim(),
          status: raw.Aktif === 1 ? 'published' : 'draft',
          hitCount: raw.Hit || 0,
        },
      })
      upserted++
    } catch (e) {
      errors.push({
        sourceTable: 'dergiler',
        sourceId: raw.DergiID,
        errorType: 'upsert',
        errorMessage: e instanceof Error ? e.message : String(e),
      })
    }
  }
  return upserted
}

async function migrateIssues(
  conn: mysql.Connection,
  journalIds: number[],
  dryRun: boolean,
  errors: PgEtlErrorEntry[],
): Promise<number> {
  const placeholders = journalIds.map(() => '?').join(',')
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT ArsivID, DergiID, Yil, Sayi, issue_id, Aktif, Hit
     FROM dergi_arsiv WHERE DergiID IN (${placeholders}) ORDER BY ArsivID`,
    journalIds,
  )
  if (dryRun) return rows.length

  let upserted = 0
  for (const raw of rows as {
    ArsivID: number
    DergiID: number
    Yil: string
    Sayi: string
    issue_id: number
    Aktif: number
    Hit: number
  }[]) {
    if (!raw.ArsivID || !raw.DergiID) continue
    const yilInt = raw.Yil?.trim() ? parseInt(raw.Yil.trim(), 10) : null
    const year =
      yilInt && !isNaN(yilInt) && yilInt > 1900 && yilInt < 2100 ? yilInt : null

    try {
      await prisma.issue.upsert({
        where: { id: BigInt(raw.ArsivID) },
        create: {
          id: BigInt(raw.ArsivID),
          legacyId: BigInt(raw.ArsivID),
          journalId: BigInt(raw.DergiID),
          year,
          issueNumber: raw.Sayi?.trim() || null,
          issueLabel: buildIssueLabel(raw.Yil, raw.Sayi),
          dergiparkIssueId: (raw.issue_id ?? 0) > 0 ? BigInt(raw.issue_id) : null,
          status: raw.Aktif === 1 ? 'published' : 'draft',
          hitCount: raw.Hit || 0,
        },
        update: {
          year,
          issueNumber: raw.Sayi?.trim() || null,
          status: raw.Aktif === 1 ? 'published' : 'draft',
        },
      })
      upserted++
    } catch (e) {
      errors.push({
        sourceTable: 'dergi_arsiv',
        sourceId: raw.ArsivID,
        errorType: 'upsert',
        errorMessage: e instanceof Error ? e.message : String(e),
      })
    }
  }
  return upserted
}

function mapMakaleToArticle(
  raw: LegacyMakale,
  journalSlugMap: Map<number, string>,
): {
  article: Prisma.ArticleCreateInput
  pdf: { hasPdf: boolean; path: string | null }
  authorFields: ReturnType<typeof mapMakaleAuthorFields>
} {
  const legacyJournalSlug = journalSlugMap.get(raw.DergiID) ?? `dergi-${raw.DergiID}`
  const titleForSlug = raw.TitleTR?.trim() || raw.TitleEN?.trim()
  const slug = (titleForSlug ? urlYap(titleForSlug) : '') || `makale-${raw.MakaleID}`

  const pageStart = raw.IlkSAYFA?.trim() ? parseInt(raw.IlkSAYFA.trim(), 10) || null : null
  const pageEnd = raw.SonSAYFA?.trim() ? parseInt(raw.SonSAYFA.trim(), 10) || null : null
  const tarihStr =
    raw.Tarih instanceof Date ? raw.Tarih.toISOString() : String(raw.Tarih ?? '')
  const year = tarihStr ? parseInt(tarihStr.slice(0, 4), 10) || null : null
  const lang =
    raw.document_language?.trim() ||
    (raw.BirinciDIL?.trim().toLowerCase().startsWith('en') ? 'en' : 'tr')

  const pdfPath = raw.PdfLINK?.trim()
  const hasPdf = !!(pdfPath && pdfPath !== '' && pdfPath !== 'pdf-bulunamadi')
  const authorFields = mapMakaleAuthorFields({
    Yazarlar: raw.Yazarlar,
    YazarlarKAYNAKCA: raw.YazarlarKAYNAKCA,
  })

  const publishedAt =
    raw.Tarih instanceof Date
      ? raw.Tarih
      : raw.Tarih
        ? new Date(raw.Tarih)
        : null

  const article: Prisma.ArticleCreateInput = {
    id: BigInt(raw.MakaleID),
    legacyId: BigInt(raw.MakaleID),
    slug,
    legacyJournalSlug,
    journal: { connect: { id: BigInt(raw.DergiID) } },
    issue: raw.ArsivID ? { connect: { id: BigInt(raw.ArsivID) } } : undefined,
    titleTr: raw.TitleTR?.trim() || null,
    titleEn: raw.TitleEN?.trim() || null,
    authorsRaw: authorFields.authors_raw,
    authorsCitation: authorFields.authors_citation,
    legacyAuthorIds: raw.YazarID?.trim() || null,
    institutionRaw: raw.Kurum?.trim() || null,
    abstractTr: raw.OzetTR?.trim() || null,
    abstractEn: raw.OzetEN?.trim() || null,
    keywordsTr: raw.KeywordsTR?.trim() || null,
    keywordsEn: raw.KeywordsEN?.trim() || null,
    referencesRaw: raw.Kaynakca?.trim() || null,
    citationFormat: raw.kaynakgoster?.trim() || null,
    pageStart,
    pageEnd,
    publishedAt,
    publishedYear: year,
    submissionDates: raw.Tarihler?.trim() || null,
    language: lang,
    documentLanguage: raw.document_language?.trim() || null,
    documentType: raw.document_type?.trim() || null,
    articleType: raw.article_type?.trim() || null,
    accessType: raw.access_type?.trim() || 'open',
    section: raw.Bolum?.trim() || null,
    subjectArea: raw.Konular?.trim() || null,
    doi: raw.doi?.trim() || null,
    dergiparkIssueId: (raw.issue_id ?? 0) > 0 ? BigInt(raw.issue_id) : null,
    hitCount: raw.Hit || 0,
    downloadCount: raw.Indirme || 0,
    status: raw.Aktif === 1 ? 'published' : 'draft',
  }

  return { article, pdf: { hasPdf, path: hasPdf ? pdfPath! : null }, authorFields }
}

async function migrateArticlesBatch(
  conn: mysql.Connection,
  journalIds: number[],
  articleLimit: number,
  batchSize: number,
  dryRun: boolean,
  registry: Awaited<ReturnType<typeof loadAuthorRegistry>>['registry'],
  counters: {
    articles: number
    pdfs: number
    authors: number
    articleAuthors: number
    skipped: number
    errors: number
  },
  errors: PgEtlErrorEntry[],
  sourceKeyConflicts: string[],
  legacyIdConflicts: string[],
): Promise<void> {
  const placeholders = journalIds.map(() => '?').join(',')
  const [slugRows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT DergiID, DergiBASLIK FROM dergiler WHERE DergiID IN (${placeholders})`,
    journalIds,
  )
  const journalSlugMap = new Map<number, string>()
  for (const r of slugRows as { DergiID: number; DergiBASLIK: string }[]) {
    journalSlugMap.set(r.DergiID, urlYap(r.DergiBASLIK ?? ''))
  }

  let offset = 0
  while (offset < articleLimit) {
    const limit = Math.min(batchSize, articleLimit - offset)
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT MakaleID, IlkSAYFA, SonSAYFA, Tarih,
              TitleEN, TitleTR, Yazarlar, OzetEN, OzetTR,
              KeywordsEN, KeywordsTR, Kaynakca, kaynakgoster,
              BirinciDIL, Konular, Bolum, YazarlarKAYNAKCA, Tarihler,
              ArsivID, DergiID, Hit, Indirme, YazarID, Kurum, PdfLINK,
              document_language, doi, document_type, article_type, access_type,
              Aktif, issue_id
       FROM makaleler
       WHERE DergiID IN (${placeholders})
       ORDER BY MakaleID ASC
       LIMIT ? OFFSET ?`,
      [...journalIds, limit, offset],
    )
    if (rows.length === 0) break

    if (dryRun) {
      counters.articles += rows.length
      for (const raw of rows as LegacyMakale[]) {
        const pdfPath = raw.PdfLINK?.trim()
        if (pdfPath && pdfPath !== '' && pdfPath !== 'pdf-bulunamadi') counters.pdfs++
        const planned = planAuthorsForArticle(
          {
            id: raw.MakaleID,
            authors_raw: mapMakaleAuthorFields({
              Yazarlar: raw.Yazarlar,
              YazarlarKAYNAKCA: raw.YazarlarKAYNAKCA,
            }).authors_raw,
            status: raw.Aktif === 1 ? 'published' : 'draft',
          },
          registry,
          false,
        )
        counters.authors += planned.authors.length
        counters.articleAuthors += planned.authors.length
      }
      offset += rows.length
      continue
    }

    await prisma.$transaction(async (tx) => {
      for (const raw of rows as LegacyMakale[]) {
        if (!raw.MakaleID || !raw.DergiID) {
          counters.skipped++
          continue
        }

        const { article, pdf, authorFields } = mapMakaleToArticle(raw, journalSlugMap)
        const articleId = BigInt(raw.MakaleID)

        try {
          await tx.article.upsert({
            where: { id: articleId },
            create: article,
            update: {
              slug: article.slug as string,
              titleTr: article.titleTr,
              titleEn: article.titleEn,
              authorsRaw: authorFields.authors_raw,
              authorsCitation: authorFields.authors_citation,
              status: raw.Aktif === 1 ? 'published' : 'draft',
              hitCount: raw.Hit || 0,
              downloadCount: raw.Indirme || 0,
            },
          })
          counters.articles++

          await tx.pdfFile.upsert({
            where: { articleId },
            create: {
              articleId,
              legacyPdfPath: pdf.path,
              fileStatus: pdf.hasPdf ? 'legacy' : 'missing',
            },
            update: {
              legacyPdfPath: pdf.path,
              fileStatus: pdf.hasPdf ? 'legacy' : 'missing',
            },
          })
          if (pdf.hasPdf) counters.pdfs++

          const planned = planAuthorsForArticle(
            {
              id: raw.MakaleID,
              authors_raw: authorFields.authors_raw,
              status: raw.Aktif === 1 ? 'published' : 'draft',
            },
            registry,
            false,
          )

          for (const p of planned.authors) {
            const existingByKey = await tx.author.findUnique({
              where: { sourceKey: p.sourceKey },
              select: { id: true, legacyId: true, name: true },
            })
            if (
              existingByKey &&
              existingByKey.legacyId != null &&
              Number(existingByKey.legacyId) !== p.legacyId
            ) {
              legacyIdConflicts.push(
                `source_key=${p.sourceKey} legacy_id mismatch existing=${existingByKey.legacyId} new=${p.legacyId}`,
              )
            }

            const existingByLegacy = await tx.author.findUnique({
              where: { legacyId: BigInt(p.legacyId) },
              select: { id: true, sourceKey: true },
            })
            if (
              existingByLegacy &&
              existingByLegacy.sourceKey &&
              existingByLegacy.sourceKey !== p.sourceKey
            ) {
              sourceKeyConflicts.push(
                `legacy_id=${p.legacyId} source_key mismatch existing=${existingByLegacy.sourceKey} new=${p.sourceKey}`,
              )
            }

            const author = await tx.author.upsert({
              where: { sourceKey: p.sourceKey },
              create: {
                legacyId: BigInt(p.legacyId),
                name: p.name,
                slug: p.slug,
                isProvisional: p.isProvisional,
                sourceKey: p.sourceKey,
              },
              update: {
                name: p.name,
                slug: p.slug,
              },
            })
            counters.authors++

            await tx.articleAuthor.upsert({
              where: {
                articleId_authorId: {
                  articleId: articleId,
                  authorId: author.id,
                },
              },
              create: {
                articleId: articleId,
                authorId: author.id,
                authorPosition: p.position,
                rawAuthorName: p.rawName,
              },
              update: {
                authorPosition: p.position,
                rawAuthorName: p.rawName,
              },
            })
            counters.articleAuthors++
          }
        } catch (e) {
          counters.errors++
          errors.push({
            sourceTable: 'makaleler',
            sourceId: raw.MakaleID,
            errorType: 'batch',
            errorMessage: e instanceof Error ? e.message : String(e),
          })
        }
      }
    })

    offset += rows.length
    process.stdout.write(`\r  Makale batch: ${Math.min(offset, articleLimit)}/${articleLimit}`)
  }
  if (!dryRun) process.stdout.write('\n')
}

async function main() {
  const args = parseArgs()
  const mode = args.write ? 'pilot-write' : 'pilot-dry-run'

  console.log(`Pilot ETL [${mode}] article-limit=${args.articleLimit} batch=${args.batchSize}`)

  const guard = validateEtlEnv()
  logEtlConnectionSummary(guard)

  const mysqlCfg = resolveSourceMysqlConfig()
  const conn = await mysql.createConnection({
    host: mysqlCfg.host,
    port: mysqlCfg.port,
    user: mysqlCfg.user,
    password: mysqlCfg.password,
    database: mysqlCfg.database,
    decimalNumbers: true,
  })

  const journalIds = await selectPilotJournalIds(conn)
  if (journalIds.length === 0) {
    throw new Error('Pilot dergi seçilemedi')
  }

  const registryLoad = await loadAuthorRegistry(conn)
  assertAuthorRegistryReadyForWrite(registryLoad)

  const errors: PgEtlErrorEntry[] = []
  const sourceKeyConflicts: string[] = []
  const legacyIdConflicts: string[] = []
  const counters = {
    categories: 0,
    journals: 0,
    issues: 0,
    articles: 0,
    pdfs: 0,
    authors: 0,
    articleAuthors: 0,
    skipped: 0,
    errors: 0,
  }

  let runId: string | null = null
  if (args.write) {
    runId = await startPgEtlRun({
      script: 'pilot-run',
      mode: 'pilot-write',
      sourceTable: 'dergiler+dergi_arsiv+makaleler',
      targetTable: 'journals+issues+articles+pdf_files+authors',
      limitRows: args.articleLimit,
      notes: `journals=${journalIds.length}`,
    })
  }

  counters.categories = await migrateCategories(conn, journalIds, !args.write, errors)
  counters.journals = await migrateJournals(conn, journalIds, !args.write, errors)
  counters.issues = await migrateIssues(conn, journalIds, !args.write, errors)

  await migrateArticlesBatch(
    conn,
    journalIds,
    args.articleLimit,
    args.batchSize,
    !args.write,
    registryLoad.registry,
    counters,
    errors,
    sourceKeyConflicts,
    legacyIdConflicts,
  )

  await conn.end()

  const report = {
    mode,
    writes_to_postgres: args.write,
    pilot_journal_count: journalIds.length,
    journal_ids_sample: journalIds.slice(0, 5),
    author_registry_mode: registryLoad.mode,
    counters,
    source_key_conflicts: sourceKeyConflicts.slice(0, 20),
    legacy_id_conflicts: legacyIdConflicts.slice(0, 20),
    error_count: errors.length,
    errors_sample: errors.slice(0, 10).map((e) => ({
      table: e.sourceTable,
      id: e.sourceId,
      type: e.errorType,
      message: e.errorMessage,
    })),
  }

  console.log(JSON.stringify(report, null, 2))

  if (args.write && runId) {
    await logPgEtlErrors(runId, errors)
    await finishPgEtlRun(runId, {
      rowsRead: counters.articles,
      rowsInserted: counters.articles,
      rowsSkipped: counters.skipped,
      rowsError: counters.errors + errors.length,
      status: errors.length > 0 || counters.errors > 0 ? 'partial' : 'success',
      notes: JSON.stringify({ counters, sourceKeyConflicts: sourceKeyConflicts.length }),
    })
  }

  await disconnectPrisma()

  if (errors.length > 0 && args.write) {
    process.exitCode = 1
  }
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e)
  await disconnectPrisma()
  process.exit(1)
})
