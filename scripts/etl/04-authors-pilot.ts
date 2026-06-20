/**
 * 04-authors-pilot.ts
 *
 * Pilot makalelerden (articles tablosundaki mevcut kayıtlar) ilk 200 farklı
 * yazarı çıkarır ve authors + article_authors tablolarına yükler.
 *
 * Kurallar:
 *  - authors_raw alanını virgül/noktalı virgül ile ayır
 *  - Her unique isim için 1 author kaydı oluştur (is_provisional=true)
 *  - Aynı ismi birden fazla makalede karşılaşırsan aynı author_id kullan
 *  - article_authors.raw_author_name = parse öncesi orijinal token
 *  - article_authors.author_position = 1-N sıra
 */

import { createClient } from '@supabase/supabase-js'
import { urlYap } from '../../lib/urls/slug'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const AUTHOR_LIMIT = 200

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli (.env.local)')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY)

// ─── Türkçe karakter normalize ───────────────────────────────────────────────
function normalizeName(raw: string): string {
  return raw
    .trim()
    // garbled latin-1 → türkçe karakterler (ortak bozulma kalıpları)
    .replace(/Ã¼/g, 'ü').replace(/Ã–/g, 'Ö').replace(/Ã¶/g, 'ö')
    .replace(/Ã§/g, 'ç').replace(/Ã‡/g, 'Ç').replace(/Åž/g, 'Ş')
    .replace(/ÅŸ/g, 'ş').replace(/Ä°/g, 'İ').replace(/Äą/g, 'ı')
    .replace(/ÄŸ/g, 'ğ').replace(/Ä/g, 'Ğ').replace(/Ã¼/g, 'ü')
    // artık temiz string
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Parse: "Ahmet YILMAZ; Mehmet ÇELİK, Ayşe DEMİR" → token array ─────────
function parseAuthorsRaw(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(/[;,]+/)
    .map(s => normalizeName(s))
    .filter(s => s.length > 1 && s.length < 120)
}

async function main() {
  console.log('=== Pilot Author ETL başlıyor ===\n')

  // 1. Pilot makaleleri çek (authors_raw dolu olanlar)
  console.log('📖 Pilot makaleler çekiliyor...')
  const { data: articles, error: artErr } = await sb
    .from('articles')
    .select('id, authors_raw')
    .not('authors_raw', 'is', null)
    .neq('authors_raw', '')
    .order('id', { ascending: true })

  if (artErr) { console.error('Makale sorgu hatası:', artErr.message); process.exit(1) }
  console.log(`  ${articles!.length} makale bulundu`)

  // 2. Unique yazar isimleri topla (200 limite kadar)
  const nameToArticles = new Map<string, Array<{ article_id: number; position: number; raw: string }>>()

  for (const art of articles!) {
    const tokens = parseAuthorsRaw(art.authors_raw)
    for (let i = 0; i < tokens.length; i++) {
      const name = tokens[i]
      if (!nameToArticles.has(name)) {
        if (nameToArticles.size >= AUTHOR_LIMIT) continue
        nameToArticles.set(name, [])
      }
      nameToArticles.get(name)!.push({
        article_id: art.id,
        position: i + 1,
        raw: tokens[i],
      })
    }
    if (nameToArticles.size >= AUTHOR_LIMIT) break
  }

  console.log(`  ${nameToArticles.size} unique yazar toplandı`)

  // 3. Authors upsert (ad bazlı — provisional)
  const authorRows = Array.from(nameToArticles.keys()).map(name => ({
    name,
    slug: urlYap(name),
    is_provisional: true,
  }))

  console.log('\n👤 Authors upsert ediliyor...')
  const { data: insertedAuthors, error: authErr } = await sb
    .from('authors')
    .insert(authorRows)
    .select('id, name')

  if (authErr) {
    console.error('Authors insert hatası:', authErr.message)
    process.exit(1)
  }

  const nameToId = new Map<string, number>()
  for (const a of insertedAuthors ?? []) {
    nameToId.set(a.name, a.id)
  }
  console.log(`  ✅ ${nameToId.size} yazar eklendi`)

  // 4. article_authors insert
  console.log('\n🔗 article_authors ekleniyor...')
  const aaRows: Array<{
    article_id: number
    author_id: number
    author_position: number
    raw_author_name: string
  }> = []

  for (const [name, entries] of nameToArticles.entries()) {
    const authorId = nameToId.get(name)
    if (!authorId) continue
    for (const entry of entries) {
      aaRows.push({
        article_id: entry.article_id,
        author_id: authorId,
        author_position: entry.position,
        raw_author_name: entry.raw,
      })
    }
  }

  // Upsert in batches of 500
  let aaOk = 0, aaErr = 0
  for (let i = 0; i < aaRows.length; i += 500) {
    const batch = aaRows.slice(i, i + 500)
    const { error } = await sb
      .from('article_authors')
      .upsert(batch, { onConflict: 'article_id,author_id', ignoreDuplicates: true })
    if (error) {
      console.warn(`  Batch ${i}-${i+500} hata:`, error.message)
      aaErr += batch.length
    } else {
      aaOk += batch.length
    }
  }

  console.log(`  ✅ ${aaOk} kayıt eklendi, ${aaErr} hata`)

  // 5. Final sayım
  const { count: authorCount } = await sb.from('authors').select('*', { count: 'exact', head: true })
  const { count: aaCount } = await sb.from('article_authors').select('*', { count: 'exact', head: true })

  console.log('\n=== Sonuç ===')
  console.log(`  authors: ${authorCount}`)
  console.log(`  article_authors: ${aaCount}`)
  console.log('  is_provisional=true (tüm kayıtlar doğrulama bekliyor)\n')
}

main().catch(e => { console.error(e); process.exit(1) })
