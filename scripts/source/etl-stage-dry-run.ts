/**
 * ETL aşamaları için salt okunur dry-run özeti (Supabase'e yazmaz).
 */
import { createConnection } from 'mysql2/promise'
import { resolveSourceMysqlConfig } from './mysql-config'

async function scalarCount(conn: Awaited<ReturnType<typeof createConnection>>, sql: string): Promise<number> {
  const [rows] = await conn.query(sql)
  return Number((rows as { c: number }[])[0]?.c ?? 0)
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

  const stage = process.argv[2] ?? 'all'
  const out: Record<string, unknown> = { database: cfg.database, stage }

  if (stage === 'all' || stage === '01') {
    out.etl_01_journals = {
      dergiler_total: await scalarCount(conn, `SELECT COUNT(*) AS c FROM dergiler`),
      dergiler_active: await scalarCount(conn, `SELECT COUNT(*) AS c FROM dergiler WHERE Aktif = 1`),
      empty_title: await scalarCount(
        conn,
        `SELECT COUNT(*) AS c FROM dergiler WHERE DergiBASLIK IS NULL OR DergiBASLIK = ''`,
      ),
      kategoriler_total: await scalarCount(conn, `SELECT COUNT(*) AS c FROM kategoriler`),
      writes_to_supabase: false,
    }
  }

  if (stage === 'all' || stage === '02') {
    out.etl_02_issues = {
      dergi_arsiv_total: await scalarCount(conn, `SELECT COUNT(*) AS c FROM dergi_arsiv`),
      orphan_journal_id: await scalarCount(conn, `
        SELECT COUNT(*) AS c FROM dergi_arsiv a
        LEFT JOIN dergiler d ON d.DergiID = a.DergiID
        WHERE a.DergiID IS NOT NULL AND d.DergiID IS NULL
      `),
      duplicate_year_issue_sets: await scalarCount(conn, `
        SELECT COUNT(*) AS c FROM (
          SELECT DergiID, Yil, Sayi, COUNT(*) AS n
          FROM dergi_arsiv
          GROUP BY DergiID, Yil, Sayi
          HAVING n > 1
        ) t
      `),
      writes_to_supabase: false,
    }
  }

  if (stage === 'all' || stage === '03') {
    out.etl_03_articles = {
      makaleler_total: await scalarCount(conn, `SELECT COUNT(*) AS c FROM makaleler`),
      with_pdf_link: await scalarCount(
        conn,
        `SELECT COUNT(*) AS c FROM makaleler WHERE PdfLINK IS NOT NULL AND PdfLINK != ''`,
      ),
      orphan_issue: await scalarCount(conn, `
        SELECT COUNT(*) AS c FROM makaleler m
        LEFT JOIN dergi_arsiv a ON a.ArsivID = m.ArsivID
        WHERE m.ArsivID IS NOT NULL AND m.ArsivID > 0 AND a.ArsivID IS NULL
      `),
      writes_to_supabase: false,
    }
  }

  if (stage === 'all' || stage === '04') {
    out.etl_04_authors = {
      yazarlar_registry_total: await scalarCount(conn, `SELECT COUNT(*) AS c FROM yazarlar`),
      articles_with_authors_raw: await scalarCount(
        conn,
        `SELECT COUNT(*) AS c FROM makaleler WHERE Yazarlar IS NOT NULL AND TRIM(Yazarlar) != ''`,
      ),
      note: 'Author ETL hedefi Supabase articles; kaynak yazarlar registry + makaleler.Yazarlar',
      writes_to_supabase: false,
    }
  }

  await conn.end()
  console.log(JSON.stringify(out, null, 2))
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
