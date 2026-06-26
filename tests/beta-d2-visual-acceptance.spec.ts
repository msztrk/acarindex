import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const SHOT_DIR =
  process.env.ACAR_D2_1_VISUAL_SHOTS ??
  process.env.ACAR_D2_VISUAL_SHOTS ??
  join(process.cwd(), 'docs/screenshots/faz6c-d2-1')
const HESABIM_EMAIL = process.env.ACAR_HESABIM_TEST_EMAIL ?? ''
const HESABIM_PASSWORD = process.env.ACAR_HESABIM_TEST_PASSWORD ?? ''

const OVERFLOW_VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const

mkdirSync(SHOT_DIR, { recursive: true })

function shotPath(name: string): string {
  return join(SHOT_DIR, name)
}

async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)
}

async function mobileMetrics(page: Page) {
  return page.evaluate(() => {
    const rectFor = (selector: string) => {
      const el = document.querySelector(selector)
      return el ? Math.round(el.getBoundingClientRect().height) : 0
    }

    return {
      pageHeight: Math.round(document.documentElement.scrollHeight),
      heroHeight: rectFor('section.hero-surface'),
      footerHeight: rectFor('footer'),
      popularSearchesHeight: rectFor('[data-d2-popular-searches]'),
      articleListBorderTop: getComputedStyle(
        document.querySelector('[data-d2-recent-articles]') ?? document.body,
      ).borderTopWidth,
      articleListShadow: getComputedStyle(
        document.querySelector('[data-d2-recent-articles]') ?? document.body,
      ).boxShadow,
    }
  })
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

test.describe('D2 visual acceptance', () => {
  test('no horizontal overflow at key viewports', async ({ page }) => {
    for (const { width, height } of OVERFLOW_VIEWPORTS) {
      await page.setViewportSize({ width, height })
      await page.goto('/', { waitUntil: 'domcontentloaded' })
      expect(await noHorizontalOverflow(page), `overflow @${width}x${height}`).toBe(true)
    }
  })

  test('functional smoke — routes and auth unchanged', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const header = page.locator('header')
    await expect(header.getByRole('link', { name: 'Giriş' })).toBeVisible()
    await expect(header.getByRole('link', { name: 'Kayıt Ol' })).toBeVisible()

    const footer = page.locator('footer')
    await expect(footer.getByRole('link', { name: 'Giriş Yap' })).toBeVisible()

    await page.getByRole('searchbox').first().fill('test')
    await page.getByRole('button', { name: 'Ara' }).first().click()
    await expect(page).toHaveURL(/\/search/)

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1').first()).toBeVisible()

    const articleLink = page
      .getByRole('heading', { name: 'Son eklenen makaleler' })
      .locator('xpath=ancestor::section')
      .locator('ul a')
      .first()
    if (await articleLink.count() > 0) {
      const href = await articleLink.getAttribute('href')
      if (href && href !== '/') {
        await articleLink.click()
        await expect(page).not.toHaveURL('/')
      }
    }

    await page.goto('/journals', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1, h2').first()).toBeVisible()

    if (HESABIM_EMAIL && HESABIM_PASSWORD) {
      await loginInBrowser(page, HESABIM_EMAIL, HESABIM_PASSWORD)
      await page.goto('/hesabim', { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/\/hesabim/)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }
  })

  test('mobile D2.1 refinements are compact and tappable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/', { waitUntil: 'networkidle' })

    expect(await noHorizontalOverflow(page)).toBe(true)

    const header = page.locator('header')
    await expect(header.getByRole('link', { name: 'AcarIndex' })).toBeVisible()
    await expect(header.getByRole('button', { name: 'Menüyü aç' })).toBeVisible()

    for (const label of ['Tümü', 'Makaleler', 'Yazarlar', 'Dergiler']) {
      const link = page.getByRole('navigation', { name: 'Arama kapsamı' }).getByRole('link', { name: label })
      await expect(link).toBeVisible()
      const box = await link.boundingBox()
      expect(box?.height ?? 0, `${label} touch height`).toBeGreaterThanOrEqual(30)
    }

    const metrics = await mobileMetrics(page)
    expect(metrics.popularSearchesHeight).toBeLessThanOrEqual(150)
    expect(metrics.articleListBorderTop).toBe('0px')
    expect(metrics.articleListShadow).toBe('none')
  })

  test('capture D2 screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/', { waitUntil: 'networkidle' })
    expect(await noHorizontalOverflow(page)).toBe(true)
    await page.screenshot({ path: shotPath('d2-1-home-desktop-1366.png') })
    await page.screenshot({ path: shotPath('d2-1-home-fullpage-desktop-1366.png'), fullPage: true })

    const heroDesktop = page.locator('section.hero-surface').first()
    await heroDesktop.screenshot({ path: shotPath('d2-1-hero-desktop-1366.png') })

    const rail = page.locator('aside').filter({ has: page.getByText('Öne çıkan dergiler') }).first()
    await rail.screenshot({ path: shotPath('d2-1-right-rail-desktop-1366.png') })

    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/', { waitUntil: 'networkidle' })
    expect(await noHorizontalOverflow(page)).toBe(true)
    await page.screenshot({ path: shotPath('d2-1-home-mobile-fullpage-375.png'), fullPage: true })
    writeFileSync(shotPath('d2-1-mobile-metrics.json'), JSON.stringify(await mobileMetrics(page), null, 2))

    const headerMobile = page.locator('header')
    await headerMobile.screenshot({ path: shotPath('d2-1-header-mobile-375.png') })

    const heroMobile = page.locator('section.hero-surface').first()
    await heroMobile.screenshot({ path: shotPath('d2-1-hero-mobile-375.png') })

    const articlesSectionMobile = page.getByRole('heading', { name: 'Son eklenen makaleler' }).locator('xpath=ancestor::section')
    await articlesSectionMobile.screenshot({ path: shotPath('d2-1-article-list-mobile-375.png') })

    const footerMobile = page.locator('footer')
    await footerMobile.screenshot({ path: shotPath('d2-1-footer-mobile-375.png') })
  })
})
