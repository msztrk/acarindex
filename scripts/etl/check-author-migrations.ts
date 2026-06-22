/**
 * Migration 017/018/019 kalite kontrolleri.
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function loadArticleAuthors() {
  const rows: Array<{
    article_id: number
    author_id: number
    author_position: number | null
  }> = []
  let offset = 0
  while (true) {
    const { data, error } = await sb
      .from('article_authors')
      .select('article_id, author_id, author_position')
      .range(offset, offset + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...(data as typeof rows))
    if (data.length < 1000) break
    offset += 1000
  }
  return rows
}

async function loadProvisionalAuthors(hasSourceKey: boolean) {
  const rows: Array<{ id: number; source_key: string | null }> = []
  let offset = 0
  while (true) {
    const selectCols = hasSourceKey ? 'id, source_key' : 'id'
    const { data, error } = await sb
      .from('authors')
      .select(selectCols)
      .eq('is_provisional', true)
      .range(offset, offset + 999)
    if (error) throw error
    if (!data?.length) break
    for (const r of data as Array<Record<string, unknown>>) {
      rows.push({
        id: r.id as number,
        source_key: hasSourceKey ? ((r.source_key as string | null) ?? null) : null,
      })
    }
    if (data.length < 1000) break
    offset += 1000
  }
  return rows
}

async function main() {
  const phase = process.argv[2] ?? 'pre'
  const rows = await loadArticleAuthors()

  let dupPair = 0
  const pairSet = new Set<string>()
  let dupPos = 0
  let badPos = 0
  const posByArticle = new Map<number, Set<number>>()

  for (const r of rows) {
    const pk = `${r.article_id}:${r.author_id}`
    if (pairSet.has(pk)) dupPair++
    pairSet.add(pk)
    if (r.author_position != null && r.author_position <= 0) badPos++
    const set = posByArticle.get(r.article_id) ?? new Set()
    if (r.author_position != null && set.has(r.author_position)) dupPos++
    if (r.author_position != null) set.add(r.author_position)
    posByArticle.set(r.article_id, set)
  }

  const relByAuthor = new Map<number, typeof rows>()
  for (const r of rows) {
    const list = relByAuthor.get(r.author_id) ?? []
    list.push(r)
    relByAuthor.set(r.author_id, list)
  }

  const { error: skErr } = await sb.from('authors').select('source_key').limit(1)
  const sourceKeyColumn = !skErr?.message?.includes('source_key')

  let multiRelationProvisional = 0
  let linkedProvisionalNullSk = 0
  let orphanProvisional = 0

  const provisionalAuthors = await loadProvisionalAuthors(sourceKeyColumn)
  for (const a of provisionalAuthors) {
    const rels = relByAuthor.get(a.id) ?? []
    if (rels.length > 1) multiRelationProvisional++
    if (rels.length === 0) orphanProvisional++
    if (rels.length > 0 && a.source_key == null) linkedProvisionalNullSk++
  }

  const { count: authorsTotal } = await sb.from('authors').select('*', { count: 'exact', head: true })
  const { count: emptyNames } = await sb
    .from('authors')
    .select('*', { count: 'exact', head: true })
    .or('name.is.null,name.eq.')

  let duplicateSourceKey = 0
  if (sourceKeyColumn) {
    const skSet = new Set<string>()
    let offset = 0
    while (true) {
      const { data } = await sb
        .from('authors')
        .select('source_key')
        .not('source_key', 'is', null)
        .range(offset, offset + 999)
      if (!data?.length) break
      for (const r of data ?? []) {
        const k = r.source_key as string
        if (skSet.has(k)) duplicateSourceKey++
        skSet.add(k)
      }
      if (data.length < 1000) break
      offset += 1000
    }
  }

  console.log(
    JSON.stringify(
      {
        phase,
        article_authors_total: rows.length,
        duplicate_article_author: dupPair,
        duplicate_position: dupPos,
        duplicate_source_key: duplicateSourceKey,
        position_le_zero: badPos,
        linked_provisional_null_source_key: linkedProvisionalNullSk,
        multi_relation_provisional: multiRelationProvisional,
        orphan_provisional: orphanProvisional,
        authors_total: authorsTotal,
        empty_names: emptyNames,
        source_key_column: sourceKeyColumn,
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
