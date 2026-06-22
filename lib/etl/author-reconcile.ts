/**
 * Yazar ilişkisi reconciliation: eksik/kısmi makale tespiti ve backfill.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { parseAuthorList, type ArticleAuthorRow } from './author-utils'
import {
  ensureAuthorsSourceKeyColumn,
  upsertAuthorsBySourceKey,
  fetchAuthorIdsBySourceKey,
} from './author-upsert'
import {
  planAuthorsForArticle,
  toAuthorUpsertRow,
  type PlannedAuthor,
  type YazarlarRegistry,
  AuthorEtlErrorType,
  type AuthorEtlCounters,
  createAuthorEtlCounters,
  bumpError,
  processArticleAuthors,
  type ExistingArticleRelations,
} from './run-authors-etl'

export interface ArticleCoverageState {
  articleId: number
  authorsRaw: string
  expectedCount: number
  relationCount: number
  status: 'complete' | 'missing' | 'partial' | 'unparseable' | 'empty_raw'
}

export interface ReconcileReport {
  totalPublished: number
  withAuthorsRaw: number
  withRelations: number
  missingRelations: number
  partialRelations: number
  unparseable: number
  emptyRaw: number
  toProcess: number
  afterStillMissing: number
  afterStillPartial: number
  samples: {
    missing: number[]
    partial: Array<{ id: number; expected: number; actual: number }>
  }
}

export interface ReconcileScanOptions {
  skipNonPublished: boolean
  batchSize: number
  limit?: number
}

async function fetchPublishedArticleBatch(
  sb: SupabaseClient,
  cursor: number,
  batchSize: number,
  skipNonPublished: boolean,
): Promise<ArticleAuthorRow[]> {
  let q = sb
    .from('articles')
    .select('id, authors_raw, status')
    .gt('id', cursor)
    .order('id', { ascending: true })
    .limit(batchSize)
  if (skipNonPublished) q = q.eq('status', 'published')
  const { data, error } = await q
  if (error) throw new Error(`articles scan: ${error.message}`)
  return (data ?? []) as ArticleAuthorRow[]
}

async function fetchRelationMapForArticles(
  sb: SupabaseClient,
  articleIds: number[],
): Promise<Map<number, ExistingArticleRelations>> {
  const map = new Map<number, ExistingArticleRelations>()
  if (articleIds.length === 0) return map

  const CHUNK = 200
  for (let i = 0; i < articleIds.length; i += CHUNK) {
    const chunk = articleIds.slice(i, i + CHUNK)
    const { data, error } = await sb
      .from('article_authors')
      .select('article_id, author_id, author_position')
      .in('article_id', chunk)
    if (error) throw new Error(`article_authors fetch: ${error.message}`)
    for (const row of data ?? []) {
      const aid = row.article_id as number
      const entry = map.get(aid) ?? { authorIds: new Set<number>(), positions: new Map<number, number>() }
      entry.authorIds.add(row.author_id as number)
      if (row.author_position != null) {
        entry.positions.set(row.author_position as number, row.author_id as number)
      }
      map.set(aid, entry)
    }
  }
  return map
}

export function classifyArticleCoverage(
  article: ArticleAuthorRow,
  relations: ExistingArticleRelations | undefined,
): ArticleCoverageState {
  const raw = article.authors_raw?.trim() ?? ''
  if (!raw) {
    return { articleId: article.id, authorsRaw: '', expectedCount: 0, relationCount: 0, status: 'empty_raw' }
  }
  const expected = parseAuthorList(raw).length
  const relationCount = relations?.authorIds.size ?? 0
  if (expected === 0) {
    return { articleId: article.id, authorsRaw: raw, expectedCount: 0, relationCount, status: 'unparseable' }
  }
  if (relationCount === 0) {
    return { articleId: article.id, authorsRaw: raw, expectedCount: expected, relationCount, status: 'missing' }
  }
  if (relationCount < expected) {
    return {
      articleId: article.id,
      authorsRaw: raw,
      expectedCount: expected,
      relationCount,
      status: 'partial',
    }
  }
  return { articleId: article.id, authorsRaw: raw, expectedCount: expected, relationCount, status: 'complete' }
}

export async function scanArticleCoverage(
  sb: SupabaseClient,
  opts: ReconcileScanOptions,
): Promise<{ states: ArticleCoverageState[]; report: ReconcileReport }> {
  const states: ArticleCoverageState[] = []
  let cursor = 0
  let scanned = 0
  const limit = opts.limit ?? Number.POSITIVE_INFINITY

  while (scanned < limit) {
    const batchSize = Math.min(opts.batchSize, limit - scanned)
    const articles = await fetchPublishedArticleBatch(sb, cursor, batchSize, opts.skipNonPublished)
    if (articles.length === 0) break

    const relMap = await fetchRelationMapForArticles(sb, articles.map((a) => a.id))
    for (const art of articles) {
      states.push(classifyArticleCoverage(art, relMap.get(art.id)))
    }

    cursor = articles[articles.length - 1].id
    scanned += articles.length
    if (articles.length < batchSize) break
  }

  const report = buildReconcileReport(states)
  return { states, report }
}

export function buildReconcileReport(states: ArticleCoverageState[]): ReconcileReport {
  let withAuthorsRaw = 0
  let withRelations = 0
  let missing = 0
  let partial = 0
  let unparseable = 0
  let emptyRaw = 0
  const missingSamples: number[] = []
  const partialSamples: Array<{ id: number; expected: number; actual: number }> = []

  for (const s of states) {
    if (s.status === 'empty_raw') emptyRaw++
    else withAuthorsRaw++
    if (s.relationCount > 0) withRelations++
    if (s.status === 'missing') {
      missing++
      if (missingSamples.length < 20) missingSamples.push(s.articleId)
    }
    if (s.status === 'partial') {
      partial++
      if (partialSamples.length < 20) {
        partialSamples.push({ id: s.articleId, expected: s.expectedCount, actual: s.relationCount })
      }
    }
    if (s.status === 'unparseable') unparseable++
  }

  const toProcess = missing + partial

  return {
    totalPublished: states.length,
    withAuthorsRaw,
    withRelations,
    missingRelations: missing,
    partialRelations: partial,
    unparseable,
    emptyRaw,
    toProcess,
    afterStillMissing: 0,
    afterStillPartial: 0,
    samples: { missing: missingSamples, partial: partialSamples },
  }
}

export function printReconcileReport(report: ReconcileReport, label = 'Reconcile'): void {
  console.log(`\n=== ${label} Raporu ===`)
  console.log(`  Toplam yayımlanmış makale: ${report.totalPublished}`)
  console.log(`  authors_raw dolu: ${report.withAuthorsRaw}`)
  console.log(`  İlişkisi olan: ${report.withRelations}`)
  console.log(`  İlişkisi olmayan: ${report.missingRelations}`)
  console.log(`  Kısmi ilişkili: ${report.partialRelations}`)
  console.log(`  Parse edilemeyen: ${report.unparseable}`)
  console.log(`  Boş yazar metni: ${report.emptyRaw}`)
  console.log(`  İşlenecek kayıt: ${report.toProcess}`)
  if (report.afterStillMissing || report.afterStillPartial) {
    console.log(`  Sonrası hâlâ eksik: ${report.afterStillMissing}`)
    console.log(`  Sonrası hâlâ kısmi: ${report.afterStillPartial}`)
  }
  if (report.samples.missing.length) {
    console.log(`  Eksik örnek ID: ${report.samples.missing.join(', ')}`)
  }
  if (report.samples.partial.length) {
    console.log('  Kısmi örnekler:')
    report.samples.partial.forEach((p) =>
      console.log(`    id=${p.id} expected=${p.expected} actual=${p.actual}`),
    )
  }
}

export interface MissingOnlyRunOptions {
  sb: SupabaseClient
  registry: YazarlarRegistry
  dryRun: boolean
  skipNonPublished: boolean
  batchSize: number
  limit?: number
  existingSourceKeys?: Set<string>
  existingLegacyIds?: Set<number>
  existingRelations?: Set<string>
}

export interface MissingOnlyRunResult {
  counters: AuthorEtlCounters
  report: ReconcileReport
  processedArticleIds: number[]
}

export async function runMissingOnlyAuthorsEtl(opts: MissingOnlyRunOptions): Promise<MissingOnlyRunResult> {
  const counters = createAuthorEtlCounters()
  const existingSourceKeys = opts.existingSourceKeys ?? new Set<string>()
  const existingLegacy = opts.existingLegacyIds ?? new Set<number>()
  const existingRelations = opts.existingRelations ?? new Set<string>()
  const processedArticleIds: number[] = []

  if (!opts.dryRun) {
    await ensureAuthorsSourceKeyColumn(opts.sb)
  }

  const { states: beforeStates } = await scanArticleCoverage(opts.sb, {
    skipNonPublished: opts.skipNonPublished,
    batchSize: opts.batchSize,
    limit: opts.limit,
  })
  const report = buildReconcileReport(beforeStates)

  const needsWork = beforeStates.filter((s) => s.status === 'missing' || s.status === 'partial')
  const articleIds = needsWork.map((s) => s.articleId)

  // Batch article fetch + relation map
  const CHUNK = opts.batchSize
  for (let i = 0; i < articleIds.length; i += CHUNK) {
    const idChunk = articleIds.slice(i, i + CHUNK)
    const { data: articles, error } = await opts.sb
      .from('articles')
      .select('id, authors_raw, status')
      .in('id', idChunk)
    if (error) throw new Error(`articles by id: ${error.message}`)

    const relMap = await fetchRelationMapForArticles(opts.sb, idChunk)
    const plannedAuthors: PlannedAuthor[] = []

    for (const art of (articles ?? []) as ArticleAuthorRow[]) {
      counters.articlesRead++
      const existing = relMap.get(art.id)
      const result = planAuthorsForArticle(art, opts.registry, opts.skipNonPublished)
      if (result.skipped) {
        counters.articlesSkipped++
        if (result.errorType) bumpError(counters, result.errorType)
        continue
      }

      const { toCreate, errors } = processArticleAuthors(result.authors, existing)
      for (const err of errors) bumpError(counters, err)
      if (toCreate.length === 0 && existing && existing.authorIds.size >= result.authors.length) {
        counters.articlesSkipped++
        continue
      }

      counters.articlesProcessed++
      processedArticleIds.push(art.id)
      plannedAuthors.push(...toCreate)
    }

    if (plannedAuthors.length === 0) continue

    await persistAuthorBatch(
      opts.sb,
      plannedAuthors,
      opts.dryRun,
      counters,
      existingSourceKeys,
      existingLegacy,
      existingRelations,
    )
  }

  const { states: afterStates } = await scanArticleCoverage(opts.sb, {
    skipNonPublished: opts.skipNonPublished,
    batchSize: opts.batchSize,
    limit: opts.limit,
  })
  const afterReport = buildReconcileReport(afterStates)
  report.afterStillMissing = afterReport.missingRelations
  report.afterStillPartial = afterReport.partialRelations
  report.missingRelations = afterReport.missingRelations
  report.partialRelations = afterReport.partialRelations
  report.withRelations = afterReport.withRelations
  report.toProcess = afterReport.toProcess

  return { counters, report, processedArticleIds }
}

async function persistAuthorBatch(
  sb: SupabaseClient,
  plannedAuthors: PlannedAuthor[],
  dryRun: boolean,
  counters: AuthorEtlCounters,
  existingSourceKeys: Set<string>,
  existingLegacy: Set<number>,
  existingRelations: Set<string>,
): Promise<void> {
  const authorRows = [...new Map(
    plannedAuthors.map((p) => [p.sourceKey, toAuthorUpsertRow(p)]),
  ).values()]

  for (const p of plannedAuthors) {
    if (p.isProvisional) counters.provisionalAuthors++
    if (existingSourceKeys.has(p.sourceKey)) counters.authorsReused++
    else {
      counters.authorsCreated++
      existingSourceKeys.add(p.sourceKey)
    }
    existingLegacy.add(p.legacyId)
  }

  if (!dryRun && authorRows.length > 0) {
    const { error } = await upsertAuthorsBySourceKey(sb, authorRows)
    if (error) {
      bumpError(counters, AuthorEtlErrorType.BATCH_DB_ERROR)
      throw new Error(`authors upsert: ${error}`)
    }
  }

  const sourceKeys = [...new Set(plannedAuthors.map((p) => p.sourceKey))]
  const idBySourceKey = new Map<string, number>()
  if (!dryRun && sourceKeys.length > 0) {
    const fetched = await fetchAuthorIdsBySourceKey(sb, sourceKeys)
    for (const [k, v] of fetched) idBySourceKey.set(k, v)
  } else if (dryRun) {
    for (const sk of sourceKeys) idBySourceKey.set(sk, -1)
  }

  const relationRows: Array<{
    article_id: number
    author_id: number
    author_position: number
    raw_author_name: string
  }> = []

  for (const p of plannedAuthors) {
    const authorId = idBySourceKey.get(p.sourceKey)
    if (!authorId || authorId < 0) continue
    const relKey = `${p.articleId}:${authorId}`
    if (existingRelations.has(relKey)) {
      counters.relationsExisting++
      continue
    }
    existingRelations.add(relKey)
    counters.relationsCreated++
    relationRows.push({
      article_id: p.articleId,
      author_id: authorId,
      author_position: p.position,
      raw_author_name: p.rawName,
    })
  }

  if (!dryRun && relationRows.length > 0) {
    const { error } = await sb
      .from('article_authors')
      .upsert(relationRows, { onConflict: 'article_id,author_id', ignoreDuplicates: true })
    if (error) {
      bumpError(counters, AuthorEtlErrorType.RELATION_CREATE_ERROR)
      throw new Error(`article_authors upsert: ${error.message}`)
    }
  }
}

/** Checkpoint düşük-ID riskini simüle eder: start-after > articleId olan makale atlanır. */
export function wouldCheckpointSkipArticle(checkpointLastId: number, articleId: number): boolean {
  return articleId <= checkpointLastId
}
