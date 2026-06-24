import { prisma } from '@/lib/db/prisma'

export async function loadAdminDashboard() {
  const [
    journalCount,
    issueCount,
    articleCount,
    authorCount,
    pdfCount,
    recentEtlRuns,
    failedEtlRuns,
    duplicateSlugRows,
    orphanArticles,
    orphanIssues,
    health,
  ] = await Promise.all([
    prisma.journal.count(),
    prisma.issue.count(),
    prisma.article.count(),
    prisma.author.count(),
    prisma.pdfFile.count({ where: { fileStatus: { not: 'missing' } } }),
    prisma.etlRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        runId: true,
        script: true,
        mode: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        rowsError: true,
      },
    }),
    prisma.etlRun.count({ where: { status: { in: ['failed', 'aborted'] } } }),
    prisma.$queryRaw<Array<{ slug: string; n: number }>>`
      SELECT slug, COUNT(*)::int AS n FROM articles GROUP BY slug HAVING COUNT(*) > 1 LIMIT 100
    `,
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM articles a
      WHERE a.issue_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM issues i WHERE i.id = a.issue_id)
    `,
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM issues i
      WHERE NOT EXISTS (SELECT 1 FROM journals j WHERE j.id = i.journal_id)
    `,
    fetchHealth(),
  ])

  const orphanArticleCount = orphanArticles[0]?.count ?? 0
  const orphanIssueCount = orphanIssues[0]?.count ?? 0

  return {
    counts: {
      journals: journalCount,
      issues: issueCount,
      articles: articleCount,
      authors: authorCount,
      pdfs: pdfCount,
    },
    quality: {
      duplicateSlugs: duplicateSlugRows.length,
      orphanArticles: orphanArticleCount,
      orphanIssues: orphanIssueCount,
      failedEtlRuns,
    },
    recentEtlRuns: recentEtlRuns.map((r) => ({
      ...r,
      id: Number(r.id),
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
    })),
    health,
  }
}

async function fetchHealth(): Promise<{ status: string; database?: string }> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://127.0.0.1:3000'
    const res = await fetch(`${base}/api/health`, { cache: 'no-store' })
    if (!res.ok) return { status: 'error' }
    const json = (await res.json()) as { status?: string; checks?: { database?: string } }
    return { status: json.status ?? 'unknown', database: json.checks?.database }
  } catch {
    return { status: 'unreachable' }
  }
}
