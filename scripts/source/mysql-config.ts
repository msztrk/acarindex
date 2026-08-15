/**
 * Yerel kaynak MySQL bağlantısı — SOURCE_MYSQL_URL veya ayrı env alanları.
 * Production host fallback yok; secret loglanmaz.
 */

export interface SourceMysqlConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

/** Pilot compose iç ağ hostları (internet dışı MariaDB). */
const PILOT_SOURCE_HOSTS = new Set(['mariadb', 'acarindex_pilot_mysql', 'mysql', 'acarindex_restore_mysql_v2'])

export function maskMysqlUrl(url: string): string {
  try {
    const u = new URL(url.replace(/^mysql:\/\//, 'http://'))
    if (u.password) u.password = '***'
    if (u.username) u.username = '***'
    return url.startsWith('mysql://')
      ? `mysql://${u.username}:${u.password}@${u.host}${u.pathname}`
      : u.toString()
  } catch {
    return 'mysql://***:***@***/***'
  }
}

function parseMysqlUrl(raw: string): SourceMysqlConfig {
  const normalized = raw.replace(/^mysql:\/\//, 'http://')
  const u = new URL(normalized)
  const database = u.pathname.replace(/^\//, '')
  if (!database) {
    throw new Error('SOURCE_MYSQL_URL geçersiz: veritabanı adı eksik')
  }
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database,
  }
}

export function assertLocalSourceHost(host: string): void {
  const h = host.toLowerCase()
  if (LOCAL_HOSTS.has(h)) return
  if (process.env.ALLOW_PILOT_DOCKER_SOURCE === '1' && PILOT_SOURCE_HOSTS.has(h)) return
  throw new Error(
    `Kaynak MySQL yalnızca localhost veya izole pilot container olmalı (host=${h}). Uzak production kaynağına bağlanılmaz.`,
  )
}

export function resolveSourceMysqlConfig(): SourceMysqlConfig {
  const url =
    process.env.SOURCE_DATABASE_URL?.trim() ||
    process.env.SOURCE_MYSQL_URL?.trim()
  if (url) {
    const cfg = parseMysqlUrl(url)
    assertLocalSourceHost(cfg.host)
    return cfg
  }

  const host = process.env.MYSQL_HOST?.trim()
  const user = process.env.MYSQL_USER?.trim()
  const password = process.env.MYSQL_PASSWORD ?? ''
  const database = process.env.MYSQL_DATABASE?.trim()
  if (!host || !user || !database) {
    throw new Error(
      'SOURCE_MYSQL_URL tanımlı değil. Yerel kaynak için SOURCE_MYSQL_URL veya MYSQL_HOST/USER/DATABASE ayarlayın.',
    )
  }

  if (process.env.USE_LOCAL_SOURCE === '1') {
    assertLocalSourceHost(host)
  }

  return {
    host,
    port: parseInt(process.env.MYSQL_PORT ?? '3306', 10),
    user,
    password,
    database,
  }
}

export function requireLocalSourceSqlPath(): string {
  const p = process.env.LOCAL_SOURCE_SQL_PATH?.trim()
  if (!p) {
    throw new Error(
      'LOCAL_SOURCE_SQL_PATH tanımlı değil. SQL yedeğinin tam dosya yolunu yerel env dosyasına ekleyin.',
    )
  }
  return p
}
