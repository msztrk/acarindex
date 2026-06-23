/**
 * Rehearsal smoke test — production container üzerinde HTTP kontrolleri.
 * Kullanım: npx tsx scripts/deploy/rehearsal-smoke.ts [baseUrl]
 */
const BASE = process.argv[2] ?? 'http://127.0.0.1:3001'

interface Check {
  path: string
  expectStatus: number
  label?: string
}

const CHECKS: Check[] = [
  { path: '/api/health', expectStatus: 200 },
  { path: '/', expectStatus: 200 },
  { path: '/search', expectStatus: 200 },
  { path: '/journals', expectStatus: 200 },
  { path: '/journals/dev-fixture-j-1-9910001', expectStatus: 200 },
  { path: '/journals/dev-fixture-j-1-9910001/sayi/9920001', expectStatus: 200 },
  { path: '/dev-fixture-j-1/dev-fixture-article-1-9930001', expectStatus: 200 },
  { path: '/pdfs/9930001', expectStatus: 200 },
  { path: '/sitemap.xml', expectStatus: 200 },
  { path: '/sitemap-journals', expectStatus: 200 },
  { path: '/sitemap-articles/1.xml', expectStatus: 200 },
  { path: '/robots.txt', expectStatus: 200 },
  { path: '/nonexistent-404-test', expectStatus: 404 },
]

async function main() {
  const results: Array<Check & { status: number; ok: boolean; leak: boolean }> = []
  let healthReady = false

  for (const c of CHECKS) {
    const res = await fetch(`${BASE}${c.path}`, { redirect: 'follow' })
    const html = await res.text()
    const leak =
      /postgresql:\/\//i.test(html) ||
      /DATABASE_URL/i.test(html) ||
      /supabase\.co/i.test(html)
    if (c.path === '/api/health' && res.ok) {
      try {
        const j = JSON.parse(html) as { status?: string }
        healthReady = j.status === 'ready'
      } catch {
        healthReady = false
      }
    }
    results.push({
      ...c,
      status: res.status,
      ok: res.status === c.expectStatus && !leak,
      leak,
    })
  }

  const robots = await fetch(`${BASE}/robots.txt`).then((r) => r.text())
  const robotsDisallowAll = /Disallow:\s*\/\s*$/m.test(robots)

  const summary = {
    base: BASE,
    healthReady,
    robotsDisallowAll,
    passed: results.filter((r) => r.ok).length,
    total: results.length,
    failures: results.filter((r) => !r.ok),
    secretLeaks: results.filter((r) => r.leak),
  }

  console.log(JSON.stringify(summary, null, 2))
  if (summary.failures.length > 0 || !healthReady || summary.secretLeaks.length > 0 || !robotsDisallowAll) {
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
