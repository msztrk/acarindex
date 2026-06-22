/**
 * ETL güvenlik: kaynak (MySQL) ve hedef (PostgreSQL) ayrımı.
 * Production host veya aynı DB algılandığında işlemi durdurur.
 */

export interface EtlConnectionGuardResult {
  source: { engine: 'mysql'; host: string; database: string }
  target: { engine: 'postgresql'; host: string; database: string }
}

const PRODUCTION_HOST_PATTERNS = [
  /\.supabase\.co$/i,
  /acarindex\.com$/i,
  /^db\./i,
]

function parseUrlSafe(url: string): URL {
  return new URL(url.replace(/^mysql:/, 'http:').replace(/^postgresql:/, 'http:'))
}

function maskHost(host: string): string {
  if (host === 'localhost' || host === '127.0.0.1') return host
  return host.replace(/^(.{3}).+/, '$1***')
}

function assertNotProductionHost(host: string, label: string): void {
  const h = host.toLowerCase()
  for (const pat of PRODUCTION_HOST_PATTERNS) {
    if (pat.test(h)) {
      throw new Error(
        `${label}: production veya uzak canlı host algılandı (${maskHost(host)}). İşlem durduruldu.`,
      )
    }
  }
}

/** Kaynak MySQL URL doğrulama. */
export function assertSourceMysqlUrl(sourceUrl: string): EtlConnectionGuardResult['source'] {
  if (!sourceUrl.startsWith('mysql://')) {
    throw new Error('Kaynak URL mysql:// şeması ile başlamalı')
  }
  const u = new URL(sourceUrl)
  assertNotProductionHost(u.hostname, 'Kaynak MySQL')
  return {
    engine: 'mysql',
    host: u.hostname,
    database: u.pathname.replace(/^\//, '') || '',
  }
}

/** Hedef PostgreSQL URL doğrulama. */
export function assertTargetPostgresUrl(targetUrl: string): EtlConnectionGuardResult['target'] {
  if (!targetUrl.startsWith('postgresql://') && !targetUrl.startsWith('postgres://')) {
    throw new Error('Hedef URL postgresql:// şeması ile başlamalı')
  }
  const u = new URL(targetUrl.replace(/^postgres:/, 'http:'))
  assertNotProductionHost(u.hostname, 'Hedef PostgreSQL')
  return {
    engine: 'postgresql',
    host: u.hostname,
    database: u.pathname.replace(/^\//, '').split('?')[0] || '',
  }
}

/** Kaynak ve hedef aynı host+DB ise durdur. */
export function assertSourceTargetSeparated(
  source: EtlConnectionGuardResult['source'],
  target: EtlConnectionGuardResult['target'],
): void {
  if (source.host === target.host && source.database === target.database) {
    throw new Error('Kaynak ve hedef aynı host/veritabanı görünüyor. İşlem durduruldu.')
  }
  if (source.engine !== 'mysql') {
    throw new Error(`Kaynak motoru MySQL olmalı, algılandı: ${source.engine}`)
  }
  if (target.engine !== 'postgresql') {
    throw new Error(`Hedef motor PostgreSQL olmalı, algılandı: ${target.engine}`)
  }
}

export function validateEtlConnections(
  sourceMysqlUrl: string,
  targetPostgresUrl: string,
): EtlConnectionGuardResult {
  const source = assertSourceMysqlUrl(sourceMysqlUrl)
  const target = assertTargetPostgresUrl(targetPostgresUrl)
  assertSourceTargetSeparated(source, target)
  return { source, target }
}

/** Ortam değişkenlerinden ETL bağlantılarını doğrula. */
export function validateEtlEnv(): EtlConnectionGuardResult {
  const sourceUrl =
    process.env.SOURCE_DATABASE_URL?.trim() ||
    process.env.SOURCE_MYSQL_URL?.trim() ||
    buildMysqlUrlFromParts()
  const targetUrl = process.env.DATABASE_URL?.trim()

  if (!sourceUrl) {
    throw new Error('Kaynak MySQL URL eksik (SOURCE_DATABASE_URL veya SOURCE_MYSQL_URL)')
  }
  if (!targetUrl) {
    throw new Error('Hedef DATABASE_URL eksik')
  }

  return validateEtlConnections(sourceUrl, targetUrl)
}

function buildMysqlUrlFromParts(): string | null {
  const host = process.env.MYSQL_HOST
  const user = process.env.MYSQL_USER
  const password = process.env.MYSQL_PASSWORD
  const database = process.env.MYSQL_DATABASE
  const port = process.env.MYSQL_PORT ?? '3306'
  if (!host || !user || !database) return null
  const encUser = encodeURIComponent(user)
  const encPass = password ? encodeURIComponent(password) : ''
  return `mysql://${encUser}:${encPass}@${host}:${port}/${database}`
}

export function logEtlConnectionSummary(guard: EtlConnectionGuardResult): void {
  console.log('  ETL kaynak:', guard.source.engine, maskHost(guard.source.host), guard.source.database)
  console.log('  ETL hedef:', guard.target.engine, maskHost(guard.target.host), guard.target.database)
}
