/**
 * Authors + article_authors ETL çekirdeği (idempotent, batch, resume, dry-run, reconcile).
 *
 * Kapsam: Yalnızca Supabase `articles` tablosundaki kayıtlar.
 * MySQL'de olup Supabase'e aktarılmamış makaleler bu ETL ile işlenemez.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { urlYap } from '../urls/slug'
import {
  buildYazarlarRegistry,
  parseAuthorList,
  parseAuthorTokens,
  provisionalLegacyId,
  provisionalSourceKey,
  yazarlarLegacyId,
  mysqlYazarlarSourceKey,
  profileAuthorSource,
  type ArticleAuthorRow,
  type AuthorProfileStats,
  type YazarlarRegistry,
} from './author-utils'

export type { YazarlarRegistry }

export interface AuthorEtlCliOptions {
  dryRun: boolean
  profileOnly: boolean
  missingOnly: boolean
  reconcile: boolean
  limit: number
  startAfter: number
  batchSize: number
  skipNonPublished: boolean
}

export function parseAuthorEtlCliArgs(argv: string[]): AuthorEtlCliOptions {
  const dryRun = argv.includes('--dry-run')
  const profileOnly = argv.includes('--profile-only')
  const missingOnly = argv.includes('--missing-only')
  const reconcile = argv.includes('--reconcile')
  const skipNonPublished = !argv.includes('--include-draft')
  let limit = Number.POSITIVE_INFINITY
  let startAfter = 0
  let batchSize = 500

  for (const arg of argv) {
    if (arg.startsWith('--limit=')) limit = parseInt(arg.split('=')[1] ?? '', 10)
    if (arg.startsWith('--start-after=')) startAfter = parseInt(arg.split('=')[1] ?? '', 10)
    if (arg.startsWith('--batch-size=')) batchSize = parseInt(arg.split('=')[1] ?? '', 10)
  }

  if (!Number.isFinite(limit) || limit < 1) limit = Number.POSITIVE_INFINITY
  if (!Number.isFinite(startAfter) || startAfter < 0) startAfter = 0
  if (!Number.isFinite(batchSize) || batchSize < 1) batchSize = 500
  batchSize = Math.min(batchSize, 1000)

  return {
    dryRun,
    profileOnly,
    missingOnly,
    reconcile,
    limit,
    startAfter,
    batchSize,
    skipNonPublished,
  }
}

export const AuthorEtlErrorType = {
  SOURCE_ARTICLE_NOT_FOUND: 'source_article_not_found',
  EMPTY_AUTHOR_TEXT: 'empty_author_text',
  UNPARSEABLE_AUTHOR_TEXT: 'unparseable_author_text',
  INSUFFICIENT_IDENTITY: 'insufficient_identity',
  INVALID_SOURCE_AUTHOR_ID: 'invalid_source_author_id',
  DUPLICATE_RELATION: 'duplicate_relation',
  PARTIAL_AUTHOR_RELATIONS: 'partial_author_relations',
  POSITION_CONFLICT: 'position_conflict',
  AUTHOR_CREATE_ERROR: 'author_create_error',
  RELATION_CREATE_ERROR: 'relation_create_error',
  FOREIGN_KEY_ERROR: 'foreign_key_error',
  BATCH_DB_ERROR: 'batch_db_error',
} as const

export type AuthorEtlErrorTypeName = typeof AuthorEtlErrorType[keyof typeof AuthorEtlErrorType]

export interface AuthorEtlCounters {
  articlesRead: number
  articlesProcessed: number
  articlesSkipped: number
  authorsCreated: number
  authorsReused: number
  relationsCreated: number
  relationsExisting: number
  erroneousRecords: number
  provisionalAuthors: number
  errorsByType: Record<string, number>
}

export function createAuthorEtlCounters(): AuthorEtlCounters {
  return {
    articlesRead: 0,
    articlesProcessed: 0,
    articlesSkipped: 0,
    authorsCreated: 0,
    authorsReused: 0,
    relationsCreated: 0,
    relationsExisting: 0,
    erroneousRecords: 0,
    provisionalAuthors: 0,
    errorsByType: {},
  }
}

export function bumpError(counters: AuthorEtlCounters, type: AuthorEtlErrorTypeName): void {
  counters.erroneousRecords++
  counters.errorsByType[type] = (counters.errorsByType[type] ?? 0) + 1
}

export interface PlannedAuthor {
  legacyId: number
  sourceKey: string
  name: string
  slug: string
  isProvisional: boolean
  articleId: number
  position: number
  rawName: string
}

export interface ProcessArticleResult {
  authors: PlannedAuthor[]
  skipped: boolean
  errorType?: AuthorEtlErrorTypeName
}

export interface ExistingArticleRelations {
  authorIds: Set<number>
  positions: Map<number, number>
}

/** Mevcut ilişkilerle karşılaştır; yalnızca eksik ilişkileri oluştur. */
export function processArticleAuthors(
  planned: PlannedAuthor[],
  existing: ExistingArticleRelations | undefined,
): { toCreate: PlannedAuthor[]; errors: AuthorEtlErrorTypeName[] } {
  const errors: AuthorEtlErrorTypeName[] = []
  const toCreate: PlannedAuthor[] = []

  if (!existing || existing.authorIds.size === 0) {
    return { toCreate: planned, errors }
  }

  for (const p of planned) {
    const posAuthor = existing.positions.get(p.position)
    if (posAuthor != null) {
      // Pozisyon dolu — sessizce üzerine yazma; çakışma raporla
      errors.push(AuthorEtlErrorType.POSITION_CONFLICT)
      continue
    }
    toCreate.push(p)
  }

  if (planned.length > existing.authorIds.size && toCreate.length > 0) {
    errors.push(AuthorEtlErrorType.PARTIAL_AUTHOR_RELATIONS)
  }

  return { toCreate, errors }
}

