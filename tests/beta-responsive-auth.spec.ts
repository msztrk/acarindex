import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'fs'
import { join } from 'path'

const WIDTHS = [375, 768, 1366] as const
const SHOT_DIR = process.env.ACAR_RESPONSIVE_SHOTS ?? '/var/log/acarindex-responsive-shots'

const TOKEN_VERIFY_VALID = process.env.TOKEN_VERIFY_VALID ?? ''
const TOKEN_VERIFY_EXPIRED = process.env.TOKEN_VERIFY_EXPIRED ?? ''
const TOKEN_VERIFY_USED = process.env.TOKEN_VERIFY_USED ?? ''
const TOKEN_RESET_VALID = process.env.TOKEN_RESET_VALID ?? ''
const TOKEN_RESET_SUCCESS = process.env.TOKEN_RESET_SUCCESS ?? ''
const TOKEN_RESET_EXPIRED = process.env.TOKEN_RESET_EXPIRED ?? ''
const TOKEN_RESET_USED = process.env.TOKEN_RESET_USED ?? ''
const TOKEN_INVALID = process.env.TOKEN_INVALID ?? 'invalid-token-probe'
const TEST_EMAIL =
  process.env.ACAR_RESPONSIVE_TEST_EMAIL ?? 'faz6c-responsive@acarindex-beta.invalid'
const LONG_EMAIL =
  'msztrk+very-long-responsive-alias-for-overflow-test@acarindex-beta.invalid'

mkdirSync(SHOT_DIR, { recursive: true })

async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)
}

async function shot(page: Page, name: string, width: number): Promise<void> {
  await page.screenshot({ path: join(SHOT_DIR, `${name}-${width}.png`), fullPage: true })
}

async function checkRoute(
  page: Page,
  path: string,
  slug: string,
  assertFn?: (page: Page) => Promise<void>,
): Promise<void> {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    const res = await page.goto(path, { waitUntil: 'networkidle' })
    expect(res?.status(), `${slug} HTTP @${width}`).toBeLessThan(500)
    expect(await noHorizontalOverflow(page), `${slug} overflow @${width}`).toBe(true)
    if (assertFn) await assertFn(page)
    await shot(page, slug, width)
  }
}

async function submitReset(page: Page, password: string): Promise<void> {
  await page.locator('#reset-password-new').fill(password)
  await page.locator('#reset-password-confirm').fill(password)
  await page.getByRole('button', { name: /Parolayı kaydet/i }).click()
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

  test('verify token states', async ({ page }) => {
    if (!TOKEN_VERIFY_VALID) test.skip()
    await checkRoute(
      page,
      `/verify-email?token=${encodeURIComponent(TOKEN_VERIFY_VALID)}`,
      'verify-success',
      async (p) => {
        await expect(p.getByText(/E-posta adresiniz doğrulandı/i)).toBeVisible({ timeout: 15000 })
        await expect(p.getByRole('link', { name: /Hesabıma git/i })).toBeVisible()
      },
    )
    await checkRoute(
      page,
      `/verify-email?token=${encodeURIComponent(TOKEN_VERIFY_EXPIRED)}`,
      'verify-expired',
      async (p) => {
        await expect(p.getByText(/süresi dolmuş|geçersiz/i)).toBeVisible({ timeout: 15000 })
      },
    )
    await checkRoute(
      page,
      `/verify-email?token=${encodeURIComponent(TOKEN_VERIFY_USED)}`,
      'verify-used',
      async (p) => {
        await expect(p.getByText(/zaten kullanıldı|geçersiz/i)).toBeVisible({ timeout: 15000 })
      },
    )
    await checkRoute(
      page,
      `/verify-email?token=${encodeURIComponent(TOKEN_INVALID)}`,
      'verify-invalid',
      async (p) => {
        await expect(p.getByText(/geçersiz|başarısız/i)).toBeVisible({ timeout: 15000 })
      },
    )
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
    await checkRoute(
      page,
      `/reset-password?token=${encodeURIComponent(TOKEN_RESET_EXPIRED)}`,
      'reset-expired',
      async (p) => {
        await submitReset(p, 'ResponsivePass1!X')
        await expect(p.getByText(/süresi dolmuş|geçersiz/i)).toBeVisible({ timeout: 15000 })
      },
    )
    await checkRoute(
      page,
      `/reset-password?token=${encodeURIComponent(TOKEN_RESET_USED)}`,
      'reset-used',
      async (p) => {
        await submitReset(p, 'ResponsivePass1!X')
        await expect(p.getByText(/geçersiz|kullanıldı/i)).toBeVisible({ timeout: 15000 })
      },
    )
    await checkRoute(
      page,
      `/reset-password?token=${encodeURIComponent(TOKEN_INVALID)}`,
      'reset-invalid',
      async (p) => {
        await submitReset(p, 'ResponsivePass1!X')
        await expect(p.getByText(/geçersiz|başarısız/i)).toBeVisible({ timeout: 15000 })
      },
    )
  })

  test('reset success flow', async ({ page }) => {
    if (!TOKEN_RESET_SUCCESS) test.skip()
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto(`/reset-password?token=${encodeURIComponent(TOKEN_RESET_SUCCESS)}`)
    await submitReset(page, 'ResponsivePass1!X')
    await expect(page.getByText(/Parolanız güncellendi/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('link', { name: /Giriş yap/i })).toBeVisible()
    await shot(page, 'reset-success', 375)
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
})
