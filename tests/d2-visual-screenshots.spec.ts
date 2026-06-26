import { test, expect } from '@playwright/test'
import { mkdirSync } from 'fs'
import { join } from 'path'

const SHOT_DIR = process.env.ACAR_D2_SHOTS ?? join(process.cwd(), 'docs/screenshots/faz6c-d2')

mkdirSync(SHOT_DIR, { recursive: true })

async function noOverflow(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)
}

test.describe('D2 visual screenshots', () => {
  const overflowViewports = [
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ] as const

  test('no horizontal overflow at key viewports', async ({ page }) => {
    for (const { width, height } of overflowViewports) {
      await page.setViewportSize({ width, height })
      await page.goto('/', { waitUntil: 'domcontentloaded' })
      expect(await noOverflow(page), `overflow @${width}`).toBe(true)
    }
  })

  test('capture home and sections', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/', { waitUntil: 'networkidle' })
    expect(await noOverflow(page)).toBe(true)
    await page.screenshot({ path: join(SHOT_DIR, 'home-desktop-1366.png'), fullPage: true })

    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.screenshot({ path: join(SHOT_DIR, 'home-desktop-1920.png'), fullPage: true })

    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/', { waitUntil: 'networkidle' })
    expect(await noOverflow(page)).toBe(true)
    await page.screenshot({ path: join(SHOT_DIR, 'home-mobile-375.png'), fullPage: true })

    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const hero = page.locator('section.hero-surface').first()
    await hero.screenshot({ path: join(SHOT_DIR, 'hero-desktop.png') })

    const rail = page.locator('aside').filter({ has: page.getByText('Popüler aramalar') }).first()
    await rail.screenshot({ path: join(SHOT_DIR, 'right-rail-desktop.png') })

    const footer = page.locator('footer')
    await footer.screenshot({ path: join(SHOT_DIR, 'footer-desktop.png') })
  })
})
