import { Client } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

const conn = 'postgresql://postgres:7QcSSeWS8ppGVzRs@db.yvyibenutgnocrighbmj.supabase.co:5432/postgres'

async function main() {
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const sql = fs.readFileSync(
    path.join('D:/acarindex-web/supabase/migrations/013_etl_status_interrupted.sql'),
    'utf8'
  )

  try {
    await client.query(sql)
    console.log('✅ 013_etl_status_interrupted.sql uygulandı')
  } catch (e: any) {
    console.error('❌ Hata:', e.message)
  }

  // Verify
  const res = await client.query(`
    SELECT id, script, status, finished_at
    FROM etl_runs
    ORDER BY id DESC
    LIMIT 5
  `)
  console.log('\netl_runs son durum:')
  for (const r of res.rows) {
    console.log(`  id=${r.id} script=${r.script} status=${r.status} finished=${r.finished_at ? 'evet' : 'NULL'}`)
  }

  await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })
