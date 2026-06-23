import { Prisma } from '@prisma/client'
import { CatalogDatabaseConfigError } from '@/lib/db/errors'

export type CatalogQueryOk<T> = { status: 'ok'; data: T }
export type CatalogQueryEmpty = { status: 'empty' }
export type CatalogQueryDbError = {
  status: 'error'
  kind: 'database'
  /** Kullanıcıya gösterilebilir, secret içermez */
  message: string
}
export type CatalogQueryConfigError = {
  status: 'error'
  kind: 'configuration'
  message: string
}

export type CatalogQueryResult<T> =
  | CatalogQueryOk<T>
  | CatalogQueryEmpty
  | CatalogQueryDbError
  | CatalogQueryConfigError

export function isPrismaConnectionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P1001' || error.code === 'P1002' || error.code === 'P1017'
  }
  const msg = error instanceof Error ? error.message : String(error)
  return /connect|connection|ECONNREFUSED|timeout|Can't reach database/i.test(msg)
}

const PUBLIC_DB_ERROR =
  'Katalog veritabanına bağlanılamadı. Lütfen daha sonra tekrar deneyin.'

/**
 * Prisma sorgusunu çalıştırır; boş sonuç ve bağlantı hatasını ayırır.
 * Connection string veya secret loglanmaz.
 */
export async function runCatalogQuery<T>(
  fn: () => Promise<T>,
  options?: { emptyWhen?: (data: T) => boolean },
): Promise<CatalogQueryResult<T>> {
  try {
    const data = await fn()
    if (options?.emptyWhen?.(data)) {
      return { status: 'empty' }
    }
    return { status: 'ok', data }
  } catch (error) {
    if (error instanceof CatalogDatabaseConfigError) {
      return { status: 'error', kind: 'configuration', message: error.message }
    }
    if (isPrismaConnectionError(error)) {
      return { status: 'error', kind: 'database', message: PUBLIC_DB_ERROR }
    }
    throw error
  }
}

export function catalogErrorMessage(
  result: CatalogQueryDbError | CatalogQueryConfigError,
): string {
  return result.message
}
