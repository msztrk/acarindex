/**
 * ETL 04 — articles.authors_raw → authors + article_authors
 *
 * KAPSAM: Yalnızca Supabase `articles` tablosu (mevcut Supabase makale kümesi).
 * MySQL makaleler ETL 03 ile aktarılmadan tam kaynak katalog işlenemez.
 *
 * Kullanım:
 *   npm run etl:authors -- --dry-run --limit=10000
 *   npm run etl:authors -- --missing-only
 *   npm run etl:authors -- --reconcile
 *   npm run etl:authors -- --limit=3000 --start-after=500
 */

import fs from 'fs'
import path from 'path'
import {
  getMysqlPool,
  getSupabaseAdmin,
  startRun,
  finishRun,
  logErrors,
  type EtlErrorEntry,
} from './db'
import {
  parseAuthorEtlCliArgs,
  runAuthorsEtl,
  loadAuthorRegistry,
  assertAuthorRegistryReadyForWrite,
  verifyCatalogScope,
  printCatalogScopeReport,
  printAuthorEtlReport,
  createAuthorEtlCounters,
  type ArticleAuthorRow,
} from '../../lib/etl/run-authors-etl'
import {
  profileAuthorSource,
  classifyCommaAuthorSample,
  summarizeCommaClassifications,
  profileProvisionalFragmentation,
  evaluateProvisionalLegacyIdBounds,
} from '../../lib/etl/author-utils'
import {
  scanArticleCoverage,
  printReconcileReport,
  runMissingOnlyAuthorsEtl,
} from '../../lib/etl/author-reconcile'
import { loadExistingAuthorSourceKeys } from '../../lib/etl/author-upsert'

const CHECKPOINT_DIR = path.join(__dirname, 'checkpoints')
const CHECKPOINT_FILE = path.join(CHECKPOINT_DIR, '04-authors.checkpoint.json')

interface Checkpoint {
  lastArticleId: number
  runId?: string
}

function readCheckpoint(): Checkpoint | null {
  try {
    if (!fs.existsSync(CHECKPOINT_FILE)) return null
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8')) as Checkpoint
  } catch {
    return null
  }
}

function writeCheckpoint(cp: Checkpoint): void {
  if (!fs.existsSync(CHECKPOINT_DIR)) fs.mkdirSync(CHECKPOINT_DIR, { recursive: true })
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2))
}

async function markStaleRuns(sb: ReturnType<typeof getSupabaseAdmin>): Promise<void> {
  await sb
    .from('etl_runs')
    .update({ status: 'interrupted', finished_at: new Date().toISOString() })
    .eq('script', '04-authors')
    .eq('status', 'running')
}

async function loadExistingState(sb: ReturnType<typeof getSupabaseAdmin>) {
  const sourceKeys = await loadExistingAuthorSourceKeys(sb)
  const legacyIds = new Set<number>()
  const relations = new Set<string>()
  let offset = 0
  const SIZE = 1000

  while (true) {
    const { data, error } = await sb
      .from('authors')
      .select('id, legacy_id')
      .not('legacy_id', 'is', null)
      .range(offset, offset + SIZE - 1)
    if (error) throw new Error(`authors state load: ${error.message}`)
    if (!data?.length) break
    for (const row of data) {
      if (row.legacy_id != null) legacyIds.add(row.legacy_id as number)
    }
    if (data.length < SIZE) break
    offset += SIZE
  }

  offset = 0
  while (true) {
    const { data, error } = await sb
      .from('article_authors')
      .select('article_id, author_id')
      .range(offset, offset + SIZE - 1)
    if (error) throw new Error(`article_authors state load: ${error.message}`)
    if (!data?.length) break
    for (const row of data) {
      relations.add(`${row.article_id}:${row.author_id}`)
    }
    if (data.length < SIZE) break
    offset += SIZE
  }

  return { legacyIds, relations, sourceKeys }
}

async function fetchArticlesForProfile(
  sb: ReturnType<typeof getSupabaseAdmin>,
  startAfter: number,
  limit: number,
  skipNonPublished: boolean,
): Promise<ArticleAuthorRow[]> {
  const out: ArticleAuthorRow[] = []
  let cursor = startAfter
  const batchSize = 500
  while (out.length < limit) {
    let q = sb
      .from('articles')
      .select('id, authors_raw, status')
      .gt('id', cursor)
      .order('id', { ascending: true })
      .limit(Math.min(batchSize, limit - out.length))
    if (skipNonPublished) q = q.eq('status', 'published')
    const { data, error } = await q
    if (error) throw new Error(error.message)
    if (!data?.length) break
    out.push(...(data as ArticleAuthorRow[]))
    cursor = data[data.length - 1].id as number
    if (data.length < batchSize) break
  }
  return out
}

