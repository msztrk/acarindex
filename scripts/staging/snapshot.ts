/**
 * Migration öncesi/sonrası katalog snapshot (staging veya --env-file ile).
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'
import { assertNotProductionTarget, writeSnapshot } from './env'

const AMBIGUOUS_AUTHOR_IDS = [5, 6, 15, 20, 23, 29, 30, 69, 130]

async function loadAll<T extends Record<string, unknown>>(
  sb: ReturnType<typeof createClient>,
  table: string,
  select: string,
): Promise<T[]> {
  const rows: T[] = []
  let offset = 0
  while (true) {
    const { data, error } = await sb.from(table).select(select).range(offset, offset + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    rows.push(...(data as T[]))
    if (data.length < 1000) break
    offset += 1000
  }
  return rows
}

async function main() {
  const phase = process.argv[2] ?? 'snapshot'
  dotenv.config({ path: path.resolve(process.cwd(), '.env.staging'), override: true })
  if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) throw new Error('SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli')

  const allowProd = process.argv.includes('--allow-production-read')
  if (!allowProd) assertNotProductionTarget(url, 'snapshot hedefi')

  const sb = createClient(url, key, { auth: { persistSession: false } })

  const aa = await loadAll<{
    article_id: number
    author_id: number
    author_position: number | null
  }>(sb, 'article_authors', 'article_id, author_id, author_position')

  const authors = await loadAll<{
    id: number
    is_provisional: boolean
    source_key: string | null
  }>(sb, 'authors', 'id, is_provisional, source_key')

  const relByAuthor = new Map<number, typeof aa>()
  for (const r of aa) {
    const list = relByAuthor.get(r.author_id) ?? []
    list.push(r)
    relByAuthor.set(r.author_id, list)
  }

  let dupPair = 0
  let dupPos = 0
  let badPos = 0
  const pairSet = new Set<string>()
  const posByArticle = new Map<number, Set<number>>()
  for (const r of aa) {
    const pk = `${r.article_id}:${r.author_id}`
    if (pairSet.has(pk)) dupPair++
    pairSet.add(pk)
    if (r.author_position != null && r.author_position <= 0) badPos++
    const set = posByArticle.get(r.article_id) ?? new Set()
    if (r.author_position != null && set.has(r.author_position)) dupPos++
    if (r.author_position != null) set.add(r.author_position)
    posByArticle.set(r.article_id, set)
  }

  let canonical = 0
  let provisional = 0
  let multiRelationProvisional = 0
  let linkedNullSk = 0
  let orphanProvisional = 0
  const skSet = new Set<string>()
  let dupSk = 0

  for (const a of authors) {
    if (a.is_provisional) provisional++
    else canonical++
    const rels = relByAuthor.get(a.id) ?? []
    if (a.is_provisional && rels.length > 1) multiRelationProvisional++
    if (a.is_provisional && rels.length === 0) orphanProvisional++
    if (a.is_provisional && rels.length > 0 && a.source_key == null) linkedNullSk++
    if (a.source_key) {
      if (skSet.has(a.source_key)) dupSk++
      skSet.add(a.source_key)
    }
  }

  const ambiguousDetail = AMBIGUOUS_AUTHOR_IDS.map((id) => {
    const rels = relByAuthor.get(id) ?? []
    return {
      author_id: id,
      relation_count: rels.length,
      article_positions: rels.map((r) => ({
        article_id: r.article_id,
        author_position: r.author_position,
      })),
    }
  })

  const snapshot = {
    phase,
    captured_at: new Date().toISOString(),
    totals: {
      authors: authors.length,
      canonical,
      provisional,
      article_authors: aa.length,
      multi_relation_provisional: multiRelationProvisional,
      linked_provisional_null_source_key: linkedNullSk,
      orphan_provisional: orphanProvisional,
      duplicate_article_author: dupPair,
      duplicate_article_position: dupPos,
      duplicate_source_key: dupSk,
      position_le_zero: badPos,
    },
    ambiguous_authors: ambiguousDetail,
  }

  const file = writeSnapshot(`migration-${phase}-${Date.now()}`, snapshot)
  console.log(JSON.stringify({ snapshot_file: file, ...snapshot.totals }, null, 2))
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
