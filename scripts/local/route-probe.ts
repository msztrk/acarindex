/**
 * Dolu fixture verisiyle public rota HTTP/metadata özeti (yerel dev).
 * Kullanım: npx tsx --env-file=.env.local scripts/local/route-probe.ts [baseUrl]
 */
import { prisma } from '../../lib/db/prisma'
import { DEV_FIXTURE_MARKER } from '../db/seed-dev'

const BASE = process.argv[2] ?? 'http://localhost:3000'

interface RouteResult {
  path: string
  status: number
  error?: string
  title?: string
  canonical?: string | null
  jsonLdCount: number
  citationMetaCount: number
  hasDbErrorText: boolean
  hasSecretLeak: boolean
  robotsMeta?: string | null
}

function analyzeHtml(html: string) {
  const titleMatch = html.match(/<title[^>]*>([^<]*)</i)
  const canonicalMatch = html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
  )
  const jsonLdCount = (html.match(/application\/ld\+json/gi) ?? []).length
  const citationMetaCount = (html.match(/name=["']citation_/gi) ?? []).length
  const robotsMatch = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i)
  const lower = html.toLowerCase()
  const hasDbErrorText =
    lower.includes('katalog veritabanına bağlanılamadı') ||
    lower.includes('veri yüklenemedi')
  const hasSecretLeak =
    /postgresql:\/\//i.test(html) ||
    /DATABASE_URL/i.test(html) ||
    /supabase\.co/i.test(html) ||
    /service_role/i.test(html)
  return {
    title: titleMatch?.[1]?.trim(),
    canonical: canonicalMatch?.[1] ?? null,
    jsonLdCount,
    citationMetaCount,
    robotsMeta: robotsMatch?.[1] ?? null,
    hasDbErrorText,
    hasSecretLeak,
  }
}

async function probe(path: string): Promise<RouteResult> {
  const url = `${BASE}${path}`
  try {
    const res = await fetch(url, { redirect: 'follow' })
    const html = await res.text()
    const meta = analyzeHtml(html)
    return { path, status: res.status, ...meta }
  } catch (e) {
    return {
      path,
      status: 0,
      error: e instanceof Error ? e.message : String(e),
      jsonLdCount: 0,
      citationMetaCount: 0,
      hasDbErrorText: false,
      hasSecretLeak: false,
    }
  }
}

async function main() {
  const journals = await prisma.journal.findMany({
    where: { slug: { startsWith: `${DEV_FIXTURE_MARKER}-j-` } },
    orderBy: { id: 'asc' },
    take: 10,
    select: { id: true, slug: true, titleTr: true },
  })
  const emptyIssue = await prisma.issue.findFirst({
    where: { issueLabel: { contains: 'Boş sayı' } },
    select: { id: true, journalId: true },
  })
  const issues = await prisma.issue.findMany({
    where: { journal: { slug: { startsWith: `${DEV_FIXTURE_MARKER}-j-` } } },
    orderBy: { id: 'asc' },
    take: 6,
    select: { id: true, journalId: true, journal: { select: { slug: true } } },
  })
  const articles = await prisma.article.findMany({
    where: { slug: { startsWith: `${DEV_FIXTURE_MARKER}-article-` } },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      slug: true,
      legacyJournalSlug: true,
      titleTr: true,
      doi: true,
      abstractTr: true,
      authorsRaw: true,
    },
  })
  const authors = await prisma.author.findMany({
    where: { sourceKey: { startsWith: `${DEV_FIXTURE_MARKER}-author-` } },
    select: { id: true, slug: true, name: true, isProvisional: true },
  })

  const longTitle = articles.find((a) => a.titleTr && a.titleTr.length > 80)
  const noDoi = articles.find((a) => !a.doi)
  const noAbstract = articles.find((a) => !a.abstractTr)
  const noPdf = articles.filter((a) => Number(a.id) % 4 === 0).slice(0, 1)
  const longAuthors = articles.find((a) => a.authorsRaw && a.authorsRaw.split(',').length > 5)
  const sampleArticles = [
    ...articles.slice(0, 10),
    ...(longTitle ? [longTitle] : []),
    ...(noDoi ? [noDoi] : []),
    ...(noAbstract ? [noAbstract] : []),
    ...(noPdf.length ? noPdf : []),
    ...(longAuthors ? [longAuthors] : []),
  ]

  const paths: string[] = [
    '/',
    '/search',
    '/journals',
    '/istatistikler',
    '/sitemap.xml',
    '/sitemap-journals',
    '/sitemap-articles/1.xml',
    '/robots.txt',
    '/api/health',
    '/nonexistent-route-404-test',
    '/search?q=Geliştirme+makale',
    '/search?q=nonexistent-xyz-12345',
    '/search?q=a',
    '/search?q=' + encodeURIComponent(longTitle?.titleTr?.slice(0, 120) ?? 'test'),
  ]

  for (const j of journals.slice(0, 5)) {
    paths.push(`/journals/${j.slug}-${Number(j.id)}`)
  }
  for (const iss of issues.slice(0, 5)) {
    paths.push(
      `/journals/${iss.journal!.slug}-${Number(iss.journalId)}/sayi/${Number(iss.id)}`,
    )
  }
  if (emptyIssue) {
    const j = journals.find((x) => x.id === emptyIssue.journalId)
    if (j) {
      paths.push(`/journals/${j.slug}-${Number(j.id)}/sayi/${Number(emptyIssue.id)}`)
    }
  }
  for (const a of sampleArticles) {
    paths.push(`/${a.legacyJournalSlug}/${a.slug}-${Number(a.id)}`)
    paths.push(`/pdfs/${Number(a.id)}`)
  }
  for (const au of authors) {
    paths.push(`/authors/${au.slug ?? au.id}-${Number(au.id)}`)
  }

  const uniquePaths = [...new Set(paths)]
  const results: RouteResult[] = []
  for (const p of uniquePaths) {
    results.push(await probe(p))
  }

  const summary = {
    base: BASE,
    total: results.length,
    ok: results.filter((r) => r.status >= 200 && r.status < 400).length,
    errors: results.filter((r) => r.status === 0 || r.status >= 500).length,
    dbErrors: results.filter((r) => r.hasDbErrorText).length,
    secretLeaks: results.filter((r) => r.hasSecretLeak).length,
    results,
  }

  console.log(JSON.stringify(summary, null, 2))
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
