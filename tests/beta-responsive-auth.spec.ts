import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'fs'
import { join } from 'path'

const WIDTHS = [375, 768, 1366] as const
const HESABIM_VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const
const SHOT_DIR = process.env.ACAR_RESPONSIVE_SHOTS ?? '/var/log/acarindex-responsive-shots'

const TOKEN_VERIFY_SUCCESS_375 = process.env.TOKEN_VERIFY_SUCCESS_375 ?? ''
const TOKEN_VERIFY_SUCCESS_768 = process.env.TOKEN_VERIFY_SUCCESS_768 ?? ''
const TOKEN_VERIFY_SUCCESS_1366 = process.env.TOKEN_VERIFY_SUCCESS_1366 ?? ''
const TOKEN_VERIFY_EXPIRED = process.env.TOKEN_VERIFY_EXPIRED ?? ''
const TOKEN_VERIFY_USED = process.env.TOKEN_VERIFY_USED ?? ''
const TOKEN_RESET_VALID = process.env.TOKEN_RESET_VALID ?? ''
const TOKEN_RESET_SUCCESS_375 = process.env.TOKEN_RESET_SUCCESS_375 ?? ''
const TOKEN_RESET_SUCCESS_768 = process.env.TOKEN_RESET_SUCCESS_768 ?? ''
const TOKEN_RESET_SUCCESS_1366 = process.env.TOKEN_RESET_SUCCESS_1366 ?? ''
const TOKEN_RESET_EXPIRED = process.env.TOKEN_RESET_EXPIRED ?? ''
const TOKEN_RESET_USED = process.env.TOKEN_RESET_USED ?? ''
const TOKEN_INVALID = process.env.TOKEN_INVALID ?? 'invalid-token-probe'
const TOKEN_RESET_INVALID = process.env.TOKEN_RESET_INVALID ?? 'invalid-reset-token-probe'
const TEST_EMAIL =
  process.env.ACAR_RESPONSIVE_TEST_EMAIL ?? 'faz6c-responsive@acarindex-beta.invalid'
const TEST_PASSWORD = process.env.ACAR_RESPONSIVE_TEST_PASSWORD ?? ''
const LONG_EMAIL =
  'msztrk+very-long-responsive-alias-for-overflow-test@acarindex-beta.invalid'

mkdirSync(SHOT_DIR, { recursive: true })

async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)
}

async function assertAccountPanelCentered(page: Page, slug: string, width: number): Promise<void> {
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
  expect(metrics.ok, `${slug} center @${width} left=${metrics.left} w=${metrics.width} vw=${metrics.vw}`).toBe(
    true,
  )
}

async function loginResponsiveUser(page: Page): Promise<void> {
  if (!TEST_PASSWORD) throw new Error('ACAR_RESPONSIVE_TEST_PASSWORD missing')
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#email').fill(TEST_EMAIL)
  await page.locator('#password').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /Giriş/i }).click()
  await page.waitForURL(/\/hesabim/, { timeout: 20000 })
}

async function shot(page: Page, name: string, width: number): Promise<void> {
  await page.screenshot({ path: join(SHOT_DIR, `${name}-${width}.png`), fullPage: true })
}

async function gotoVerifyToken(page: Page, token: string): Promise<number> {
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes('/api/auth/verify-email') && r.request().method() === 'POST',
    { timeout: 20000 },
  )
  await page.goto(`/verify-email?token=${encodeURIComponent(token)}`, { waitUntil: 'domcontentloaded' })
  const response = await responsePromise
  return response.status()
}

async function checkVerifyErrorState(
  page: Page,
  token: string,
  slug: string,
  messagePattern: RegExp,
  widths: readonly number[] = WIDTHS,
): Promise<void> {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    const status = await gotoVerifyToken(page, token)
    expect(status, `${slug} HTTP @${width}`).toBeGreaterThanOrEqual(400)
    const alert = page.getByRole('alert').first()
    await expect(alert).toBeVisible({ timeout: 15000 })
    await expect(alert).toHaveText(messagePattern, { timeout: 5000 })
    expect(await noHorizontalOverflow(page), `${slug} overflow @${width}`).toBe(true)
    await shot(page, slug, width)
  }
}

async function checkRoute(
  page: Page,
  path: string,
  slug: string,
  assertFn?: (page: Page) => Promise<void>,
): Promise<void> {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    const res = await page.goto(path, { waitUntil: 'domcontentloaded' })
    expect(res?.status(), `${slug} HTTP @${width}`).toBeLessThan(500)
    expect(await noHorizontalOverflow(page), `${slug} overflow @${width}`).toBe(true)
    if (assertFn) await assertFn(page)
    await shot(page, slug, width)
  }
}

async function submitReset(page: Page, password: string): Promise<number> {
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes('/api/auth/reset-password') && r.request().method() === 'POST',
    { timeout: 20000 },
  )
  await page.locator('#reset-password-new').fill(password)
  await page.locator('#reset-password-confirm').fill(password)
  await page.getByRole('button', { name: /Parolayı kaydet/i }).click()
  const response = await responsePromise
  return response.status()
}

async function checkResetErrorState(
  page: Page,
  token: string,
  slug: string,
  messagePattern: RegExp,
  widths: readonly number[] = WIDTHS,
): Promise<void> {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`/reset-password?token=${encodeURIComponent(token)}`, {
      waitUntil: 'domcontentloaded',
    })
    const status = await submitReset(page, 'ResponsivePass1!X')
    expect(status, `${slug} HTTP @${width}`).toBeGreaterThanOrEqual(400)
    const alert = page.getByRole('alert').first()
    await expect(alert).toBeVisible({ timeout: 15000 })
    await expect(alert).toHaveText(messagePattern, { timeout: 5000 })
    expect(await noHorizontalOverflow(page), `${slug} overflow @${width}`).toBe(true)
    await shot(page, slug, width)
  }
}

test.describe.configure({ mode: 'serial' })

test.describe('beta responsive auth lifecycle', () => {
  test('core routes', async ({ page }) => {
    await checkRoute(page, '/verify-email/request', 'verify-request', async (p) => {
      await expect(p.getByRole('heading', { name: /E-posta doğrulama/i })).toBeVisible()
      await expect(p.locator('#verify-resend-email')).toBeVisible()
    })
    await checkRoute(page, '/forgot-password', 'forgot-password', async (p) => {
      await expect(p.getByRole('heading', { name: /Şifremi unuttum/i })).toBeVisible()
    })
    await checkRoute(page, '/reset-password', 'reset-no-token', async (p) => {
      await expect(p.getByText(/Geçersiz veya eksik bağlantı/i)).toBeVisible()
    })
  })

  test('reset token states', async ({ page }) => {
    if (!TOKEN_RESET_VALID) test.skip()
    await checkRoute(
      page,
      `/reset-password?token=${encodeURIComponent(TOKEN_RESET_VALID)}`,
      'reset-form',
      async (p) => {
        await expect(p.getByRole('heading', { name: /Yeni parola/i })).toBeVisible()
        await expect(p.locator('#reset-password-new')).toBeVisible()
      },
    )
    await checkResetErrorState(page, TOKEN_RESET_EXPIRED, 'reset-expired', /süresi dol|geçersiz/i)
    await checkResetErrorState(page, TOKEN_RESET_USED, 'reset-used', /geçersiz|kullanıldı/i)
    await checkResetErrorState(
      page,
      TOKEN_RESET_INVALID,
      'reset-invalid',
      /geçersiz|başarısız/i,
      [375],
    )
  })

  test('reset success flow', async ({ page }) => {
    if (!TOKEN_RESET_SUCCESS_375) test.skip()
    const resetSuccessByWidth: Record<number, string> = {
      375: TOKEN_RESET_SUCCESS_375,
      768: TOKEN_RESET_SUCCESS_768,
      1366: TOKEN_RESET_SUCCESS_1366,
    }
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/reset-password?token=${encodeURIComponent(resetSuccessByWidth[width])}`, {
        waitUntil: 'domcontentloaded',
      })
      const status = await submitReset(page, 'ResponsivePass1!X')
      expect(status, `reset-success HTTP @${width}`).toBe(200)
      await expect(page.getByText(/Parolanız güncellendi/i)).toBeVisible({ timeout: 15000 })
      await expect(page.getByRole('status').locator('..').getByRole('link', { name: /Giriş yap/i })).toBeVisible()
      expect(await noHorizontalOverflow(page), `reset-success overflow @${width}`).toBe(true)
      await shot(page, 'reset-success', width)
    }
  })

  test('verify token states', async ({ page }) => {
    if (!TOKEN_VERIFY_SUCCESS_375) test.skip()

    const verifySuccessByWidth: Record<number, string> = {
      375: TOKEN_VERIFY_SUCCESS_375,
      768: TOKEN_VERIFY_SUCCESS_768,
      1366: TOKEN_VERIFY_SUCCESS_1366,
    }
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      const status = await gotoVerifyToken(page, verifySuccessByWidth[width])
      expect(status, `verify-success HTTP @${width}`).toBe(200)
      await expect(page.getByText(/E-posta adresiniz doğrulandı/i)).toBeVisible({ timeout: 15000 })
      await expect(page.getByRole('link', { name: /Hesabıma git/i })).toBeVisible()
      expect(await noHorizontalOverflow(page), `verify-success overflow @${width}`).toBe(true)
      await shot(page, 'verify-success', width)
    }

    await checkVerifyErrorState(page, TOKEN_VERIFY_EXPIRED, 'verify-expired', /süresi dol|geçersiz/i)
    await checkVerifyErrorState(page, TOKEN_VERIFY_USED, 'verify-used', /kullanıldı|geçersiz/i)
    await checkVerifyErrorState(
      page,
      TOKEN_INVALID,
      'verify-invalid',
      /geçersiz|başarısız/i,
      [375],
    )
  })

  test('verify resend rate limit message', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto('/verify-email/request')
    await page.locator('#verify-resend-email').fill(TEST_EMAIL)
    for (let i = 0; i < 6; i++) {
      await page.getByRole('button', { name: /Tekrar gönder/i }).click()
      await page.waitForTimeout(400)
    }
    await expect(page.getByText(/gönderildi|kontrol edin/i)).toBeVisible()
    await shot(page, 'verify-rate-limit', 375)
  })

  test('forgot-password rate limit message', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto('/forgot-password')
    await page.locator('#forgot-email').fill(TEST_EMAIL)
    for (let i = 0; i < 7; i++) {
      await page.getByRole('button', { name: /^Gönder$/i }).click()
      await page.waitForTimeout(400)
    }
    await expect(page.getByText(/gönderildi|kontrol edin/i)).toBeVisible()
    await shot(page, 'forgot-rate-limit', 375)
  })

  test('long email layout', async ({ page }) => {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/forgot-password')
      await page.locator('#forgot-email').fill(LONG_EMAIL)
      expect(await noHorizontalOverflow(page)).toBe(true)
      await shot(page, 'long-email', width)
    }
  })

  test('keyboard submit forgot-password', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 })
    await page.goto('/forgot-password')
    await page.locator('#forgot-email').fill(TEST_EMAIL)
    await page.locator('#forgot-email').press('Enter')
    await expect(page.getByText(/gönderildi|kontrol edin/i)).toBeVisible({ timeout: 10000 })
  })

  test('hesabim layout centered and responsive', async ({ page }) => {
    if (!TEST_PASSWORD) test.skip()
    await loginResponsiveUser(page)
    for (const { width, height } of HESABIM_VIEWPORTS) {
      await page.setViewportSize({ width, height })
      await page.goto('/hesabim', { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: 'Hesabım', level: 1 })).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Hesap menüsü' })).toBeVisible()
      expect(await noHorizontalOverflow(page), `hesabim overflow @${width}`).toBe(true)
      await assertAccountPanelCentered(page, 'hesabim', width)
      if (width >= 1024) {
        const layout = await page.evaluate(() => {
          const nav = document.querySelector('nav[aria-label="Hesap menüsü"]')
          const panel = document.querySelector('.account-panel-width')
          const grid = panel?.querySelector('.grid')
          if (!nav || !grid) return { ok: false }
          const navRect = nav.getBoundingClientRect()
          const gridRect = grid.getBoundingClientRect()
          return {
            ok: navRect.left >= gridRect.left - 2 && navRect.right < gridRect.right,
            navLeft: navRect.left,
            gridLeft: gridRect.left,
          }
        })
        expect(layout.ok, `hesabim sidebar grid @${width}`).toBe(true)
      }
      await shot(page, 'hesabim', width)
    }
  })
})