export function planAuthorsForArticle(
  article: ArticleAuthorRow,
  registry: YazarlarRegistry,
  skipNonPublished: boolean,
): ProcessArticleResult {
  if (skipNonPublished && article.status && article.status !== 'published') {
    return { authors: [], skipped: true }
  }

  const raw = article.authors_raw?.trim() ?? ''
  if (!raw) {
    return { authors: [], skipped: true, errorType: AuthorEtlErrorType.EMPTY_AUTHOR_TEXT }
  }

  const tokens = parseAuthorTokens(raw)
  const rejectedInsufficient = tokens.some((t) => t.rejected === 'insufficient_identity')
  const parsed = tokens.filter((t) => !t.rejected).map((t) => t.display)

  if (parsed.length === 0) {
    if (rejectedInsufficient) {
      return { authors: [], skipped: true, errorType: AuthorEtlErrorType.INSUFFICIENT_IDENTITY }
    }
    return { authors: [], skipped: true, errorType: AuthorEtlErrorType.UNPARSEABLE_AUTHOR_TEXT }
  }

  const authors: PlannedAuthor[] = []
  const relationKeys = new Set<string>()

  for (let i = 0; i < parsed.length; i++) {
    const position = i + 1
    const displayName = parsed[i]
    const rawName = displayName
    const resolved = registry.resolve(displayName)

    let legacyId: number
    let sourceKey: string
    let isProvisional = true

    if (resolved && 'yazarlarId' in resolved) {
      legacyId = yazarlarLegacyId(resolved.yazarlarId)
      sourceKey = mysqlYazarlarSourceKey(resolved.yazarlarId)
      isProvisional = false
    } else {
      legacyId = provisionalLegacyId(article.id, position)
      sourceKey = provisionalSourceKey(article.id, position)
    }

    const relKey = `${article.id}:${legacyId}`
    if (relationKeys.has(relKey)) continue
    relationKeys.add(relKey)

    authors.push({
      legacyId,
      sourceKey,
      name: displayName,
      slug: urlYap(displayName),
      isProvisional,
      articleId: article.id,
      position,
      rawName,
    })
  }

  return { authors, skipped: false }
}

export interface AuthorEtlRunResult {
  counters: AuthorEtlCounters
  profile?: AuthorProfileStats
  lastArticleId: number
  duplicateNameCandidates: Array<{ name: string; legacyIds: number[] }>
  normalizedNameSamples: string[]
}

export interface AuthorEtlRunOptions {
  sb: SupabaseClient
  registry: YazarlarRegistry
  cli: AuthorEtlCliOptions
  onBatchComplete?: (lastArticleId: number) => Promise<void>
  existingLegacyIds?: Set<number>
  existingRelations?: Set<string>
}

