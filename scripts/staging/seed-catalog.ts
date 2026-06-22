/**
 * Staging'e katalog alt kümesi seed (production read-only → staging write).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'
import {
  assertNotProductionTarget,
  isProductionSupabaseUrl,
  loadProductionReadEnv,
  loadStagingEnv,
  writeSnapshot,
} from './env'

const AMBIGUOUS_AUTHOR_IDS = [5, 6, 15, 20, 23, 29, 30, 69, 130]
const PUBLISHED_ARTICLE_TARGET = 1000

async function paginate<T>(
  sb: SupabaseClient,
  table: string,
  select: string,
  filter?: (q: ReturnType<SupabaseClient['from']>) => ReturnType<SupabaseClient['from']>,
): Promise<T[]> {
  const rows: T[] = []
  let offset = 0
  while (true) {
    let q = sb.from(table).select(select)
    if (filter) q = filter(q) as typeof q
    const { data, error } = await q.range(offset, offset + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    rows.push(...(data as T[]))
    if (data.length < 1000) break
    offset += 1000
  }
  return rows
}

async function upsertBatches(
  sb: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<number> {
  const CHUNK = 200
  let n = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK)
    const { error } = await sb.from(table).upsert(batch, { onConflict })
    if (error) throw new Error(`${table} upsert: ${error.message}`)
    n += batch.length
  }
  return n
}

async function main() {
  const staging = loadStagingEnv()
  assertNotProductionTarget(staging.url, 'seed hedefi')

  dotenv.config({ path: path.resolve(process.cwd(), '.env.staging'), override: true })
  const sourceUrl = process.env.SOURCE_SUPABASE_URL
    ?? loadProductionReadEnv().url
  const sourceKey = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY
    ?? loadProductionReadEnv().serviceRoleKey

  if (!isProductionSupabaseUrl(sourceUrl) && !process.env.SOURCE_SUPABASE_URL) {
    console.warn('Kaynak staging gibi görünüyor; SOURCE_* ile production read-only tanımlayın')
  }

  const source = createClient(sourceUrl, sourceKey, { auth: { persistSession: false } })
  const target = createClient(staging.url, staging.serviceRoleKey, { auth: { persistSession: false } })

  if (sourceUrl === staging.url) {
    throw new Error('Kaynak ve hedef aynı Supabase URL — seed durduruldu')
  }

  const priorityAa = await paginate<{ article_id: number; author_id: number }>(
    source,
    'article_authors',
    'article_id, author_id',
    (q) => q.in('author_id', AMBIGUOUS_AUTHOR_IDS),
  )

  const articleIdSet = new Set(priorityAa.map((r) => r.article_id))

  const published = await paginate<{ id: number }>(
    source,
    'articles',
    'id',
    (q) => q.eq('status', 'published').order('id', { ascending: true }),
  )
  for (const a of published) {
    if (articleIdSet.size >= PUBLISHED_ARTICLE_TARGET + priorityAa.length) break
    articleIdSet.add(a.id)
    if (articleIdSet.size >= PUBLISHED_ARTICLE_TARGET) break
  }

  const articleIds = [...articleIdSet]
  const articles = await paginate<Record<string, unknown>>(
    source,
    'articles',
    '*',
    (q) => q.in('id', articleIds),
  )

  const journalIds = [...new Set(articles.map((a) => a.journal_id as number).filter(Boolean))]
  const issueIds = [
    ...new Set(articles.map((a) => a.issue_id as number).filter((id) => id != null)),
  ]

  const journals = journalIds.length
    ? await paginate<Record<string, unknown>>(source, 'journals', '*', (q) => q.in('id', journalIds))
    : []

  const categoryIds = [
    ...new Set(journals.map((j) => j.category_id as number).filter((id) => id != null)),
  ]
  const categories = categoryIds.length
    ? await paginate<Record<string, unknown>>(source, 'categories', '*', (q) => q.in('id', categoryIds))
    : []

  const issues = issueIds.length
    ? await paginate<Record<string, unknown>>(source, 'issues', '*', (q) => q.in('id', issueIds))
    : []

  const allAa = await paginate<Record<string, unknown>>(
    source,
    'article_authors',
    '*',
    (q) => q.in('article_id', articleIds),
  )

  const authorIds = [...new Set(allAa.map((r) => r.author_id as number))]
  const authors = await paginate<Record<string, unknown>>(
    source,
    'authors',
    '*',
    (q) => q.in('id', authorIds),
  )

  const etlRuns = await paginate<Record<string, unknown>>(
    source,
    'etl_runs',
    '*',
    (q) => q.order('started_at', { ascending: false }),
  )
  const etlSample = etlRuns.slice(0, 100)

  const counts = {
    categories: await upsertBatches(target, 'categories', categories, 'id'),
    journals: await upsertBatches(target, 'journals', journals, 'id'),
    issues: await upsertBatches(target, 'issues', issues, 'id'),
    articles: await upsertBatches(target, 'articles', articles, 'id'),
    authors: await upsertBatches(target, 'authors', authors, 'id'),
    article_authors: await upsertBatches(target, 'article_authors', allAa, 'article_id,author_id'),
    etl_runs: etlSample.length
      ? await upsertBatches(target, 'etl_runs', etlSample, 'id')
      : 0,
  }

  const report = {
    seeded_at: new Date().toISOString(),
    article_ids: articleIds.length,
    ambiguous_authors_included: AMBIGUOUS_AUTHOR_IDS,
    counts,
  }
  const file = writeSnapshot(`seed-catalog-${Date.now()}`, report)
  console.log(JSON.stringify({ snapshot: file, ...report }, null, 2))
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
