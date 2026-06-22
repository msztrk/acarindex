/**
 * Restore sonrası kaynak veri envanteri (salt okunur sorgular).
 */
import { createConnection } from 'mysql2/promise'
import { resolveSourceMysqlConfig } from './mysql-config'
import { authorColumnFillSql } from '../../lib/etl/article-author-source'

const CORE_TABLES = [
  'kategoriler',
  'dergiler',
  'dergi_arsiv',
  'makaleler',
  'yazarlar',
] as const

async function tableCount(
  conn: Awaited<ReturnType<typeof createConnection>>,
  table: string,
): Promise<number | null> {
  try {
    const [rows] = await conn.query<Array<{ c: number }>>(`SELECT COUNT(*) AS c FROM \`${table}\``)
    return Number((rows as unknown as { c: number }[])[0]?.c ?? 0)
  } catch {
    return null
  }
}

async function main() {
  const cfg = resolveSourceMysqlConfig()
  const conn = await createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    decimalNumbers: true,
  })

  const counts: Record<string, number | null> = {}
  for (const t of CORE_TABLES) {
    counts[t] = await tableCount(conn, t)
  }

  const [makaleStatsRows] = await conn.query(`
    SELECT
      MIN(MakaleID) AS min_id,
      MAX(MakaleID) AS max_id,
      SUM(CASE WHEN Yazarlar IS NULL OR Yazarlar = '' THEN 1 ELSE 0 END) AS empty_authors,
      SUM(CASE WHEN TitleTR IS NULL OR TitleTR = '' THEN 1 ELSE 0 END) AS empty_title,
      SUM(CASE WHEN PdfLINK IS NOT NULL AND PdfLINK != '' THEN 1 ELSE 0 END) AS with_pdf
    FROM makaleler
  `).catch(() => [[]])
  const makaleStats = (makaleStatsRows as Record<string, unknown>[])[0] ?? null

  const [orphanIssueRows] = await conn.query(`
    SELECT COUNT(*) AS c
    FROM makaleler m
    LEFT JOIN dergi_arsiv a ON a.ArsivID = m.ArsivID
    WHERE m.ArsivID IS NOT NULL AND m.ArsivID > 0 AND a.ArsivID IS NULL
  `).catch(() => [[{ c: null }]])

  const [orphanJournalRows] = await conn.query(`
    SELECT COUNT(*) AS c
    FROM makaleler m
    LEFT JOIN dergiler d ON d.DergiID = m.DergiID
    WHERE m.DergiID IS NOT NULL AND d.DergiID IS NULL
  `).catch(() => [[{ c: null }]])

  const [orphanIssueOnIssuesRows] = await conn.query(`
    SELECT COUNT(*) AS c
    FROM dergi_arsiv a
    LEFT JOIN dergiler d ON d.DergiID = a.DergiID
    WHERE a.DergiID IS NOT NULL AND d.DergiID IS NULL
  `).catch(() => [[{ c: null }]])

  const fillSql = authorColumnFillSql()
  const [authorCompareRows] = await conn.query(`
    SELECT
      SUM(CASE WHEN ${fillSql.yazarlarFilled} THEN 1 ELSE 0 END) AS yazarlar_filled,
      SUM(CASE WHEN ${fillSql.kaynakcaFilled} THEN 1 ELSE 0 END) AS kaynakca_filled,
      SUM(CASE WHEN ${fillSql.bothFilled} THEN 1 ELSE 0 END) AS both_filled,
      SUM(CASE WHEN ${fillSql.onlyYazarlar} THEN 1 ELSE 0 END) AS only_yazarlar,
      SUM(CASE WHEN ${fillSql.onlyKaynakca} THEN 1 ELSE 0 END) AS only_kaynakca
    FROM makaleler
  `).catch(() => [[]])
  const authorCompare = (authorCompareRows as Record<string, unknown>[])[0] ?? null

  const [authorsRawRows] = await conn.query(`
    SELECT COUNT(*) AS c FROM makaleler
    WHERE ${fillSql.yazarlarFilled}
  `).catch(() => [[{ c: null }]])

  const [tableList] = await conn.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name`,
  )

  await conn.end()

  const report = {
    database: cfg.database,
    table_count: (tableList as { TABLE_NAME?: string; table_name?: string }[]).length,
    core_counts: counts,
    makaleler: makaleStats,
    author_column_compare: authorCompare,
    authors_raw_filled_articles: (authorsRawRows as { c: number }[])[0]?.c ?? null,
    authors_raw_source_column: 'Yazarlar',
    orphan_issue_on_articles: (orphanIssueRows as { c: number }[])[0]?.c ?? null,
    orphan_journal_on_articles: (orphanJournalRows as { c: number }[])[0]?.c ?? null,
    orphan_journal_on_issues: (orphanIssueOnIssuesRows as { c: number }[])[0]?.c ?? null,
    estimates_comparison: {
      expected_journals_approx: 3790,
      expected_issues_approx: 96779,
      expected_authors_approx: 35752,
      expected_authors_raw_articles_approx: 1020235,
    },
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
