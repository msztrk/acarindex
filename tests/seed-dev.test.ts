import { describe, expect, it, vi } from 'vitest'
import {
  DEV_FIXTURE_MARKER,
  describeDevFixturePlan,
  assertSeedAllowed,
} from '@/scripts/db/seed-dev'

describe('development seed scaffolding', () => {
  it('fixture olarak işaretlenir ve gerçek veri iddiası yok', () => {
    const plan = describeDevFixturePlan()
    expect(plan.marker).toBe(DEV_FIXTURE_MARKER)
    expect(plan.disclaimer).toMatch(/not real AcarIndex/i)
    expect(plan.journals).toBe(10)
    expect(plan.articles).toBeGreaterThanOrEqual(200)
    expect(plan.articles).toBeLessThanOrEqual(500)
    expect(plan.features).toContain('provisional authors')
  })

  it('production ortamında varsayılan olarak engellenir', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ALLOW_DEV_SEED', '')
    expect(() => assertSeedAllowed()).toThrow(/production/)
    vi.unstubAllEnvs()
  })

  it('ALLOW_DEV_SEED ile production override tanımlı', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ALLOW_DEV_SEED', '1')
    expect(() => assertSeedAllowed()).not.toThrow()
    vi.unstubAllEnvs()
  })
})