async function fetchArticleBatch(
  sb: SupabaseClient,
  startAfter: number,
  batchSize: number,
  skipNonPublished: boolean,
): Promise<ArticleAuthorRow[]> {
  let q = sb
    .from('articles')
    .select('id, authors_raw, status')
    .gt('id', startAfter)
    .order('id', { ascending: true })
    .limit(batchSize)

  if (skipNonPublished) q = q.eq('status', 'published')

  const { data, error } = await q
  if (error) throw new Error(`articles fetch: ${error.message}`)
  return (data ?? []) as ArticleAuthorRow[]
}

async function upsertAuthorsBatch(
  sb: SupabaseClient,
  rows: Array<{
    legacy_id: number
    name: string
    slug: string
    is_provisional: boolean
  }>,
): Promise<{ error: string | null }> {
  if (rows.length === 0) return { error: null }
  const { error } = await sb.from('authors').upsert(rows, { onConflict: 'legacy_id' })
  return { error: error?.message ?? null }
}

async function fetchAuthorIdsByLegacy(
  sb: SupabaseClient,
  legacyIds: number[],
): Promise<Map<number, number>> {
  const map = new Map<number, number>()
  const CHUNK = 200
  for (let i = 0; i < legacyIds.length; i += CHUNK) {
    const chunk = legacyIds.slice(i, i + CHUNK)
    const { data, error } = await sb.from('authors').select('id, legacy_id').in('legacy_id', chunk)
    if (error) throw new Error(`authors lookup: ${error.message}`)
    for (const row of data ?? []) {
      if (row.legacy_id != null) map.set(row.legacy_id as number, row.id as number)
    }
  }
  return map
}

async function upsertRelationsBatch(
  sb: SupabaseClient,
  rows: Array<{
    article_id: number
    author_id: number
    author_position: number
    raw_author_name: string
  }>,
): Promise<{ error: string | null }> {
  if (rows.length === 0) return { error: null }
  const { error } = await sb
    .from('article_authors')
    .upsert(rows, { onConflict: 'article_id,author_id', ignoreDuplicates: true })
  return { error: error?.message ?? null }
}

