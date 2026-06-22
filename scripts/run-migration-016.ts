import { Client } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import { requireDatabaseUrl } from './lib/database-url'

async function main() {
  const client = new Client({ connectionString: requireDatabaseUrl(), ssl: { rejectUnauthorized: false } })
  await client.connect()

  const sqlPath = path.join(process.cwd(), 'supabase/migrations/016_platform_stats_accessible_pdf.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  try {
    await client.query(sql)
    console.log('✅ 016 uygulandı')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('❌', msg)
  }

  const r = await client.query('SELECT journal_count, article_count, pdf_count FROM platform_stats')
  console.log('platform_stats:', r.rows[0])
  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
