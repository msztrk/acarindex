/**
 * 017–018–019 migration dosyalarını staging Postgres'e uygular.
 * SUPABASE_DB_URL (.env.staging) zorunlu.
 */
import fs from 'fs'
import path from 'path'
import pg from 'pg'
import { loadStagingEnv, maskProjectRef, writeSnapshot } from './env'

const AUTHOR_MIGRATIONS = [
  '017_authors_relation_integrity.sql',
  '018_authors_source_key.sql',
  '019_split_ambiguous_provisional_authors.sql',
]

const BASE_MIGRATIONS = fs
  .readdirSync(path.resolve(process.cwd(), 'supabase/migrations'))
  .filter((f) => /^\d{3}_.*\.sql$/.test(f))
  .sort()
  .filter((f) => {
    const n = parseInt(f.slice(0, 3), 10)
    return n >= 1 && n <= 16
  })

async function runSql(client: pg.Client, filePath: string): Promise<void> {
  const sql = fs.readFileSync(filePath, 'utf8')
  await client.query(sql)
}

async function tableExists(client: pg.Client, table: string): Promise<boolean> {
  const res = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  )
  return res.rowCount !== null && res.rowCount > 0
}

async function migrationHistory(client: pg.Client): Promise<string[]> {
  const has = await tableExists(client, 'supabase_migrations')
  if (!has) {
    const hasSchema = await tableExists(client, 'schema_migrations')
    if (!hasSchema) return []
    const res = await client.query(`SELECT version FROM schema_migrations ORDER BY version`)
    return res.rows.map((r) => String(r.version))
  }
  const res = await client.query(
    `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version`,
  ).catch(() => ({ rows: [] as Array<{ version: string }> }))
  return res.rows.map((r) => r.version)
}

async function main() {
  const staging = loadStagingEnv()
  if (!staging.dbUrl) {
    throw new Error('.env.staging: SUPABASE_DB_URL zorunlu (migration uygulama için)')
  }

  const client = new pg.Client({ connectionString: staging.dbUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const phase = process.argv[2] ?? 'author'
  const applied: string[] = []

  try {
    const authorsExists = await tableExists(client, 'authors')
    if (!authorsExists && phase !== 'base') {
      throw new Error('authors tablosu yok — önce: npx tsx scripts/staging/apply-migrations.ts base')
    }

    if (phase === 'base' || phase === 'all') {
      for (const file of BASE_MIGRATIONS) {
        const full = path.resolve(process.cwd(), 'supabase/migrations', file)
        console.log(`Applying ${file}...`)
        await runSql(client, full)
        applied.push(file)
      }
    }

    if (phase === 'author' || phase === 'all') {
      for (const file of AUTHOR_MIGRATIONS) {
        const full = path.resolve(process.cwd(), 'supabase/migrations', file)
        console.log(`Applying ${file}...`)
        await runSql(client, full)
        applied.push(file)
      }
    }

    if (phase === 'idempotency-019') {
      const only = path.resolve(
        process.cwd(),
        'supabase/migrations/019_split_ambiguous_provisional_authors.sql',
      )
      const beforeAuthors = await client.query(`SELECT COUNT(*)::int AS c FROM authors`)
      const beforeAa = await client.query(`SELECT COUNT(*)::int AS c FROM article_authors`)
      await client.query('BEGIN')
      try {
        await runSql(client, only)
        await client.query('ROLLBACK')
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
      const afterAuthors = await client.query(`SELECT COUNT(*)::int AS c FROM authors`)
      const afterAa = await client.query(`SELECT COUNT(*)::int AS c FROM article_authors`)
      const report = {
        test: '019_transaction_rollback_noop',
        authors_before: beforeAuthors.rows[0].c,
        authors_after: afterAuthors.rows[0].c,
        article_authors_before: beforeAa.rows[0].c,
        article_authors_after: afterAa.rows[0].c,
        noop:
          beforeAuthors.rows[0].c === afterAuthors.rows[0].c
          && beforeAa.rows[0].c === afterAa.rows[0].c,
      }
      const file = writeSnapshot(`idempotency-019-${Date.now()}`, report)
      console.log(JSON.stringify({ snapshot: file, ...report }, null, 2))
      await client.end()
      return
    }

    const history = await migrationHistory(client)
    const report = {
      target_ref_masked: maskProjectRef(staging.url),
      applied_files: applied,
      migration_history_count: history.length,
    }
    const file = writeSnapshot(`apply-migrations-${phase}-${Date.now()}`, report)
    console.log(JSON.stringify({ snapshot: file, ...report }, null, 2))
  } finally {
    await client.end().catch(() => {})
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
