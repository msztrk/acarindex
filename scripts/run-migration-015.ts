import { Client } from 'pg'
import * as fs from 'fs'

const conn = 'postgresql://postgres:7QcSSeWS8ppGVzRs@db.yvyibenutgnocrighbmj.supabase.co:5432/postgres'

async function main() {
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const sql = fs.readFileSync('D:/acarindex-web/supabase/migrations/015_authors_model_fix.sql', 'utf8')
  try {
    await client.query(sql)
    console.log('✅ 015_authors_model_fix.sql uygulandı')
  } catch (e: any) {
    console.error('❌', e.message)
  }

  // Verify columns
  const cols = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name IN ('authors', 'article_authors')
    ORDER BY table_name, ordinal_position
  `)
  console.log('\nKolon yapısı:')
  for (const r of cols.rows) {
    console.log(`  ${r.table_name ?? ''}.${r.column_name} (${r.data_type})`)
  }

  await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })
