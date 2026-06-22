import { Client } from 'pg'

import { requireDatabaseUrl } from './lib/database-url'

const fixes: Array<{ id: number; name_tr: string; name_en: string }> = [
  { id: 1, name_tr: 'Ekonomi',                                            name_en: 'Economics' },
  { id: 2, name_tr: 'Teknoloji',                                          name_en: 'Technology' },
  { id: 3, name_tr: 'Sosyal Bilimler Veri Tabanı',                        name_en: 'Social Sciences' },
  { id: 4, name_tr: 'Sağlık Bilimleri',                                   name_en: 'Health Sciences' },
  { id: 5, name_tr: 'Mühendislik ve Temel Bilimler Veri Tabanı',          name_en: 'Engineering & Sciences' },
  { id: 6, name_tr: 'Mühendislik ve Temel Bilimler Veri Tabanı (Ek)',     name_en: 'Engineering & Sciences (Ext)' },
  { id: 7, name_tr: 'Hukuk Veri Tabanı',                                  name_en: 'Law' },
  { id: 8, name_tr: 'Yaşam Bilimleri Veri Tabanı',                        name_en: 'Life Sciences' },
]

async function main() {
  const client = new Client({ connectionString: requireDatabaseUrl(), ssl: { rejectUnauthorized: false } })
  await client.connect()

  for (const fix of fixes) {
    const r = await client.query(
      'UPDATE categories SET name_tr=$1, name_en=$2 WHERE id=$3 RETURNING id, name_tr',
      [fix.name_tr, fix.name_en, fix.id]
    )
    if (r.rowCount) {
      console.log(`✅ id=${fix.id}: ${r.rows[0].name_tr}`)
    } else {
      console.log(`⚠️  id=${fix.id}: kayıt bulunamadı`)
    }
  }

  await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })
