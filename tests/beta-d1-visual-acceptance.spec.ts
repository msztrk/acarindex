import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'fs'
import { join } from 'path'

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const

const SHOT_DIR = process.env.ACAR_D1_VISUAL_SHOTS ?? '/var/log/acarindex-d1-visual-acceptance'
const HESABIM_EMAIL = process.env.ACAR_HESABIM_TEST_EMAIL ?? ''
const HESABIM_PASSWORD = process.env.ACAR_HESABIM_TEST_PASSWORD ?? ''

const TEST_HERO_TITLE = 'D1 Viz Kabul Test Başlık'
const TEST_HERO_SUBTITLE = 'Geçici alt açıklama metni D1 kabul'
const EXPECTED_SEO_TITLE_PREFIX = 'AcarIndex — Akademik İndeks Platformu'

mkdirSync(SHOT_DIR, { recursive: true })

function shotPath(name: string): string {
  return join(SHOT_DIR, name)
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

async function clearSession(page: Page): Promise<void> {
  await page.context().clearCookies()
}

function headerLocator(page: Page) {
  return page.locator('header')
}

function footerLocator(page: Page) {
  return page.locator('footer')
}

async function assertGuestHeader(page: Page): Promise<void> {
  const header = headerLocator(page)
  await expect(header.getByRole('link', { name: 'Giriş' })).toBeVisible()
  await expect(header.getByRole('link', { name: 'Kayıt Ol' })).toBeVisible()
  await expect(header.getByRole('button', { name: 'Hesap menüsü' })).toHaveCount(0)
}

async function assertGuestFooter(page: Page): Promise<void> {
  const footer = footerLocator(page)
  await expect(footer.getByRole('link', { name: 'Giriş Yap' })).toBeVisible()
  await expect(footer.getByRole('link', { name: 'Kayıt Ol' })).toBeVisible()
  await expect(footer.getByRole('link', { name: 'Şifremi Unuttum' })).toBeVisible()
  await expect(footer.getByRole('link', { name: 'Hesabım' })).toHaveCount(0)
}

async function assertAuthHeader(page: Page): Promise<void> {
  const header = headerLocator(page)
  await expect(header.getByRole('link', { name: /^Giriş$/ })).toHaveCount(0)
  await expect(header.getByRole('button', { name: 'Hesap menüsü' })).toBeVisible()
}

async function assertAuthFooter(page: Page): Promise<void> {
  const footer = footerLocator(page)
  await expect(footer.getByRole('link', { name: 'Hesabım' })).toBeVisible()
  await expect(footer.getByRole('link', { name: 'Kaydettiklerim' })).toBeVisible()
  await expect(footer.getByRole('link', { name: 'Listelerim' })).toBeVisible()
  await expect(footer.getByRole('link', { name: 'Profilim' })).toBeVisible()
  await expect(footer.getByRole('link', { name: 'Giriş Yap' })).toHaveCount(0)
  await expect(footer.getByRole('link', { name: 'Kayıt Ol' })).toHaveCount(0)
}

async function openUserMenu(page: Page): Promise<void> {
  await headerLocator(page).getByRole('button', { name: 'Hesap menüsü' }).click()
  await expect(page.getByRole('navigation', { name: 'Kullanıcı menüsü' })).toBeVisible()
}

async function assertUserMenuItems(page: Page): Promise<void> {
  const menu = page.getByRole('navigation', { name: 'Kullanıcı menüsü' })
  await expect(menu.getByRole('link', { name: 'Hesabım' })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Kaydettiklerim' })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Listelerim' })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Profilim' })).toBeVisible()
  await expect(menu.getByRole('button', { name: 'Çıkış Yap' })).toBeVisible()
}

async function assertHeroSearchBar(page: Page, width: number): Promise<void> {
  const metrics = await page.evaluate((w) => {
    const h1 = document.querySelector('main h1, section h1')
    const section = h1?.closest('section')
    const form = section?.querySelector('form')
    const input = form?.querySelector('input[type="search"]')
    const button = form?.querySelector('button[type="submit"]')
    const flexRow = form?.querySelector('.flex.items-stretch')
    if (!input || !button || !flexRow) return { ok: false, reason: 'missing-elements' }
    const inputRect = input.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()
    const flexRect = flexRow.getBoundingClientRect()
    const heightDelta = Math.abs(inputRect.height - buttonRect.height)
    const buttonTopGap = buttonRect.top - flexRect.top
    const buttonBottomGap = flexRect.bottom - buttonRect.bottom
    const inputWrapper = input.parentElement
    const inputWrapperRect = inputWrapper?.getBoundingClientRect()
    const gapRight = inputWrapperRect ? buttonRect.left - inputWrapperRect.right : 0
    const searchIcon = form?.querySelector('button[type="submit"] svg')
    const araText = form?.querySelector('button[type="submit"] span')
    return {
      ok:
        heightDelta <= 2 &&
        buttonTopGap <= 1 &&
        buttonBottomGap <= 1 &&
        gapRight <= 1,
      heightDelta,
      buttonTopGap,
      buttonBottomGap,
      gapRight,
      hasSearchIcon: !!searchIcon,
      hasAraText: w >= 640 ? !!araText : true,
    }
  }, width)
  expect(metrics.ok, `search bar metrics @${width}: ${JSON.stringify(metrics)}`).toBe(true)
  expect(metrics.hasSearchIcon).toBe(true)
  if (width >= 640) {
    await expect(page.locator('section form button[type="submit"]')).toContainText('Ara')
  }
}

async function assertAccountPanelCentered(page: Page, width: number): Promise<void> {
  const metrics = await page.evaluate(() => {
    const el = document.querySelector('.account-panel-width')
    if (!el) return { ok: false, reason: 'missing-panel' }
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const panelCenter = rect.left + rect.width / 2
    const viewportCenter = vw / 2
    return {
      ok: Math.abs(panelCenter - viewportCenter) <= 6,
      left: rect.left,
      width: rect.width,
      vw,
    }
  })
  expect(metrics.ok, `hesabim center @${width} left=${metrics.left} w=${metrics.width} vw=${metrics.vw}`).toBe(
    true,
  )
}

test.describe.configure({ mode: 'serial' })

test.describe('beta D1 visual acceptance', () => {
  test('A guest header and footer at all viewports', async ({ page }) => {
    await clearSession(page)
    for (const { width, height } of VIEWPORTS) {
      await page.setViewportSize({ width, height })
      const res = await page.goto('/', { waitUntil: 'domcontentloaded' })
      expect(res?.status()).toBeLessThan(400)
      await assertGuestHeader(page)
      await assertGuestFooter(page)
      expect(await noHorizontalOverflow(page), `guest overflow @${width}`).toBe(true)
    }
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.screenshot({ path: shotPath('guest-home-1366x768.png'), fullPage: true })
  })

  test('B authenticated header, footer, menu and no auth flicker', async ({ page }) => {
    if (!HESABIM_EMAIL || !HESABIM_PASSWORD) test.skip()
    await loginInBrowser(page, HESABIM_EMAIL, HESABIM_PASSWORD)

    for (const { width, height } of VIEWPORTS) {
      await page.setViewportSize({ width, height })
      const res = await page.goto('/', { waitUntil: 'domcontentloaded' })
      expect(res?.status()).toBeLessThan(400)
      await expect(page.getByLabel('Oturum yükleniyor')).toHaveCount(0)
      await assertAuthHeader(page)
      await assertAuthFooter(page)
      expect(await noHorizontalOverflow(page), `auth overflow @${width}`).toBe(true)
      if (width >= 1024) {
        await openUserMenu(page)
        await assertUserMenuItems(page)
        await page.keyboard.press('Escape')
      }
    }

    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.screenshot({ path: shotPath('authenticated-home-1366x768.png'), fullPage: true })

    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.screenshot({ path: shotPath('authenticated-home-375x812.png'), fullPage: true })

    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await openUserMenu(page)
    await assertUserMenuItems(page)
    await page.screenshot({ path: shotPath('authenticated-user-menu-1366x768.png'), fullPage: false })
  })

  test('C logout returns guest state without CSRF errors', async ({ page }) => {
    if (!HESABIM_EMAIL || !HESABIM_PASSWORD) test.skip()
    await loginInBrowser(page, HESABIM_EMAIL, HESABIM_PASSWORD)
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await openUserMenu(page)

    const logoutResult = await page.evaluate(async () => {
      const csrfRes = await fetch('/api/auth/csrf', { credentials: 'include' })
      const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string }
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-csrf-token': csrfToken ?? '' },
      })
      return { ok: res.ok, status: res.status }
    })
    expect(logoutResult.ok, `logout HTTP ${logoutResult.status}`).toBe(true)

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await assertGuestHeader(page)
    await assertGuestFooter(page)
    await expect(page.getByText(/CSRF|session/i)).toHaveCount(0)
  })

  test('D search bar alignment and submit', async ({ page }) => {
    await clearSession(page)
    for (const { width, height } of VIEWPORTS) {
      await page.setViewportSize({ width, height })
      await page.goto('/', { waitUntil: 'domcontentloaded' })
      await assertHeroSearchBar(page, width)
      expect(await noHorizontalOverflow(page), `search overflow @${width}`).toBe(true)
    }

    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const heroForm = page.locator('section h1').locator('xpath=ancestor::section').locator('form').first()
    await heroForm.locator('input[type="search"]').fill('eğitim')
    await page.screenshot({ path: shotPath('search-bar-1366x768.png'), fullPage: false })
    await heroForm.locator('button[type="submit"]').click()
    await page.waitForURL(/\/search\?q=/, { timeout: 15000 })
    expect(page.url()).toMatch(/\/search\?q=e(%C4%9Fitim|ğitim)/)
  })

  test('E hero admin settings CRUD and validation', async ({ page }) => {
    if (!HESABIM_EMAIL || !HESABIM_PASSWORD) test.skip()
    await loginInBrowser(page, HESABIM_EMAIL, HESABIM_PASSWORD)

    const original = await page.evaluate(async () => {
      const res = await fetch('/api/admin/site-content/home-hero', { credentials: 'include' })
      return (await res.json()) as { title: string; subtitle: string | null }
    })
    expect(original.title).toBeTruthy()

    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const seoTitleBefore = await page.title()
    expect(seoTitleBefore).toContain(EXPECTED_SEO_TITLE_PREFIX)

    await page.goto('/admin/site-content', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Site içeriği' })).toBeVisible()
    await expect(page.getByLabel('Ana sayfa hero başlığı')).toBeVisible()
    await page.screenshot({ path: shotPath('admin-home-hero-settings-1366x768.png'), fullPage: true })

    await page.locator('#hero-title').fill('<b>html</b>')
    await page.locator('#hero-subtitle').fill('test')
    await page.getByRole('button', { name: 'Kaydet' }).click()
    await expect(page.getByText(/HTML içerik kabul edilmez/i)).toBeVisible({ timeout: 10000 })

    const rejectLong = await page.evaluate(async () => {
      const csrfRes = await fetch('/api/auth/csrf', { credentials: 'include' })
      const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string }
      const res = await fetch('/api/admin/site-content/home-hero', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken ?? '',
        },
        body: JSON.stringify({ title: 'x'.repeat(121) }),
      })
      return res.status
    })
    expect(rejectLong).toBeGreaterThanOrEqual(400)

    await page.locator('#hero-title').fill(TEST_HERO_TITLE)
    await page.locator('#hero-subtitle').fill(TEST_HERO_SUBTITLE)
    await page.getByRole('button', { name: 'Kaydet' }).click()
    await expect(page.getByText(TEST_HERO_TITLE)).toBeVisible({ timeout: 10000 })

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(TEST_HERO_TITLE)
    await expect(page.getByText(TEST_HERO_SUBTITLE)).toBeVisible()

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(TEST_HERO_TITLE)

    await page.goto('/admin/site-content', { waitUntil: 'domcontentloaded' })
    await page.locator('#hero-title').fill(original.title)
    await page.locator('#hero-subtitle').fill(original.subtitle ?? '')
    await page.getByRole('button', { name: 'Kaydet' }).click()
    await expect(page.getByText(original.title)).toBeVisible({ timeout: 10000 })

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(original.title)
    const seoTitleAfter = await page.title()
    expect(seoTitleAfter).toBe(seoTitleBefore)
  })

  test('F hesabim responsive layout', async ({ page }) => {
    if (!HESABIM_EMAIL || !HESABIM_PASSWORD) test.skip()
    await loginInBrowser(page, HESABIM_EMAIL, HESABIM_PASSWORD)

    for (const { width, height } of VIEWPORTS) {
      await page.setViewportSize({ width, height })
      const res = await page.goto('/hesabim', { waitUntil: 'domcontentloaded' })
      expect(res?.status()).toBeLessThan(400)
      await expect(page.getByRole('heading', { name: 'Hesabım', level: 1 })).toBeVisible()
      expect(await noHorizontalOverflow(page), `hesabim overflow @${width}`).toBe(true)
      await assertAccountPanelCentered(page, width)
    }

    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/hesabim', { waitUntil: 'networkidle' })
    await page.screenshot({ path: shotPath('hesabim-1366x768.png'), fullPage: true })

    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/hesabim', { waitUntil: 'networkidle' })
    await page.screenshot({ path: shotPath('hesabim-375x812.png'), fullPage: true })
  })
})
