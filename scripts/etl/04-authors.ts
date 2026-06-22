/**
 * ETL 04 — articles.authors_raw → authors + article_authors
 *
 * Kullanım:
 *   npm run etl:authors -- --dry-run --limit=10000
 *   npm run etl:authors -- --limit=3000 --start-after=500 --batch-size=500
 *   npm run etl:authors -- --profile-only --limit=10000
 *
 * Kaynak makale metni: Supabase articles.authors_raw (MySQL makaleler.Yazarlar kopyası)
 * Yazar kimliği: mysql yazarlar.id (tekil normalize eşleşme) veya provisional legacy_id
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
  loadYazarlarFromMysql,
  printAuthorEtlReport,
  type ArticleAuthorRow,
} from '../../lib/etl/run-authors-etl'
import { profileAuthorSource } from '../../lib/etl/author-utils'

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

  return { legacyIds, relations }
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

async function main() {
  const cli = parseAuthorEtlCliArgs(process.argv.slice(2))
  const sb = getSupabaseAdmin()
  const pool = getMysqlPool()

  console.log(
    `👥 ETL 04 — authors [${cli.dryRun ? 'DRY-RUN' : 'WRITE'}] limit=${cli.limit} start-after=${cli.startAfter} batch=${cli.batchSize}`,
  )

  await markStaleRuns(sb)

  const checkpoint = readCheckpoint()
  if (checkpoint && cli.startAfter === 0 && !cli.dryRun && !process.argv.includes('--no-resume')) {
    cli.startAfter = checkpoint.lastArticleId
    console.log(`  Resume checkpoint: start-after=${cli.startAfter}`)
  }

  const registry = await loadYazarlarFromMysql(pool)
  console.log('  mysql yazarlar registry yüklendi')

  let profileStats: ReturnType<typeof profileAuthorSource> | undefined
  if (cli.profileOnly || cli.dryRun) {
    const profileLimit = cli.profileOnly ? cli.limit : Math.min(cli.limit, 10000)
    const articles = await fetchArticlesForProfile(sb, cli.startAfter, profileLimit, cli.skipNonPublished)
    profileStats = profileAuthorSource(articles)
    console.log(`  Profil: ${articles.length} makale analiz edildi`)
    if (cli.profileOnly) {
      printAuthorEtlReport(
        { counters: { articlesRead: articles.length, articlesProcessed: 0, articlesSkipped: 0, authorsCreated: 0, authorsReused: 0, relationsCreated: 0, relationsExisting: 0, erroneousRecords: 0, provisionalAuthors: 0, errorsByType: {} }, lastArticleId: articles.at(-1)?.id ?? cli.startAfter, duplicateNameCandidates: [], normalizedNameSamples: [] },
        { dryRun: true, profile: profileStats },
      )
      await pool.end()
      return
    }
  }

  const existing = await loadExistingState(sb)
  console.log(`  Mevcut state: ${existing.legacyIds.size} legacy_id, ${existing.relations.size} ilişki`)

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

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
