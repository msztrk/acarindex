import { describe, expect, it, vi, afterEach } from 'vitest'
import { resolveHomeQaMode } from '../lib/home/data'

describe('resolveHomeQaMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('development ortamında geçerli qa modlarını döner', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(resolveHomeQaMode('empty-articles')).toBe('empty-articles')
    expect(resolveHomeQaMode('empty-journals')).toBe('empty-journals')
    expect(resolveHomeQaMode('stats-error')).toBe('stats-error')
    expect(resolveHomeQaMode('loading')).toBe('loading')
  })

  it('production ortamında qa parametresini yok sayar', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(resolveHomeQaMode('empty-articles')).toBeUndefined()
    expect(resolveHomeQaMode('stats-error')).toBeUndefined()
    expect(resolveHomeQaMode('loading')).toBeUndefined()
  })

  it('bilinmeyen qa değerinde undefined döner', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(resolveHomeQaMode('invalid')).toBeUndefined()
    expect(resolveHomeQaMode(undefined)).toBeUndefined()
  })
})
