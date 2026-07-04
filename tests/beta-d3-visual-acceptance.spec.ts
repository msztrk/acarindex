import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const REVIEW_ROOT =
  process.env.ACAR_D3_VISUAL_REVIEW ??
  join(process.cwd(), 'docs/visual-audit/d3/shots')
const AFTER_DIR = join(REVIEW_ROOT, 'after')
const METADATA_PATH = join(process.cwd(), 'docs/visual-audit/d3/audit-metadata.json')

const HESABIM_EMAIL = process.env.ACAR_HESABIM_TEST_EMAIL ?? ''
const HESABIM_PASSWORD = process.env.ACAR_HESABIM_TEST_PASSWORD ?? ''

const OVERFLOW_VIEWPORTS = [
  { width: 375, height: 812, label: 'mobile-375' },
  { width: 768, height: 1024, label: 'tablet-768' },
  { width: 1366, height: 768, label: 'desktop-1366' },
  { width: 1920, height: 1080, label: 'desktop-1920' },
] as const

type AuditEntry = {
  route: string
  pageType: string
  viewport: string
  statusBefore: string
  change: string
  statusAfter: string
  afterShot?: string
  remainingRisk?: string
}

const auditLog: AuditEntry[] = []

mkdirSync(AFTER_DIR, { recursive: true })
mkdirSync(join(REVIEW_ROOT, 'desktop'), { recursive: true })
mkdirSync(join(REVIEW_ROOT, 'tablet'), { recursive: true })
mkdirSync(join(REVIEW_ROOT, 'mobile'), { recursive: true })

function shotSubdir(label: string): string {
  if (label.startsWith('mobile')) return 'mobile'
  if (label.startsWith('tablet')) return 'tablet'
  return 'desktop'
}

function afterShotPath(route: string, viewportLabel: string): string {
  const safe = route.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_|_$/g, '') || 'root'
  const sub = shotSubdir(viewportLabel)
  const file = `${safe}__${viewportLabel}.png`
  return join(REVIEW_ROOT, sub, file)
}

async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)
}

async function loginInBrowser(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  const loginResult = await page.evaluate(
    async ({ em, pw }) => {
      const csrfRes = await fetch('/api/auth/csrf', { credentials: 'include' })
      const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string }
      if (!csrfToken) return { ok: false, status: 0, body: 'no csrf' }
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ email: em, password: pw }),
      })
      const body = await loginRes.text()
      return { ok: loginRes.ok, status: loginRes.status, body: body.slice(0, 160) }
    },
    { em: email, pw: password },
  )
  if (!loginResult.ok) {
    throw new Error(`login failed: HTTP ${loginResult.status} ${loginResult.body}`)
  }
}

async function discoverSampleLinks(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const articleHref = await page
    .getByRole('heading', { name: 'Son eklenen makaleler' })
    .locator('xpath=ancestor::section')
    .locator('ul a')
    .first()
    .getAttribute('href')

  await page.goto('/search?q=a&type=article', { waitUntil: 'domcontentloaded' })
  const pdfHref = await page.locator('a.catalog-pdf-badge, a[href^="/pdfs/"]').first().getAttribute('href')

  await page.goto('/search?q=a&type=author', { waitUntil: 'domcontentloaded' })
  const authorHref = await page.locator('a[href^="/authors/"]').first().getAttribute('href')

  await page.goto('/journals', { waitUntil: 'domcontentloaded' })
  const journalHref = await page.locator('a[href^="/journals/"]').first().getAttribute('href')

  return {
    articleHref: articleHref && articleHref !== '/' ? articleHref : null,
    pdfHref: pdfHref ?? null,
    authorHref: authorHref ?? null,
    journalHref: journalHref ?? null,
  }
}

async function captureRoute(
  page: Page,
  route: string,
  pageType: string,
  change: string,
  statusBefore: string,
  statusAfter: string,
  viewport: (typeof OVERFLOW_VIEWPORTS)[number] = OVERFLOW_VIEWPORTS[2],
) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height })
  const res = await page.goto(route, { waitUntil: 'domcontentloaded' })
  const status = res?.status() ?? 0
  expect(status, `${route} HTTP`).toBeLessThan(500)
  expect(await noHorizontalOverflow(page), `overflow ${route} @${viewport.label}`).toBe(true)

  const path = afterShotPath(route, viewport.label)
  await page.screenshot({ path, fullPage: true })

  auditLog.push({
    route,
    pageType,
    viewport: `${viewport.width}x${viewport.height}`,
    statusBefore,
    change,
    statusAfter,
    afterShot: path.replace(process.cwd(), '').replace(/\\/g, '/'),
    remainingRisk: status >= 400 && status !== 404 ? `HTTP ${status}` : undefined,
  })
}

