/**
 * Çoklu ilişkili provisional author raporu (katalog alanları).
 */
import { createClient } from '@supabase/supabase-js'
import { buildAuthorUrl } from '../../lib/urls/author'

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { error: skProbe } = await sb.from('authors').select('source_key').limit(1)
  const hasSourceKey = !skProbe?.message?.includes('source_key')

  const authors: Array<{
    id: number
    name: string
    legacy_id: number | null
    source_key: string | null
    slug: string | null
    is_provisional: boolean
  }> = []
  let offset = 0
  while (true) {
    const selectCols = hasSourceKey
      ? 'id, name, legacy_id, source_key, slug, is_provisional'
      : 'id, name, legacy_id, slug, is_provisional'
    const { data, error } = await sb
      .from('authors')
      .select(selectCols)
      .eq('is_provisional', true)
      .range(offset, offset + 999)
    if (error) throw error
    if (!data?.length) break
    for (const row of data as Array<Record<string, unknown>>) {
      authors.push({
        id: row.id as number,
        name: row.name as string,
        legacy_id: (row.legacy_id as number | null) ?? null,
        source_key: hasSourceKey ? ((row.source_key as string | null) ?? null) : null,
        slug: (row.slug as string | null) ?? null,
        is_provisional: row.is_provisional as boolean,
      })
    }
    if (data.length < 1000) break
    offset += 1000
  }

  const aa: Array<{ article_id: number; author_id: number; author_position: number | null }> = []
  offset = 0
  while (true) {
    const { data, error } = await sb
      .from('article_authors')
      .select('article_id, author_id, author_position')
      .range(offset, offset + 999)
    if (error) throw error
    if (!data?.length) break
    aa.push(...(data as typeof aa))
    if (data.length < 1000) break
    offset += 1000
  }

  const byAuthor = new Map<number, typeof aa>()
  for (const r of aa) {
    const list = byAuthor.get(r.author_id) ?? []
    list.push(r)
    byAuthor.set(r.author_id, list)
  }

  const posByArticle = new Map<string, number[]>()
  for (const r of aa) {
    if (r.author_position == null) continue
    const k = `${r.article_id}:${r.author_position}`
    const list = posByArticle.get(k) ?? []
    list.push(r.author_id)
    posByArticle.set(k, list)
  }

  const ambiguous: Array<Record<string, unknown>> = []

  for (const a of authors) {
    const rels = byAuthor.get(a.id) ?? []
    const distinctArticles = new Set(rels.map((r) => r.article_id))
    const distinctPositions = new Set(rels.map((r) => r.author_position).filter((p) => p != null))
    const multiArticle = distinctArticles.size > 1
    const multiPosSameArticle =
      rels.length > 1 &&
      distinctArticles.size === 1 &&
      distinctPositions.size > 1

    const isAmbiguous =
      rels.length > 1 &&
      (distinctArticles.size > 1 || distinctPositions.size > 1)
    if (!isAmbiguous) continue

    const relationDetails = rels.map((r) => {
      const posKey = r.author_position != null ? `${r.article_id}:${r.author_position}` : null
      const occupiers = posKey ? posByArticle.get(posKey) ?? [] : []
      const otherOccupiers = occupiers.filter((id) => id !== a.id)
      return {
        article_id: r.article_id,
        author_position: r.author_position,
        expected_source_key:
          r.author_position != null
            ? `article:${r.article_id}:position:${r.author_position}`
            : null,
        position_slot_occupied_by_count: occupiers.length,
        position_conflict_with_other_authors: otherOccupiers.length > 0,
        other_author_ids_on_same_slot: otherOccupiers,
      }
    })

    ambiguous.push({
      author_id: a.id,
      name: a.name,
      legacy_id: a.legacy_id,
      source_key: a.source_key,
      relation_count: rels.length,
      distinct_article_count: distinctArticles.size,
      distinct_position_count: distinctPositions.size,
      multi_article: multiArticle,
      multi_position_same_article: multiPosSameArticle,
      relations: relationDetails,
      profile_url: buildAuthorUrl({ id: a.id, slug: a.slug }),
    })
  }

  console.log(
    JSON.stringify(
      {
        source_key_column: hasSourceKey,
        ambiguous_provisional_count: ambiguous.length,
        authors: ambiguous,
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
