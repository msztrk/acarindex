/**
 * Migration 017/018 öncesi/sonrası kalite kontrolleri (Supabase REST üzerinden).
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function loadAllArticleAuthors() {
  const rows: Array<{ article_id: number; author_id: number; author_position: number | null }> = []
  let offset = 0
  const SIZE = 1000
  while (true) {
    const { data, error } = await sb
      .from('article_authors')
      .select('article_id, author_id, author_position')
      .range(offset, offset + SIZE - 1)
    if (error) throw error
    if (!data?.length) break
    rows.push(...(data as typeof rows))
    if (data.length < SIZE) break
    offset += SIZE
  }
  return rows
}

async function main() {
  const label = process.argv[2] ?? 'pre'
  const rows = await loadAllArticleAuthors()

  const pairSet = new Set<string>()
  let dupPairs = 0
  const posMap = new Map<number, Map<number, number>>()
  let dupPos = 0
  let badPos = 0

  for (const r of rows) {
    const pk = `${r.article_id}:${r.author_id}`
    if (pairSet.has(pk)) dupPairs++
    pairSet.add(pk)

    if (r.author_position != null && r.author_position <= 0) badPos++
    const articlePos = posMap.get(r.article_id) ?? new Map()
    if (r.author_position != null) {
      if (articlePos.has(r.author_position)) dupPos++
      articlePos.set(r.author_position, r.author_id)
    }
    posMap.set(r.article_id, articlePos)
  }

  const { count: authorCount } = await sb.from('authors').select('*', { count: 'exact', head: true })
  const { count: emptyNames } = await sb
    .from('authors')
    .select('*', { count: 'exact', head: true })
    .or('name.is.null,name.eq.')

  let sourceKeyColumnExists = true
  let duplicateSourceKey = 0
  let nullCanonicalSourceKey = 0
  let nullProvisionalSourceKey = 0

  const { data: sourceRows, error: sourceErr } = await sb
    .from('authors')
    .select('id, is_provisional, source_key')
    .limit(200000)

  if (sourceErr) {
    sourceKeyColumnExists = false
  } else {
    const seen = new Set<string>()
    for (const row of sourceRows ?? []) {
      const sourceKey = row.source_key as string | null
      const provisional = row.is_provisional as boolean | null
      if (!sourceKey) {
        if (provisional) nullProvisionalSourceKey++
        else nullCanonicalSourceKey++
      } else {
        if (seen.has(sourceKey)) duplicateSourceKey++
        seen.add(sourceKey)
      }
    }
  }

  const { data: provisionalAuthors } = await sb
    .from('authors')
    .select('id')
    .eq('is_provisional', true)
    .limit(200000)

  let provisionalWithoutRelation = 0
  let provisionalMultiRelation = 0
  const provisionalIds = new Set((provisionalAuthors ?? []).map((r) => r.id as number))
  const relByAuthor = new Map<number, Set<number>>()
  for (const row of rows) {
    if (!provisionalIds.has(row.author_id)) continue
    const set = relByAuthor.get(row.author_id) ?? new Set<number>()
    set.add(row.article_id)
    relByAuthor.set(row.author_id, set)
  }
  for (const id of provisionalIds) {
    const rel = relByAuthor.get(id)
    if (!rel || rel.size === 0) provisionalWithoutRelation++
    else if (rel.size > 1) provisionalMultiRelation++
  }

  console.log(JSON.stringify({
    phase: label,
    article_authors_total: rows.length,
    duplicate_article_author: dupPairs,
    duplicate_position: dupPos,
    position_le_zero: badPos,
    authors_total: authorCount,
    empty_names: emptyNames,
    source_key_column_exists: sourceKeyColumnExists,
    duplicate_source_key: duplicateSourceKey,
    null_source_key_canonical: nullCanonicalSourceKey,
    null_source_key_provisional: nullProvisionalSourceKey,
    provisional_without_relation: provisionalWithoutRelation,
    provisional_multi_article_relations: provisionalMultiRelation,
  }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