test.describe('D3 visual acceptance', () => {
  test('critical routes — no 500 and no horizontal overflow', async ({ page }) => {
    const staticRoutes = [
      { route: '/', type: 'home' },
      { route: '/search', type: 'search-empty' },
      { route: '/search?q=tıp&type=article', type: 'search-results' },
      { route: '/search?q=zzzznonexistentquery12345', type: 'search-zero' },
      { route: '/journals', type: 'journals-list' },
      { route: '/login', type: 'auth-login' },
      { route: '/register', type: 'auth-register' },
      { route: '/forgot-password', type: 'auth-forgot' },
      { route: '/reset-password', type: 'auth-reset' },
      { route: '/istatistikler', type: 'stats' },
    ]

    for (const { width, height } of OVERFLOW_VIEWPORTS) {
      for (const { route } of staticRoutes) {
        await page.setViewportSize({ width, height })
        const res = await page.goto(route, { waitUntil: 'domcontentloaded' })
        const status = res?.status() ?? 0
        expect(status, `${route} @${width}`).toBeLessThan(500)
        if (route !== '/reset-password') {
          expect(await noHorizontalOverflow(page), `overflow ${route} @${width}`).toBe(true)
        }
      }
    }

    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/nonexistent-route-d3-test', { waitUntil: 'domcontentloaded' })
    expect(page.url()).toMatch(/404|not-found|nonexistent/)
    await expect(page.getByRole('link', { name: /Ana Sayfa|ana sayfa/i }).first()).toBeVisible()
  })

  test('header auth links consistent (logged out)', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const header = page.locator('header')
    await expect(header.getByRole('link', { name: 'Giriş' })).toBeVisible()
    await expect(header.getByRole('link', { name: 'Kayıt Ol' })).toBeVisible()
    await page.goto('/search?q=test', { waitUntil: 'domcontentloaded' })
    await expect(header.getByRole('link', { name: 'Giriş' })).toBeVisible()
  })

  test('auth forms render with D3 shell', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.auth-page-card')).toBeVisible()
    await expect(page.getByLabel('E-posta').or(page.getByLabel('Parola')).first()).toBeVisible()

    await page.goto('/register', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.auth-page-card')).toBeVisible()

    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' })
    await expect(page.getByLabel('E-posta')).toBeVisible()
  })

  test('dynamic catalog links work', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    const links = await discoverSampleLinks(page)

    if (links.articleHref) {
      const res = await page.goto(links.articleHref, { waitUntil: 'domcontentloaded' })
      expect(res?.status() ?? 0).toBeLessThan(500)
      expect(await noHorizontalOverflow(page)).toBe(true)
    }
    if (links.journalHref) {
      const res = await page.goto(links.journalHref, { waitUntil: 'domcontentloaded' })
      expect(res?.status() ?? 0).toBeLessThan(500)
      expect(await noHorizontalOverflow(page)).toBe(true)
    }
    if (links.authorHref) {
      const res = await page.goto(links.authorHref, { waitUntil: 'domcontentloaded' })
      expect(res?.status() ?? 0).toBeLessThan(500)
      expect(await noHorizontalOverflow(page)).toBe(true)
    }
    if (links.pdfHref) {
      const res = await page.goto(links.pdfHref, { waitUntil: 'domcontentloaded' })
      expect(res?.status() ?? 0).toBeLessThan(500)
      expect(await noHorizontalOverflow(page)).toBe(true)
    }
  })

  test('hesabim when credentials available', async ({ page }) => {
    if (!HESABIM_EMAIL || !HESABIM_PASSWORD) {
      test.skip()
      return
    }
    await page.setViewportSize({ width: 1366, height: 768 })
    await loginInBrowser(page, HESABIM_EMAIL, HESABIM_PASSWORD)
    await page.goto('/hesabim', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/hesabim/)
    await expect(page.getByRole('heading', { level: 1, name: 'Hesabım' })).toBeVisible()
    expect(await noHorizontalOverflow(page)).toBe(true)

    await page.goto('/hesabim/kaydedilen', { waitUntil: 'domcontentloaded' })
    expect(await noHorizontalOverflow(page)).toBe(true)
  })

  test('capture D3 after screenshots and metadata', async ({ page }) => {
    const samples = await discoverSampleLinks(page)

    const captures: Array<{ route: string; type: string; before: string; change: string; after: string }> = [
      { route: '/', type: 'home', before: 'A', change: 'none', after: 'A' },
      { route: '/search?q=tıp&type=article', type: 'search', before: 'B', change: 'SitePageHeader, catalog-list, PDF badge', after: 'A' },
      { route: '/search?q=zzzznonexistentquery12345', type: 'search-zero', before: 'B', change: 'catalog-empty-panel', after: 'A' },
      { route: '/journals', type: 'journals', before: 'B', change: 'empty state tokens', after: 'A' },
      { route: '/login', type: 'auth', before: 'C', change: 'AuthPageShell + tokens', after: 'A' },
      { route: '/register', type: 'auth', before: 'C', change: 'AuthPageShell', after: 'A' },
      { route: '/forgot-password', type: 'auth', before: 'B', change: 'AuthPageShell', after: 'A' },
    ]

    if (samples.articleHref) {
      captures.push({
        route: samples.articleHref,
        type: 'article',
        before: 'B',
        change: 'micro spacing review',
        after: 'A',
      })
    }
    if (samples.pdfHref) {
      captures.push({
        route: samples.pdfHref,
        type: 'pdf',
        before: 'B',
        change: 'viewer height mobile, empty panel',
        after: 'A',
      })
    }
    if (samples.authorHref) {
      captures.push({ route: samples.authorHref, type: 'author', before: 'B', change: 'review only', after: 'A' })
    }
    if (samples.journalHref) {
      captures.push({ route: samples.journalHref, type: 'journal', before: 'B', change: 'review only', after: 'A' })
    }

    for (const c of captures) {
      await captureRoute(page, c.route, c.type, c.change, c.before, c.after, OVERFLOW_VIEWPORTS[2])
      await captureRoute(page, c.route, c.type, c.change, c.before, c.after, OVERFLOW_VIEWPORTS[0])
    }

    writeFileSync(METADATA_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), entries: auditLog }, null, 2))
  })
})
