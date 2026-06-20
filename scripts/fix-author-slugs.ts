/**
 * Pilot yazar slug'larını urlYap() ile yeniden üretir.
 * Örn: i-smail-senturk → ismail-senturk (İsmail ŞENTÜRK)
 *
 * Çalıştır: npx tsx --env-file=.env.local scripts/fix-author-slugs.ts
 */

import { createClient } from '@supabase/supabase-js'
import { urlYap } from '../lib/urls/slug'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli (.env.local)')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  const { data: authors, error } = await sb.from('authors').select('id, name, slug')
  if (error) {
    console.error('Sorgu hatası:', error.message)
    process.exit(1)
  }

  let updated = 0
  for (const a of authors ?? []) {
    const slug = urlYap(a.name)
    if (!slug || slug === a.slug) continue
    const { error: upErr } = await sb.from('authors').update({ slug }).eq('id', a.id)
    if (upErr) {
      console.warn(`id=${a.id} (${a.name}): ${upErr.message}`)
    } else {
      console.log(`id=${a.id}: ${a.slug} → ${slug}`)
      updated++
    }
  }

  console.log(`\n✅ ${updated} slug güncellendi (${authors?.length ?? 0} yazar tarandı)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
