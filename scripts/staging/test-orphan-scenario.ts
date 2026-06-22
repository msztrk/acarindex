/**
 * Orphan koruma senaryosu — yalnızca staging; geçici test verisi ekler ve temizler.
 */
import { createClient } from '@supabase/supabase-js'
import {
  applyRelationUpsertFailureCounters,
  verifyBatchProvisionalOrphans,
} from '../../lib/etl/author-upsert'
import { loadStagingEnv } from './env'

async function main() {
  const staging = loadStagingEnv()
  const sb = createClient(staging.url, staging.serviceRoleKey, { auth: { persistSession: false } })

  const testArticleId = 9_900_001
  const testAuthorSk = 'article:9900001:position:1'
  const counters = {
    authorUpsertSucceededRelationFailed: 0,
    orphanProvisionalDetected: 0,
    sourceKeyConflict: 0,
    positionConflict: 0,
  }

  let authorId: number | null = null

  try {
    await sb.from('articles').upsert({
      id: testArticleId,
      journal_id: 1,
      status: 'published',
      title_tr: 'Staging orphan test',
      slug: 'staging-orphan-test',
    }, { onConflict: 'id' }).throwOnError()

    const { data: authorRow, error: aErr } = await sb.from('authors').upsert({
      source_key: testAuthorSk,
      name: 'Staging Orphan Test',
      slug: 'staging-orphan-test',
      is_provisional: true,
      legacy_id: -990000001,
    }, { onConflict: 'source_key' }).select('id').single()

    if (aErr) throw aErr
    authorId = authorRow.id as number

    const idMap = new Map([[testAuthorSk, authorId]])
    const batchNew = new Set([testAuthorSk])

    applyRelationUpsertFailureCounters(
      counters,
      'duplicate key idx_article_authors_article_position_unique',
      batchNew,
    )

    let failed = false
    try {
      await verifyBatchProvisionalOrphans(sb, counters, batchNew, idMap)
    } catch {
      failed = true
    }

    const report = {
      author_created_without_relation: true,
      author_upsert_succeeded_relation_failed: counters.authorUpsertSucceededRelationFailed,
      orphan_provisional_detected: counters.orphanProvisionalDetected,
      position_conflict: counters.positionConflict,
      run_failed_as_expected: failed && counters.orphanProvisionalDetected > 0,
    }

    console.log(JSON.stringify(report, null, 2))
    if (!report.run_failed_as_expected) process.exit(1)
  } finally {
    if (authorId) {
      await sb.from('article_authors').delete().eq('author_id', authorId)
      await sb.from('authors').delete().eq('id', authorId)
    }
    await sb.from('articles').delete().eq('id', testArticleId)
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
