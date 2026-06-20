import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  const { data: authors } = await sb
    .from('authors')
    .select('id, name, slug, is_provisional')
    .order('id')
    .limit(5)

  for (const a of authors ?? []) {
    const { data: links } = await sb
      .from('article_authors')
      .select(`
        article_id, raw_author_name, author_position,
        article:articles ( id, title_tr, legacy_journal_slug, slug, authors_raw )
      `)
      .eq('author_id', a.id)
      .limit(3)

    console.log(`--- id=${a.id} name=${a.name} provisional=${a.is_provisional} slug=${a.slug}`)
    for (const l of links ?? []) {
      const art = l.article as {
        id: number; title_tr: string | null; slug: string; legacy_journal_slug: string; authors_raw: string | null
      } | null
      console.log(`  pos=${l.author_position} raw=${l.raw_author_name}`)
      if (art) {
        console.log(`    article=${art.id} url=/${art.legacy_journal_slug}/${art.slug}-${art.id}`)
        console.log(`    authors_raw contains name? ${art.authors_raw?.includes(a.name.split(' ')[0] ?? '')}`)
      }
    }
  }

  const { data: all } = await sb.from('authors').select('name')
  const counts: Record<string, number> = {}
  for (const x of all ?? []) counts[x.name] = (counts[x.name] ?? 0) + 1
  const dups = Object.entries(counts).filter(([, c]) => c > 1)
  console.log(`\nDuplicate names in pilot set: ${dups.length}`)
  if (dups.length) console.log(dups.slice(0, 5))
}

main()
