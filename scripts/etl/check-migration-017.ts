/**
 * Migration 017 öncesi/sonrası kalite kontrolleri (Supabase REST üzerinden).
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

  console.log(JSON.stringify({
    phase: label,
    article_authors_total: rows.length,
    duplicate_article_author: dupPairs,
    duplicate_position: dupPos,
    position_le_zero: badPos,
    authors_total: authorCount,
    empty_names: emptyNames,
  }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
