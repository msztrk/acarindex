/**
 * Pilot ETL dry-run — MySQL kaynak → PostgreSQL hedef kapsam analizi (yazma yok).
 *
 * Kullanım:
 *   npx tsx scripts/etl-pg/pilot-dry-run.ts
 *   npx tsx scripts/etl-pg/pilot-dry-run.ts --article-limit=5000
 */
import mysql from 'mysql2/promise'
import { resolveSourceMysqlConfig } from '../source/mysql-config'
import { validateEtlEnv, logEtlConnectionSummary } from '../lib/etl-guard'
import { authorColumnFillSql } from '../../lib/etl/article-author-source'

const PILOT_JOURNAL_COUNT = 15
const DEFAULT_ARTICLE_LIMIT = 8000

function parseLimit(argv: string[]): number {
  const arg = argv.find((a) => a.startsWith('--article-limit='))
  if (!arg) return DEFAULT_ARTICLE_LIMIT
  const n = parseInt(arg.split('=')[1] ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_ARTICLE_LIMIT
}

async function main() {
  const articleLimit = parseLimit(process.argv)
  const mysqlOnly = process.argv.includes('--mysql-only')

  if (!mysqlOnly) {
    const guard = validateEtlEnv()
    logEtlConnectionSummary(guard)
  } else {
    console.log('  Mod: mysql-only (hedef PostgreSQL doğrulaması atlandı)')
  }

  const mysqlCfg = resolveSourceMysqlConfig()
  const conn = await mysql.createConnection({
    host: mysqlCfg.host,
    port: mysqlCfg.port,
    user: mysqlCfg.user,
    password: mysqlCfg.password,
    database: mysqlCfg.database,
    decimalNumbers: true,
  })

  const fill = authorColumnFillSql()

  const [journalRows] = await conn.query<mysql.RowDataPacket[]>(
  `SELECT DergiID, DergiBASLIK, Aktif
     FROM dergiler
     ORDER BY Hit DESC, DergiID ASC
     LIMIT ?`,
    [PILOT_JOURNAL_COUNT],
  )

  const journalIds = journalRows.map((r) => r.DergiID as number)
  if (journalIds.length === 0) {
    throw new Error('Pilot dergi seçilemedi — kaynak dergiler tablosu boş?')
  }

  const placeholders = journalIds.map(() => '?').join(',')
  const [issueCountRow] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM dergi_arsiv WHERE DergiID IN (${placeholders})`,
    journalIds,
  )
  const [articleCountRow] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM makaleler WHERE DergiID IN (${placeholders})`,
    journalIds,
  )
  const [pilotArticleSample] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM (
       SELECT MakaleID FROM makaleler
       WHERE DergiID IN (${placeholders})
       ORDER BY MakaleID ASC
       LIMIT ?
     ) t`,
    [...journalIds, articleLimit],
  )
  const [authorsFilled] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM makaleler
     WHERE DergiID IN (${placeholders}) AND ${fill.yazarlarFilled}`,
    journalIds,
  )
  const [pdfCount] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM makaleler
     WHERE DergiID IN (${placeholders})
       AND PdfLINK IS NOT NULL AND PdfLINK != '' AND PdfLINK != 'pdf-bulunamadi'`,
    journalIds,
  )

  await conn.end()

  const report = {
    mode: 'dry-run',
    pilot_journals: journalIds.length,
    journal_ids_sample: journalIds.slice(0, 5),
    issues_in_pilot_journals: Number(issueCountRow[0]?.c ?? 0),
    articles_in_pilot_journals: Number(articleCountRow[0]?.c ?? 0),
    articles_to_transfer_cap: articleLimit,
    articles_in_pilot_sample: Number(pilotArticleSample[0]?.c ?? 0),
    articles_with_yazarlar: Number(authorsFilled[0]?.c ?? 0),
    articles_with_pdf: Number(pdfCount[0]?.c ?? 0),
    authors_raw_source_column: 'Yazarlar',
    author_registry_mode: 'provisional-only',
    writes_to_postgres: false,
    next_step: 'DATABASE_URL + npm run db:migrate sonra scripts/etl-pg/pilot-run.ts --dry-run',
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
