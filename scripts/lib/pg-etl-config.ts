/**
 * Pilot/full ETL batch ve transaction ayarları.
 * 8.000 kayıt pilotu tam katalog kapasitesini kanıtlamaz — yalnızca başlangıç önerisi.
 */

export interface PgEtlRuntimeConfig {
  batchSize: number
  transactionTimeoutMs: number
  transactionMaxWaitMs: number
}

const DEFAULT_BATCH_SIZE = 200
const DEFAULT_TX_TIMEOUT_MS = 120_000
const DEFAULT_TX_MAX_WAIT_MS = 15_000

export function resolvePgEtlRuntimeConfig(argv: string[]): PgEtlRuntimeConfig {
  const batchArg = argv.find((a) => a.startsWith('--batch-size='))
  const batchFromCli = batchArg
    ? Math.max(50, parseInt(batchArg.split('=')[1] ?? '', 10) || DEFAULT_BATCH_SIZE)
    : null

  const batchFromEnv = process.env.ETL_BATCH_SIZE?.trim()
  const batchSize = batchFromCli
    ?? (batchFromEnv ? Math.max(50, parseInt(batchFromEnv, 10) || DEFAULT_BATCH_SIZE) : DEFAULT_BATCH_SIZE)

  const timeoutMs = parsePositiveInt(process.env.ETL_TRANSACTION_TIMEOUT_MS, DEFAULT_TX_TIMEOUT_MS)
  const maxWaitMs = parsePositiveInt(process.env.ETL_TRANSACTION_MAX_WAIT_MS, DEFAULT_TX_MAX_WAIT_MS)

  return {
    batchSize,
    transactionTimeoutMs: timeoutMs,
    transactionMaxWaitMs: maxWaitMs,
  }
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Tam katalog ETL başlangıç önerisi (ölçeklenebilirlik kanıtı değil). */
export const FULL_CATALOG_ETL_HINTS = {
  batchSize: '200–500 (sunucu RAM ve transaction süresine göre)',
  transactionTimeoutMs: '120000–300000',
  pilotArticleLimit: '8000 pilot doğrulandı; tam katalog ayrı kapı',
}
