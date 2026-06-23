import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  runCatalogQuery,
  isPrismaConnectionError,
  catalogErrorMessage,
} from '@/lib/data/query'
import { CatalogDatabaseConfigError } from '@/lib/db/errors'
import { FIXTURE_DB_ERROR_MESSAGE } from '@/lib/data/testing/fixtures'

describe('runCatalogQuery', () => {
  it('başarılı sonucu ok olarak döner', async () => {
    const result = await runCatalogQuery(async () => ({ items: [1] }))
    expect(result).toEqual({ status: 'ok', data: { items: [1] } })
  })

  it('emptyWhen ile boş sonucu ayırır', async () => {
    const result = await runCatalogQuery(async () => [], {
      emptyWhen: (data) => data.length === 0,
    })
    expect(result.status).toBe('empty')
  })

  it('bağlantı hatasında secret göstermez', async () => {
    const err = new Prisma.PrismaClientKnownRequestError('connection', {
      code: 'P1001',
      clientVersion: 'test',
    })
    const result = await runCatalogQuery(async () => {
      throw err
    })
    expect(result).toEqual({
      status: 'error',
      kind: 'database',
      message: FIXTURE_DB_ERROR_MESSAGE,
    })
    expect(JSON.stringify(result)).not.toMatch(/postgres|DATABASE_URL/i)
  })

  it('yapılandırma hatasını ayırır', async () => {
    const result = await runCatalogQuery(async () => {
      throw new CatalogDatabaseConfigError('DATABASE_URL tanımlı değil')
    })
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.kind).toBe('configuration')
      expect(catalogErrorMessage(result)).toContain('DATABASE_URL')
    }
  })

  it('iş mantığı hatalarını yukarı fırlatır', async () => {
    await expect(
      runCatalogQuery(async () => {
        throw new Error('unexpected logic error')
      }),
    ).rejects.toThrow('unexpected logic error')
  })
})

describe('isPrismaConnectionError', () => {
  it('P1001 kodunu tanır', () => {
    const err = new Prisma.PrismaClientKnownRequestError('x', {
      code: 'P1001',
      clientVersion: 'test',
    })
    expect(isPrismaConnectionError(err)).toBe(true)
  })

  it('genel hataları tanımaz', () => {
    expect(isPrismaConnectionError(new Error('validation'))).toBe(false)
  })
})