export async function runAuthorsEtl(opts: AuthorEtlRunOptions): Promise<AuthorEtlRunResult> {
  const { sb, registry, cli, onBatchComplete } = opts
  const counters = createAuthorEtlCounters()
  const existingLegacy = opts.existingLegacyIds ?? new Set<number>()
  const existingRelations = opts.existingRelations ?? new Set<string>()
  const duplicateNameCandidates: AuthorEtlRunResult['duplicateNameCandidates'] = []
  const normalizedNameSamples: string[] = []

  let cursor = cli.startAfter
  let processedInRun = 0
  let lastArticleId = cli.startAfter

  if (cli.profileOnly || cli.dryRun) {
    const profileArticles: ArticleAuthorRow[] = []
    const profileLimit = cli.profileOnly ? cli.limit : Math.min(cli.limit, 10000)
    let profileCursor = cli.startAfter
    while (profileArticles.length < profileLimit) {
      const batch = await fetchArticleBatch(sb, profileCursor, cli.batchSize, cli.skipNonPublished)
      if (batch.length === 0) break
      for (const a of batch) {
        if (profileArticles.length >= profileLimit) break
        profileArticles.push(a)
      }
      profileCursor = batch[batch.length - 1].id
      if (batch.length < cli.batchSize) break
    }
    const profile = profileAuthorSource(profileArticles)

    if (cli.profileOnly) {
      return {
        counters,
        profile,
        lastArticleId: profileCursor,
        duplicateNameCandidates,
        normalizedNameSamples,
      }
    }

    cursor = cli.startAfter
    processedInRun = 0
  }

  while (processedInRun < cli.limit) {
    const batchSize = Math.min(cli.batchSize, cli.limit - processedInRun)
    const articles = await fetchArticleBatch(sb, cursor, batchSize, cli.skipNonPublished)
    if (articles.length === 0) break

    counters.articlesRead += articles.length

    const plannedAuthors: PlannedAuthor[] = []

    for (const article of articles) {
      const result = planAuthorsForArticle(article, registry, cli.skipNonPublished)
      if (result.skipped) {
        counters.articlesSkipped++
        if (result.errorType) bumpError(counters, result.errorType)
        continue
      }
      counters.articlesProcessed++
      plannedAuthors.push(...result.authors)
    }

    const dedupedAuthorRows = [...new Map(
      plannedAuthors.map((p) => [
        p.legacyId,
        {
          legacy_id: p.legacyId,
          name: p.name,
          slug: p.slug,
          is_provisional: p.isProvisional,
        },
      ]),
    ).values()]

    for (const p of plannedAuthors) {
      if (normalizedNameSamples.length < 10) normalizedNameSamples.push(p.name)
      if (p.isProvisional) counters.provisionalAuthors++
      if (existingLegacy.has(p.legacyId)) counters.authorsReused++
      else {
        counters.authorsCreated++
        existingLegacy.add(p.legacyId)
      }
    }

    if (!cli.dryRun && dedupedAuthorRows.length > 0) {
      const { error } = await upsertAuthorsBatch(sb, dedupedAuthorRows)
      if (error) {
        bumpError(counters, AuthorEtlErrorType.BATCH_DB_ERROR)
        bumpError(counters, AuthorEtlErrorType.AUTHOR_CREATE_ERROR)
        throw new Error(`authors upsert batch failed: ${error}`)
      }
    }

    const legacyIds = [...new Set(plannedAuthors.map((p) => p.legacyId))]
    let idMap = new Map<number, number>()

    if (!cli.dryRun && legacyIds.length > 0) {
      idMap = await fetchAuthorIdsByLegacy(sb, legacyIds)
      for (const lid of legacyIds) {
        if (!idMap.has(lid)) bumpError(counters, AuthorEtlErrorType.AUTHOR_CREATE_ERROR)
      }
    } else if (cli.dryRun) {
      for (const lid of legacyIds) idMap.set(lid, lid)
    }

    const relationRows: Array<{
      article_id: number
      author_id: number
      author_position: number
      raw_author_name: string
    }> = []

    for (const p of plannedAuthors) {
      const authorId = idMap.get(p.legacyId)
      if (!authorId) continue
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

    if (!cli.dryRun && relationRows.length > 0) {
      const { error } = await upsertRelationsBatch(sb, relationRows)
      if (error) {
        if (error.includes('foreign key')) bumpError(counters, AuthorEtlErrorType.FOREIGN_KEY_ERROR)
        bumpError(counters, AuthorEtlErrorType.RELATION_CREATE_ERROR)
        throw new Error(`article_authors upsert batch failed: ${error}`)
      }
    }

    lastArticleId = articles[articles.length - 1].id
    cursor = lastArticleId
    processedInRun += articles.length

    if (onBatchComplete && !cli.dryRun) {
      await onBatchComplete(lastArticleId)
    }

    if (articles.length < batchSize) break
  }

  return {
    counters,
    lastArticleId,
    duplicateNameCandidates,
    normalizedNameSamples,
  }
}

export async function loadYazarlarFromMysql(
  pool: { execute: (sql: string) => Promise<unknown[]> },
): Promise<YazarlarRegistry> {
  const [rows] = (await pool.execute('SELECT id, yazar FROM yazarlar')) as [
    Array<{ id: number; yazar: string }>,
  ]
  return buildYazarlarRegistry(rows)
}

export interface CatalogScopeReport {
  mysqlArticlesWithAuthors: number | null
  supabaseArticlesTotal: number
  supabaseArticlesPublished: number
  supabaseArticlesWithAuthorsRaw: number
  etlProcessesOnlySupabase: true
  fullRunCoversSupabaseCluster: true
  fullSourceCatalogRequiresArticleEtl03: true
  gapSourceNotInSupabase: number | null
}

export async function verifyCatalogScope(
  sb: SupabaseClient,
  mysqlPool?: { execute: (sql: string) => Promise<unknown[]> },
): Promise<CatalogScopeReport> {
  const { count: total } = await sb.from('articles').select('*', { count: 'exact', head: true })
  const { count: published } = await sb
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')
  const { count: withRaw } = await sb
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .not('authors_raw', 'is', null)
    .neq('authors_raw', '')

  let mysqlCount: number | null = null
  if (mysqlPool) {
    try {
      const [rows] = (await mysqlPool.execute(
        'SELECT COUNT(*) as c FROM makaleler WHERE Yazarlar IS NOT NULL AND Yazarlar != ""',
      )) as [{ c: number }[]]
      mysqlCount = rows[0]?.c ?? null
    } catch {
      mysqlCount = null
    }
  }

  return {
    mysqlArticlesWithAuthors: mysqlCount,
    supabaseArticlesTotal: total ?? 0,
    supabaseArticlesPublished: published ?? 0,
    supabaseArticlesWithAuthorsRaw: withRaw ?? 0,
    etlProcessesOnlySupabase: true,
    fullRunCoversSupabaseCluster: true,
    fullSourceCatalogRequiresArticleEtl03: true,
    gapSourceNotInSupabase: mysqlCount != null ? mysqlCount - (withRaw ?? 0) : null,
  }
}

export function printCatalogScopeReport(scope: CatalogScopeReport): void {
  console.log('\n=== ETL Kapsam ===')
  console.log('  Bu ETL yalnızca Supabase articles tablosunu işler.')
  console.log(`  Mevcut Supabase makale kümesi: ${scope.supabaseArticlesTotal} (yayımlanmış: ${scope.supabaseArticlesPublished})`)
  console.log(`  authors_raw dolu: ${scope.supabaseArticlesWithAuthorsRaw}`)
  if (scope.mysqlArticlesWithAuthors != null) {
    console.log(`  Tam kaynak katalog (MySQL Yazarlar dolu): ${scope.mysqlArticlesWithAuthors}`)
    if (scope.gapSourceNotInSupabase != null) {
      console.log(`  Supabase'e henüz aktarılmamış (tahmini): ${scope.gapSourceNotInSupabase}`)
    }
  }
  console.log('  Tam çalışma komutu mevcut durumda mevcut Supabase kümesini kapsar, tam kaynak kataloğu değil.')
  console.log('  Tam kaynak katalog için önce ETL 03 (makaleler) tamamlanmalı.')
}

export function printAuthorEtlReport(
  result: AuthorEtlRunResult,
  opts: { dryRun: boolean; profile?: AuthorProfileStats },
): void {
  const c = result.counters
  console.log('\n=== Author ETL Raporu ===')
  if (opts.profile) {
    const p = opts.profile
    console.log('\n--- Veri profili ---')
    console.log(`  Toplam makale: ${p.totalArticles}`)
    console.log(`  Yazar dolu: ${p.withAuthors}`)
    console.log(`  Yazar boş: ${p.emptyAuthors}`)
    console.log(`  Ayrıştırılan yazar: ${p.parsedAuthorTokens}`)
    console.log(`  Tekil ham ad: ${p.uniqueRawNames}`)
    console.log(`  Tekil normalize ad: ${p.uniqueNormalizedNames}`)
    console.log(`  Max yazar/makale: ${p.maxAuthorsPerArticle}`)
    if (p.insufficientIdentitySamples.length) {
      console.log('  Yetersiz kimlik örnekleri:', p.insufficientIdentitySamples.join('; '))
    }
    if (p.unparseableSamples.length) {
      console.log('  Parse edilemeyen örnekler:')
      p.unparseableSamples.forEach((s) => console.log(`    ${s}`))
    }
  }

  console.log('\n--- Sayaçlar ---')
  console.log(`  Okunan makale: ${c.articlesRead}`)
  console.log(`  İşlenen makale: ${c.articlesProcessed}`)
  console.log(`  Atlanan makale: ${c.articlesSkipped}`)
  console.log(`  Oluşturulan yazar: ${c.authorsCreated}`)
  console.log(`  Yeniden kullanılan yazar: ${c.authorsReused}`)
  console.log(`  Oluşturulan ilişki: ${c.relationsCreated}`)
  console.log(`  Mevcut ilişki: ${c.relationsExisting}`)
  console.log(`  Hatalı kayıt: ${c.erroneousRecords}`)
  console.log(`  Provisional yazar: ${c.provisionalAuthors}`)
  console.log(`  Son makale ID: ${result.lastArticleId}`)
  if (Object.keys(c.errorsByType).length) {
    console.log('  Hata sınıfları:', c.errorsByType)
  }
}
