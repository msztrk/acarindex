import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { requireDatabaseUrl } from './lib/database-url';

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
  const client = new Client({ connectionString: requireDatabaseUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to Supabase!');
  
  for (const file of migFiles) {
    const sqlPath = path.join(process.cwd(), 'supabase/migrations', file);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    try {
      await client.query(sql);
      console.log('OK: ' + file);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('HATA: ' + file + ': ' + msg.slice(0, 100))
    }
  }
  
  await client.end();
  console.log('Migrations tamamlandi!');
}

main().catch(e => { console.error(e); process.exit(1); });
