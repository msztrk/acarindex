/**
 * Recompute articles.has_en_content and journals.has_en_content from source fields.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/recompute-en-content-flags.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/recompute-en-content-flags.ts --apply
 *   npx tsx --env-file=.env.local scripts/recompute-en-content-flags.ts --apply --limit=5000
 */
import { prisma, disconnectPrisma } from '../lib/db/prisma'
import {
  computeArticleHasEnglishContent,
  computeJournalHasEnglishContent,
} from '../lib/i18n/content-availability'
import {
  publishedEnglishArticleSelect,
  publishedEnglishJournalSelect,
} from '../lib/i18n/prisma-english-content'
import { triggerEnglishContentRevalidation } from '../lib/i18n/trigger-revalidate'

type Counters = {
  checked: number
  unchanged: number
  will_change_to_true: number
  will_change_to_false: number
  errors: number
}

function parseArgs(argv: string[]) {
  const apply = argv.includes('--apply')
  const dryRun = argv.includes('--dry-run') || !apply
  const limitArg = argv.find((a) => a.startsWith('--limit='))
  const articleIdArg = argv.find((a) => a.startsWith('--article-id='))
  const journalIdArg = argv.find((a) => a.startsWith('--journal-id='))
  return {
    apply,
    dryRun,
    limit: limitArg ? parseInt(limitArg.split('=')[1]!, 10) : undefined,
    articleId: articleIdArg ? BigInt(articleIdArg.split('=')[1]!) : undefined,
    journalId: journalIdArg ? BigInt(journalIdArg.split('=')[1]!) : undefined,
  }
}

async function recomputeArticles(
  opts: ReturnType<typeof parseArgs>,
  counters: Counters,
): Promise<void> {
  let cursor = opts.articleId ? opts.articleId - 1n : 0n
  let processed = 0

  while (true) {
    const take = opts.limit ? Math.min(500, opts.limit - processed) : 500
    if (opts.limit != null && processed >= opts.limit) break
    if (take <= 0) break

    const rows = await prisma.article.findMany({
      where: {
        ...(opts.articleId ? { id: opts.articleId } : { id: { gt: cursor } }),
        status: 'published',
      },
      orderBy: { id: 'asc' },
      take: opts.articleId ? 1 : take,
      select: publishedEnglishArticleSelect,
    })

    if (!rows.length) break

    for (const row of rows) {
      counters.checked++
      try {
        const next = computeArticleHasEnglishContent(row)
        if (row.hasEnContent === next) {
          counters.unchanged++
          continue
        }
        if (next) counters.will_change_to_true++
        else counters.will_change_to_false++

        if (opts.apply) {
          await prisma.article.update({
            where: { id: row.id },
            data: { hasEnContent: next },
          })
        }
      } catch {
        counters.errors++
      }
    }

    if (opts.articleId) break
    cursor = rows[rows.length - 1]!.id
    processed += rows.length
  }
}

async function recomputeJournals(
  opts: ReturnType<typeof parseArgs>,
  counters: Counters,
): Promise<void> {
  let cursor = opts.journalId ? opts.journalId - 1n : 0n
  let processed = 0

  while (true) {
    const take = opts.limit ? Math.min(200, opts.limit - processed) : 200
    if (opts.limit != null && processed >= opts.limit) break
    if (take <= 0) break

    const rows = await prisma.journal.findMany({
      where: {
        ...(opts.journalId ? { id: opts.journalId } : { id: { gt: cursor } }),
        status: 'published',
      },
      orderBy: { id: 'asc' },
      take: opts.journalId ? 1 : take,
      select: publishedEnglishJournalSelect,
    })

    if (!rows.length) break

    for (const row of rows) {
      counters.checked++
      try {
        const next = computeJournalHasEnglishContent(row)
        if (row.hasEnContent === next) {
          counters.unchanged++
          continue
        }
        if (next) counters.will_change_to_true++
        else counters.will_change_to_false++

        if (opts.apply) {
          await prisma.journal.update({
            where: { id: row.id },
            data: { hasEnContent: next },
          })
        }
      } catch {
        counters.errors++
      }
    }

    if (opts.journalId) break
    cursor = rows[rows.length - 1]!.id
    processed += rows.length
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const articleCounters: Counters = {
    checked: 0,
    unchanged: 0,
    will_change_to_true: 0,
    will_change_to_false: 0,
    errors: 0,
  }
  const journalCounters: Counters = {
    checked: 0,
    unchanged: 0,
    will_change_to_true: 0,
    will_change_to_false: 0,
    errors: 0,
  }

  await recomputeArticles(opts, articleCounters)
  if (!opts.articleId) {
    await recomputeJournals(opts, journalCounters)
  }

  let revalidationTriggered = false
  if (
    opts.apply &&
    (articleCounters.will_change_to_true > 0 ||
      articleCounters.will_change_to_false > 0 ||
      journalCounters.will_change_to_true > 0 ||
      journalCounters.will_change_to_false > 0)
  ) {
    revalidationTriggered = await triggerEnglishContentRevalidation()
  }

  console.log(
    JSON.stringify(
      {
        mode: opts.apply ? 'apply' : 'dry-run',
        articles: articleCounters,
        journals: journalCounters,
        revalidation_triggered: revalidationTriggered,
      },
      null,
      2,
    ),
  )
}

main()
  .then(() => disconnectPrisma())
  .catch((e) => {
    console.error(e instanceof Error ? e.message : String(e))
    process.exit(1)
  })