async function runCommaSampleReport(sb: ReturnType<typeof getSupabaseAdmin>, limit = 1000) {
  const { data, error } = await sb
    .from('articles')
    .select('id, authors_raw')
    .eq('status', 'published')
    .like('authors_raw', '%,%')
    .order('id', { ascending: true })
    .limit(limit)
  if (error) throw new Error(error.message)

  const samples = (data ?? []).map((row) =>
    classifyCommaAuthorSample(row.id as number, (row.authors_raw as string) ?? ''),
  )
  const summary = summarizeCommaClassifications(samples)
  console.log('\n=== Virgüllü yazar örneklem (' + samples.length + ') ===')
  console.log('  Sınıflandırma:', summary)
  const wrongSplit = summary.mixed_format + summary.bad_data + summary.undecided
  const total = samples.length || 1
  console.log(
    `  Belirsiz/hatalı oran: ${((wrongSplit / total) * 100).toFixed(1)}%`,
  )
}

async function main() {
  const cli = parseAuthorEtlCliArgs(process.argv.slice(2))
  const sb = getSupabaseAdmin()
  const pool = getMysqlPool()

  const scope = await verifyCatalogScope(sb, pool)
  printCatalogScopeReport(scope)

  const bounds = evaluateProvisionalLegacyIdBounds(
    scope.supabaseArticlesTotal > 0 ? 2_000_000 : 0,
    200,
  )
  console.log(
    `\n  provisional legacy_id (article×100+pos): packed=${bounds.packed} int32=${bounds.fitsInt32} bigint=${bounds.fitsBigint}`,
  )

  console.log(
    `👥 ETL 04 — authors [${cli.dryRun ? 'DRY-RUN' : 'WRITE'}${cli.missingOnly ? ' MISSING-ONLY' : ''}${cli.reconcile ? ' RECONCILE' : ''}]`,
  )

  await markStaleRuns(sb)

  if (cli.reconcile) {
    const { report } = await scanArticleCoverage(sb, {
      skipNonPublished: cli.skipNonPublished,
      batchSize: cli.batchSize,
      limit: Number.isFinite(cli.limit) ? cli.limit : undefined,
    })
    printReconcileReport(report)
    await pool.end()
    return
  }

  const registryLoad = await loadAuthorRegistry(pool)
  const registry = registryLoad.registry
  console.log(
    `  Author registry: mode=${registryLoad.mode} yazarlar_table=${registryLoad.yazarlarTablePresent} rows=${registryLoad.yazarlarRowCount}`,
  )

  if (!cli.dryRun && !cli.profileOnly && !cli.reconcile) {
    assertAuthorRegistryReadyForWrite(registryLoad)
  }

  if (cli.profileOnly) {
    const articles = await fetchArticlesForProfile(
      sb,
      cli.startAfter,
      Number.isFinite(cli.limit) ? cli.limit : 10000,
      cli.skipNonPublished,
    )
    const profile = profileAuthorSource(articles)
    const frag = profileProvisionalFragmentation(articles, registry)
    printAuthorEtlReport(
      {
        counters: createEmptyCounters(),
        lastArticleId: articles.at(-1)?.id ?? cli.startAfter,
        duplicateNameCandidates: [],
        normalizedNameSamples: [],
        profile,
      },
      { dryRun: true, profile },
    )
    console.log('\n--- Provisional parçalanma ---')
    console.log(`  Provisional satır: ${frag.provisionalProfileCount}`)
    console.log(`  Çok makalede tekrar normalize ad: ${frag.normalizeNamesWithMultipleProfiles}`)
    console.log(`  Tek makaleli provisional %: ${frag.singleArticleProvisionalPct.toFixed(1)}`)
    console.log(`  yazarlar eşleşme: matched=${frag.yazarlarMatchFailures.matched} ambiguous=${frag.yazarlarMatchFailures.ambiguous} noMatch=${frag.yazarlarMatchFailures.noRegistryMatch}`)
    if (frag.topFragmentedNames.length) {
      console.log('  En parçalı isimler (ilk 10):')
      frag.topFragmentedNames.slice(0, 10).forEach((n) =>
        console.log(`    ${n.sampleDisplay} → ${n.profileCount} profil`),
      )
    }
    await runCommaSampleReport(sb, 1000)
    await pool.end()
    return
  }

  if (cli.missingOnly) {
    const existing = await loadExistingState(sb)
    const runId = await startRun(sb, {
      script: '04-authors',
      mode: cli.dryRun ? 'dry-run' : 'full',
      sourceTable: 'articles',
      targetTable: 'authors,article_authors',
      limitRows: Number.isFinite(cli.limit) ? cli.limit : undefined,
    })

    try {
      const result = await runMissingOnlyAuthorsEtl({
        sb,
        registry,
        dryRun: cli.dryRun,
        skipNonPublished: cli.skipNonPublished,
        batchSize: cli.batchSize,
        limit: Number.isFinite(cli.limit) ? cli.limit : undefined,
        existingSourceKeys: existing.sourceKeys,
        existingLegacyIds: existing.legacyIds,
        existingRelations: existing.relations,
      })
      printReconcileReport(result.report, 'Missing-only')
      console.log('\n--- Missing-only sayaçlar ---')
      console.log(result.counters)
      await finishRun(sb, runId, {
        rowsRead: result.counters.articlesRead,
        rowsInserted: result.counters.authorsCreated + result.counters.relationsCreated,
        rowsUpdated: result.counters.authorsReused + result.counters.relationsExisting,
        rowsSkipped: result.counters.articlesSkipped,
        rowsError: result.counters.erroneousRecords,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(msg)
      await finishRun(sb, runId, { rowsRead: 0, rowsInserted: 0, rowsUpdated: 0, rowsSkipped: 0, rowsError: 1 }, 'failed', msg)
      await pool.end()
      process.exit(1)
    }
    await pool.end()
    return
  }

  const checkpoint = readCheckpoint()
  if (checkpoint && cli.startAfter === 0 && !cli.dryRun && !process.argv.includes('--no-resume')) {
    cli.startAfter = checkpoint.lastArticleId
    console.log(`  Resume checkpoint: start-after=${cli.startAfter} (düşük ID riski: --missing-only kullanın)`)
  }

  let profileStats: ReturnType<typeof profileAuthorSource> | undefined
  if (cli.dryRun) {
    const profileLimit = Math.min(cli.limit, 10000)
    const articles = await fetchArticlesForProfile(sb, cli.startAfter, profileLimit, cli.skipNonPublished)
    profileStats = profileAuthorSource(articles)
    console.log(`  Profil: ${articles.length} makale analiz edildi`)
  }

  const existing = await loadExistingState(sb)
  console.log(`  Mevcut state: ${existing.sourceKeys.size} source_key, ${existing.legacyIds.size} legacy_id, ${existing.relations.size} ilişki`)

  const mode = cli.dryRun ? 'dry-run' : 'full'
  const runId = await startRun(sb, {
    script: '04-authors',
    mode,
    sourceTable: 'articles',
    targetTable: 'authors,article_authors',
    limitRows: Number.isFinite(cli.limit) ? cli.limit : undefined,
    offsetRows: cli.startAfter,
  })

  const errorLog: EtlErrorEntry[] = []
  let failed = false

  try {
    const result = await runAuthorsEtl({
      sb,
      registry,
      cli,
      existingSourceKeys: existing.sourceKeys,
      existingLegacyIds: existing.legacyIds,
      existingRelations: existing.relations,
      onBatchComplete: cli.dryRun
        ? undefined
        : async (lastArticleId) => {
            writeCheckpoint({ lastArticleId, runId })
          },
    })

    printAuthorEtlReport(result, { dryRun: cli.dryRun, profile: profileStats })

    await finishRun(sb, runId, {
      rowsRead: result.counters.articlesRead,
      rowsInserted: result.counters.authorsCreated + result.counters.relationsCreated,
      rowsUpdated: result.counters.authorsReused + result.counters.relationsExisting,
      rowsSkipped: result.counters.articlesSkipped,
      rowsError: result.counters.erroneousRecords,
    })
  } catch (e) {
    failed = true
    const msg = e instanceof Error ? e.message : String(e)
    console.error('ETL hatası:', msg)
    errorLog.push({
      sourceTable: 'articles',
      sourceId: null,
      errorType: 'network',
      errorMessage: msg,
    })
    await finishRun(
      sb,
      runId,
      { rowsRead: 0, rowsInserted: 0, rowsUpdated: 0, rowsSkipped: 0, rowsError: 1 },
      'failed',
      msg,
    )
  }

  if (errorLog.length) await logErrors(sb, runId, errorLog)
  await pool.end()
  if (failed) process.exit(1)
}

function createEmptyCounters() {
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

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
