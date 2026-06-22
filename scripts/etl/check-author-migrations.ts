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

  const { count: authorsTotal } = await sb.from('authors').select('*', { count: 'exact', head: true })
  const { count: emptyNames } = await sb
    .from('authors')
    .select('*', { count: 'exact', head: true })
    .or('name.is.null,name.eq.')

  let sourceKeyChecks: Record<string, unknown> = { column: false }
  const { error: skErr } = await sb.from('authors').select('source_key').limit(1)
  if (!skErr?.message?.includes('source_key')) {
    const { count: skNullCanon } = await sb
      .from('authors')
      .select('*', { count: 'exact', head: true })
      .eq('is_provisional', false)
      .is('source_key', null)
    const { count: skNullProv } = await sb
      .from('authors')
      .select('*', { count: 'exact', head: true })
      .eq('is_provisional', true)
      .is('source_key', null)

    const { data: skAll } = await sb.from('authors').select('source_key').not('source_key', 'is', null).limit(10000)
    const skSet = new Set<string>()
    let dupSk = 0
    for (const r of skAll ?? []) {
      const k = r.source_key as string
      if (skSet.has(k)) dupSk++
      skSet.add(k)
    }

    sourceKeyChecks = {
      column: true,
      null_canonical: skNullCanon,
      null_provisional: skNullProv,
      duplicate_source_key_sample: dupSk,
    }
  }

  console.log(
    JSON.stringify(
      {
        phase,
        article_authors_total: rows.length,
        duplicate_article_author: dupPair,
        duplicate_position: dupPos,
        position_le_zero: badPos,
        authors_total: authorsTotal,
        empty_names: emptyNames,
        source_key: sourceKeyChecks,
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
