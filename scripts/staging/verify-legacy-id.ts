/**
 * legacy_id packed formül doğrulaması (read-only).
 * Varsayılan: .env.local production şeması; migration öncesi çalıştırılır.
 */
import { createClient } from '@supabase/supabase-js'
import { loadProductionReadEnv, writeSnapshot } from './env'
import { splitProvisionalLegacyId } from '../../lib/etl/provisional-author-split'
import { provisionalLegacyId } from '../../lib/etl/author-utils'

const SPLIT_MULTIPLIER = 10_000_000

async function paginate<T>(
  fetchPage: (offset: number) => Promise<T[]>,
): Promise<T[]> {
  const all: T[] = []
  let offset = 0
  while (true) {
    const page = await fetchPage(offset)
    if (!page.length) break
    all.push(...page)
    if (page.length < 1000) break
    offset += 1000
  }
  return all
}

async function main() {
  const { url, serviceRoleKey } = loadProductionReadEnv()
  const sb = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

  const { data: colInfo, error: colErr } = await sb.from('authors').select('legacy_id').limit(1)
  if (colErr) throw colErr
  void colInfo

  const maxArticle = await sb
    .from('articles')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .single()

  const aaRows = await paginate(async (offset) => {
    const { data, error } = await sb
      .from('article_authors')
      .select('article_id, author_position')
      .not('author_position', 'is', null)
      .range(offset, offset + 999)
    if (error) throw error
    return data ?? []
  })

  const legacyRows = await paginate(async (offset) => {
    const { data, error } = await sb
      .from('authors')
      .select('legacy_id')
      .not('legacy_id', 'is', null)
      .lt('legacy_id', 0)
      .range(offset, offset + 999)
    if (error) throw error
    return data ?? []
  })

  const maxArticleId = (maxArticle.data?.id as number) ?? 0
  const maxPosition = aaRows.reduce(
    (m, r) => Math.max(m, r.author_position as number),
    0,
  )

  const packedMax = maxArticleId * SPLIT_MULTIPLIER + maxPosition
  const fitsBigint = packedMax <= Number.MAX_SAFE_INTEGER
  const fitsInt32 = packedMax <= 2_147_483_647
  const noteInt32 = fitsInt32
    ? 'int32 aralığında'
    : 'int32 aşılıyor; PostgreSQL bigint ve JS safe integer aralığında güvenli'

  const splitKeys = new Set<string>()
  let splitCollision = 0
  for (const r of aaRows) {
    const aid = r.article_id as number
    const pos = r.author_position as number
    if (pos >= SPLIT_MULTIPLIER) {
      splitCollision++
    }
    const leg = splitProvisionalLegacyId(aid, pos)
    const key = `${leg}`
    if (splitKeys.has(key)) splitCollision++
    splitKeys.add(key)
  }

  const oldPacked = new Set<number>()
  const newPacked = new Set<number>()
  for (const r of aaRows) {
    const aid = r.article_id as number
    const pos = r.author_position as number
    oldPacked.add(provisionalLegacyId(aid, pos))
    newPacked.add(splitProvisionalLegacyId(aid, pos))
  }
  let crossCollision = 0
  for (const v of oldPacked) {
    if (newPacked.has(v)) crossCollision++
  }

  const existingLegacy = new Set(legacyRows.map((r) => r.legacy_id as number))
  let existingCollision = 0
  for (const r of aaRows) {
    const leg = splitProvisionalLegacyId(r.article_id as number, r.author_position as number)
    if (existingLegacy.has(leg)) existingCollision++
  }

  const report = {
    legacy_id_column_note: 'Supabase şemasında authors.legacy_id bigint (migration 003)',
    split_formula: '-((article_id::bigint * 10000000::bigint) + author_position::bigint)',
    max_article_id: maxArticleId,
    max_author_position: maxPosition,
    author_position_under_multiplier: maxPosition < SPLIT_MULTIPLIER,
    packed_max: packedMax,
    fits_js_safe_integer: fitsBigint,
    fits_int32: fitsInt32,
    int32_note: noteInt32,
    distinct_split_pairs: splitKeys.size,
    split_pair_collisions: splitCollision,
    old_vs_new_packed_cross_collisions: crossCollision,
    existing_negative_legacy_collision_with_split: existingCollision,
    migration_safe: splitCollision === 0 && crossCollision === 0 && maxPosition < SPLIT_MULTIPLIER,
  }

  const out = writeSnapshot(`legacy-id-verify-${Date.now()}`, report)
  console.log(JSON.stringify({ snapshot: out, ...report }, null, 2))
  if (!report.migration_safe) process.exit(1)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
