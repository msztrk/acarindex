import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const conn = 'postgresql://postgres:7QcSSeWS8ppGVzRs@db.yvyibenutgnocrighbmj.supabase.co:5432/postgres';

const migFiles = [
  '001_journals_issues.sql',
  '002_articles_pdf.sql', 
  '003_authors_junctions.sql',
  '004_rls_stats.sql',
  '005_authors_bigserial_unique.sql',
  '006_trgm_indexes.sql',
  '007_institutions.sql',
  '008_users_profiles.sql',
  '009_keywords.sql',
  '010_journal_applications.sql',
  '011_legacy_raw_archive.sql',
  '012_etl_audit.sql',
];

async function main() {
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to Supabase!');
  
  for (const file of migFiles) {
    const sqlPath = path.join('D:/acarindex-web/supabase/migrations', file);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    try {
      await client.query(sql);
      console.log('OK: ' + file);
    } catch (e: any) {
      console.error('HATA: ' + file + ': ' + e.message.slice(0,100));
    }
  }
  
  await client.end();
  console.log('Migrations tamamlandi!');
}

main().catch(e => { console.error(e); process.exit(1); });
