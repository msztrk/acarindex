/**
 * ETL 03 — makaleler → articles + pdf_files
 *
 * Kullanım:
 *   npx tsx scripts/etl/03-articles.ts            # tüm kayıtlar
 *   npx tsx scripts/etl/03-articles.ts --pilot    # ilk 1000 makale
 *
 * Kaynak  : MySQL makaleler (ana kaynak; bot_makaleler dışlandı)
 * Bağımlı : 01-journals.ts + 02-issues.ts
 */

import { getMysqlPool, getSupabaseAdmin, startRun, finishRun, logErrors, type EtlErrorEntry } from './db'
import { urlYap } from '../../lib/urls/slug'
import type mysql from 'mysql2/promise'

const isPilot = process.argv.includes('--pilot')
const PILOT_LIMIT = 1000
const BATCH_SIZE = 500

interface LegacyMakale {
  MakaleID: number
  IlkSAYFA: string
  SonSAYFA: string
  Tarih: string | null
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

async function buildJournalSlugMap(pool: mysql.Pool): Promise<Map<number, string>> {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT DergiID, DergiBASLIK FROM dergiler',
  )
  const map = new Map<number, string>()
  for (const r of rows as { DergiID: number; DergiBASLIK: string }[]) {
    map.set(r.DergiID, urlYap(r.DergiBASLIK ?? ''))
  }
  return map
}

async function main() {
  console.log(`📄 ETL 03 — makaleler → articles + pdf_files [${isPilot ? `PILOT: ilk ${PILOT_LIMIT}` : 'FULL'}]`)
  const pool = getMysqlPool()
  const sb = getSupabaseAdmin()

  const [[countRow]] = await pool.execute<mysql.RowDataPacket[]>(
    isPilot
      ? `SELECT ${PILOT_LIMIT} as c`
      : 'SELECT COUNT(*) as c FROM makaleler',
  )
  const total = (countRow as { c: number }).c
  console.log(`  Hedef: ${total} makale`)

  const journalSlugMap = await buildJournalSlugMap(pool)

  const runId = await startRun(sb, {
    script: '03-articles',
    mode: isPilot ? 'pilot' : 'full',
    sourceTable: 'makaleler',
    targetTable: 'articles + pdf_files',
    limitRows: isPilot ? PILOT_LIMIT : undefined,
  })

  let offset = 0
  let articlesDone = 0
  let pdfsDone = 0
  let totalErrors = 0
  let totalSkipped = 0
  const allErrorLog: EtlErrorEntry[] = []

  const effectiveTotal = isPilot ? Math.min(total, PILOT_LIMIT) : total

  while (offset < effectiveTotal) {
    const batchLimit = isPilot ? Math.min(BATCH_SIZE, PILOT_LIMIT - offset) : BATCH_SIZE
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT MakaleID, IlkSAYFA, SonSAYFA, Tarih,
              TitleEN, TitleTR, Yazarlar, OzetEN, OzetTR,
              KeywordsEN, KeywordsTR, Kaynakca, kaynakgoster,
              BirinciDIL, Konular, Bolum, YazarlarKAYNAKCA, Tarihler,
              ArsivID, DergiID, Hit, Indirme, YazarID, Kurum, PdfLINK,
              document_language, doi, document_type, article_type, access_type,
              Aktif, issue_id
       FROM makaleler
       ORDER BY MakaleID ASC
       LIMIT ${batchLimit} OFFSET ${offset}`,
    )
    if ((rows as unknown[]).length === 0) break

    const articles: Record<string, unknown>[] = []
    const pdfs: Record<string, unknown>[] = []
    const errorLog: EtlErrorEntry[] = []

    for (const raw of rows as LegacyMakale[]) {
      // Zorunlu alan kontrolü
      if (!raw.MakaleID) {
        errorLog.push({ sourceTable: 'makaleler', sourceId: null, errorType: 'validation', errorMessage: 'MakaleID boş' })
        totalSkipped++; continue
      }
      if (!raw.DergiID) {
        errorLog.push({ sourceTable: 'makaleler', sourceId: raw.MakaleID, errorType: 'validation', errorMessage: 'DergiID boş', fieldName: 'DergiID' })
        totalSkipped++; continue
      }

      const legacyJournalSlug = journalSlugMap.get(raw.DergiID) ?? `dergi-${raw.DergiID}`
      const titleForSlug = raw.TitleTR?.trim() || raw.TitleEN?.trim()
      const slug = (titleForSlug ? urlYap(titleForSlug) : '') || `makale-${raw.MakaleID}`

      const pageStart = raw.IlkSAYFA?.trim() ? (parseInt(raw.IlkSAYFA.trim(), 10) || null) : null
      const pageEnd   = raw.SonSAYFA?.trim()  ? (parseInt(raw.SonSAYFA.trim(), 10)  || null) : null
      const tarihStr  = raw.Tarih instanceof Date ? raw.Tarih.toISOString() : String(raw.Tarih ?? '')
      const year      = tarihStr ? (parseInt(tarihStr.slice(0, 4), 10) || null) : null
      const lang      = raw.document_language?.trim() ||
                        (raw.BirinciDIL?.trim().toLowerCase().startsWith('en') ? 'en' : 'tr')

      const pdfPath = raw.PdfLINK?.trim()
      const hasPdf  = !!(pdfPath && pdfPath !== '' && pdfPath !== 'pdf-bulunamadi')

      articles.push({
        id:                   raw.MakaleID,
        legacy_id:            raw.MakaleID,
        slug,
        legacy_journal_slug:  legacyJournalSlug,
        journal_id:           raw.DergiID,
        issue_id:             raw.ArsivID || null,
        title_tr:             raw.TitleTR?.trim() || null,
        title_en:             raw.TitleEN?.trim() || null,
        authors_raw:          raw.Yazarlar?.trim() || null,
        authors_citation:     raw.YazarlarKAYNAKCA?.trim() || null,
        legacy_author_ids:    raw.YazarID?.trim() || null,
        institution_raw:      raw.Kurum?.trim() || null,
        abstract_tr:          raw.OzetTR?.trim() || null,
        abstract_en:          raw.OzetEN?.trim() || null,
        keywords_tr:          raw.KeywordsTR?.trim() || null,
        keywords_en:          raw.KeywordsEN?.trim() || null,
        references_raw:       raw.Kaynakca?.trim() || null,
        citation_format:      raw.kaynakgoster?.trim() || null,
        page_start:           pageStart,
        page_end:             pageEnd,
        published_at:         raw.Tarih || null,
        published_year:       year,
        submission_dates:     raw.Tarihler?.trim() || null,
        language:             lang,
        document_language:    raw.document_language?.trim() || null,
        document_type:        raw.document_type?.trim() || null,
        article_type:         raw.article_type?.trim() || null,
        access_type:          raw.access_type?.trim() || 'open',
        section:              raw.Bolum?.trim() || null,
        subject_area:         raw.Konular?.trim() || null,
        doi:                  raw.doi?.trim() || null,
        dergipark_issue_id:   (raw.issue_id ?? 0) > 0 ? raw.issue_id : null,
        hit_count:            raw.Hit || 0,
        download_count:       raw.Indirme || 0,
        status:               raw.Aktif === 1 ? 'published' : 'draft',
      })

      pdfs.push({
        article_id:       raw.MakaleID,
        legacy_pdf_path:  hasPdf ? pdfPath : null,
        file_status:      hasPdf ? 'legacy' : 'missing',
      })
    }

    // articles upsert
    const { error: aErr } = await sb.from('articles').upsert(articles, { onConflict: 'legacy_id' })
    if (aErr) {
      console.error(`  [HATA] articles batch offset ${offset}: ${aErr.message}`)
      totalErrors += articles.length
      errorLog.push({ sourceTable: 'makaleler', sourceId: null, errorType: 'constraint', errorMessage: aErr.message })
    } else {
      articlesDone += articles.length
    }

    // pdf_files upsert
    const { error: pErr } = await sb.from('pdf_files').upsert(pdfs, { onConflict: 'article_id' })
    if (pErr) {
      console.error(`  [HATA] pdf_files batch offset ${offset}: ${pErr.message}`)
    } else {
      pdfsDone += pdfs.length
    }

    allErrorLog.push(...errorLog)
    offset += batchLimit
    process.stdout.write(`\r  Makale: ${Math.min(offset, effectiveTotal)}/${effectiveTotal}`)
  }
  console.log()

  await logErrors(sb, runId, allErrorLog.slice(0, 100))
  await finishRun(sb, runId, {
    rowsRead: effectiveTotal,
    rowsInserted: articlesDone,
    rowsUpdated: 0,
    rowsSkipped: totalSkipped,
    rowsError: totalErrors,
  }, totalErrors > 0 ? 'partial' : 'success')

  console.log(`✅ articles : ${articlesDone} upsert | skip: ${totalSkipped} | hata: ${totalErrors}`)
  console.log(`✅ pdf_files: ${pdfsDone} upsert`)
  await pool.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
