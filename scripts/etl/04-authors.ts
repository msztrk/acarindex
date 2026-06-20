/**
 * ETL 04 — makaleler.Yazarlar → authors + article_authors
 *
 * Strateji:
 * - Yazar isimleri `authors.name` UNIQUE constraint üzerinden upsert edilir.
 * - id DB tarafından bigserial ile üretilir (manuel atama YOK).
 * - Aynı script tekrar çalıştırıldığında duplicate üretmez.
 *
 * Ön koşul: 03-articles.ts çalıştırılmış olmalı.
 */

import { getMysqlPool, getSupabaseAdmin } from './db'
import { urlYap } from '../../lib/urls/slug'
import { parseAuthors, normalizeAuthorName } from '../../lib/etl/utils'
import type mysql from 'mysql2/promise'

const BATCH_SIZE = 1000

interface LegacyMakaleAuthors {
  MakaleID: number
  Yazarlar: string | null
}

async function main() {
  console.log('👥 ETL 04 — yazarlar → authors + article_authors başlıyor...')
  const pool = getMysqlPool()
  const sb = getSupabaseAdmin()

  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT MakaleID, Yazarlar FROM makaleler ORDER BY MakaleID ASC',
  )
  console.log(`  ${rows.length} makale okundu.`)

  // ─── 1) Benzersiz normalize edilmiş yazar isimleri ───────────────────────
  const uniqueNamesSet = new Set<string>()
  for (const row of rows as LegacyMakaleAuthors[]) {
    for (const name of parseAuthors(row.Yazarlar)) {
      const normalized = normalizeAuthorName(name)
      if (normalized.length >= 2) uniqueNamesSet.add(normalized)
    }
  }
  console.log(`  ${uniqueNamesSet.size} benzersiz yazar ismi bulundu.`)

  // ─── 2) authors upsert — id DB üretir, conflict: name ───────────────────
  const authorInserts = Array.from(uniqueNamesSet).map((name) => ({
    name,
    slug: urlYap(name),
    // id yok — bigserial tarafından üretilir
  }))

  let authorsDone = 0
  let authorErrors = 0
  for (let i = 0; i < authorInserts.length; i += BATCH_SIZE) {
    const batch = authorInserts.slice(i, i + BATCH_SIZE)
    const { error } = await sb
      .from('authors')
      .upsert(batch, { onConflict: 'name', ignoreDuplicates: false })
    if (error) {
      console.error(`  [HATA] authors batch:`, error.message)
      authorErrors += batch.length
    } else {
      authorsDone += batch.length
    }
    process.stdout.write(`\r  authors: ${Math.min(i + BATCH_SIZE, authorInserts.length)}/${authorInserts.length}`)
  }
  console.log(`\n  authors: ${authorsDone} upsert, ${authorErrors} hata`)

  // ─── 3) Supabase'den name → id haritası ─────────────────────────────────
  console.log('  Yazar ID haritası yükleniyor...')
  const authorNameToId = new Map<string, number>()
  let fetchOffset = 0
  const FETCH_SIZE = 1000
  while (true) {
    const { data } = await sb
      .from('authors')
      .select('id, name')
      .range(fetchOffset, fetchOffset + FETCH_SIZE - 1)
    if (!data || data.length === 0) break
    for (const a of data as { id: number; name: string }[]) {
      authorNameToId.set(a.name, a.id)
    }
    if (data.length < FETCH_SIZE) break
    fetchOffset += FETCH_SIZE
  }
  console.log(`  ${authorNameToId.size} yazar ID'si yüklendi.`)

  // ─── 4) article_authors junction ────────────────────────────────────────
  const junctionRows: { article_id: number; author_id: number; position: number; raw_name: string }[] = []

  for (const row of rows as LegacyMakaleAuthors[]) {
    const parsed = parseAuthors(row.Yazarlar)
    parsed.forEach((rawName, idx) => {
      const normalized = normalizeAuthorName(rawName)
      const authorId = authorNameToId.get(normalized)
      if (authorId) {
        junctionRows.push({
          article_id: row.MakaleID,
          author_id: authorId,
          position: idx + 1,
          raw_name: rawName,
        })
      }
    })
  }
  console.log(`  ${junctionRows.length} article_author junction kaydı oluşturuldu.`)

  let junctionDone = 0
  let junctionErrors = 0
  for (let i = 0; i < junctionRows.length; i += BATCH_SIZE) {
    const batch = junctionRows.slice(i, i + BATCH_SIZE)
    const { error } = await sb
      .from('article_authors')
      .upsert(batch, { onConflict: 'article_id,author_id' })
    if (error) {
      console.error(`  [HATA] article_authors batch:`, error.message)
      junctionErrors += batch.length
    } else {
      junctionDone += batch.length
    }
    process.stdout.write(`\r  article_authors: ${Math.min(i + BATCH_SIZE, junctionRows.length)}/${junctionRows.length}`)
  }
  console.log()

  console.log(`\n✅ authors: ${authorsDone} upsert`)
  console.log(`✅ article_authors: ${junctionDone} upsert, ${junctionErrors} hata`)
  await pool.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
