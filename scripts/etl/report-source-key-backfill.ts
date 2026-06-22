/**
 * source_key backfill öncesi doğrulama raporu.
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { error: colErr } = await sb.from('authors').select('source_key').limit(1)
  const hasColumn = !colErr?.message?.includes('source_key')

  const { count: totalAuthors } = await sb.from('authors').select('*', { count: 'exact', head: true })
  const { count: provisional } = await sb
    .from('authors')
    .select('*', { count: 'exact', head: true })
    .eq('is_provisional', true)
  const { count: canonical } = await sb
    .from('authors')
    .select('*', { count: 'exact', head: true })
    .eq('is_provisional', false)

  let withSourceKey = 0
  if (hasColumn) {
    const { count } = await sb
      .from('authors')
      .select('*', { count: 'exact', head: true })
      .not('source_key', 'is', null)
    withSourceKey = count ?? 0
  }

  // Provisional multi-relation authors
  const aaRows: Array<{ author_id: number; article_id: number; author_position: number | null }> = []
  let offset = 0
  while (true) {
    const { data } = await sb
      .from('article_authors')
      .select('author_id, article_id, author_position')
      .range(offset, offset + 999)
    if (!data?.length) break
    aaRows.push(...(data as typeof aaRows))
    if (data.length < 1000) break
    offset += 1000
  }

  const relCount = new Map<number, number>()
  const provKeys = new Map<string, number[]>()
  for (const r of aaRows) {
    relCount.set(r.author_id, (relCount.get(r.author_id) ?? 0) + 1)
    if (r.author_position != null) {
      const key = `article:${r.article_id}:position:${r.author_position}`
      const list = provKeys.get(key) ?? []
      list.push(r.author_id)
      provKeys.set(key, list)
    }
  }

  let multiRelProvisional = 0
  let orphanProvisional = 0
  const duplicateSourceKeyCandidates: string[] = []

  for (const [key, ids] of provKeys) {
    if (ids.length > 1 && duplicateSourceKeyCandidates.length < 20) {
      duplicateSourceKeyCandidates.push(`${key} → author_ids ${ids.join(',')}`)
    }
  }

  if (hasColumn) {
    const { data: provAuthors } = await sb
      .from('authors')
      .select('id')
      .eq('is_provisional', true)
      .limit(5000)
    for (const a of provAuthors ?? []) {
      const c = relCount.get(a.id as number) ?? 0
      if (c > 1) multiRelProvisional++
      if (c === 0) orphanProvisional++
    }
  }

  console.log(
    JSON.stringify(
      {
        source_key_column: hasColumn,
        totalAuthors,
        provisional,
        canonical,
        withSourceKey,
        multiRelationProvisionalSampled: multiRelProvisional,
        orphanProvisionalSampled: orphanProvisional,
        duplicateSourceKeyCandidates,
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
