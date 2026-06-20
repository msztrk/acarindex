import { Client } from 'pg'
import * as fs from 'fs'

const conn = 'postgresql://postgres:7QcSSeWS8ppGVzRs@db.yvyibenutgnocrighbmj.supabase.co:5432/postgres'

async function main() {
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const sql = fs.readFileSync('D:/acarindex-web/supabase/migrations/014_fix_platform_stats_timeout.sql', 'utf8')
  try {
    await client.query(sql)
    console.log('✅ 014 uygulandı')
  } catch (e: any) {
    console.error('❌', e.message)
  }

  // Verify
  const r = await client.query('SELECT * FROM platform_stats')
  console.log('platform_stats:', r.rows[0])
  await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })
