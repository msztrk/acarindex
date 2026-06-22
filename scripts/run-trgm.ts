import { Client } from 'pg';
import * as fs from 'fs';
import { requireDatabaseUrl } from './lib/database-url';

async function main() {
  const client = new Client({ connectionString: requireDatabaseUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  // pg_trgm extension
  await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
  console.log('pg_trgm extension OK');
  
  // Her CONCURRENTLY index'ini ayrı ayrı çalıştır
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_journals_title_trgm ON journals USING gin (title_tr gin_trgm_ops);',
    'CREATE INDEX IF NOT EXISTS idx_articles_title_tr_trgm ON articles USING gin (title_tr gin_trgm_ops);',
    'CREATE INDEX IF NOT EXISTS idx_articles_title_en_trgm ON articles USING gin (title_en gin_trgm_ops);',
    'CREATE INDEX IF NOT EXISTS idx_articles_authors_raw_trgm ON articles USING gin (authors_raw gin_trgm_ops);',
  ];
  
  for (const sql of indexes) {
    try {
      await client.query(sql);
      console.log('OK: ' + sql.slice(30, 70));
    } catch(e: any) {
      console.error('HATA: ' + e.message.slice(0,80));
    }
  }
  
  await client.end();
  console.log('Trgm indexes done!');
}
main().catch(e => { console.error(e); process.exit(1); });
