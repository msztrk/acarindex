/**
 * Yerel .env.local değişkenlerini hazırlar (parolalar stdout'a yazılmaz).
 * Kullanım: npx tsx scripts/local/setup-env-local.ts
 */
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'

const ROOT = path.resolve(__dirname, '../../')
const ENV_PATH = path.join(ROOT, '.env.local')

function randomSecret(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('base64url')
}

function parseEnvFile(content: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1))
  }
  return map
}

function encodeMysqlComponent(value: string): string {
  return encodeURIComponent(value)
}

function main() {
  const existing = fs.existsSync(ENV_PATH)
    ? parseEnvFile(fs.readFileSync(ENV_PATH, 'utf8'))
    : new Map<string, string>()

  const postgresUser = existing.get('POSTGRES_USER') ?? 'acarindex'
  const postgresPassword = existing.get('POSTGRES_PASSWORD') ?? randomSecret()
  const postgresDb = 'acarindex_dev'

  const sourceRootPassword = existing.get('SOURCE_MYSQL_ROOT_PASSWORD') ?? randomSecret()
  const sourceDatabase = existing.get('SOURCE_MYSQL_DATABASE') ?? 'acarindex_source'
  const etlReaderUser = existing.get('SOURCE_MYSQL_ETL_USER') ?? 'acarindex_etl_reader'
  const etlReaderPassword = existing.get('SOURCE_MYSQL_ETL_PASSWORD') ?? randomSecret()

  const dumpPath =
    existing.get('LOCAL_SOURCE_SQL_PATH') ?? 'D:\\acarindex\\acarinde_yeniacarindex.sql'

  const lines: Record<string, string> = {
    POSTGRES_USER: postgresUser,
    POSTGRES_PASSWORD: postgresPassword,
    POSTGRES_DB: postgresDb,
    DATABASE_URL: `postgresql://${encodeMysqlComponent(postgresUser)}:${encodeMysqlComponent(postgresPassword)}@127.0.0.1:5432/${postgresDb}?schema=public`,
    SOURCE_MYSQL_ROOT_PASSWORD: sourceRootPassword,
    SOURCE_MYSQL_DATABASE: sourceDatabase,
    SOURCE_MYSQL_ADMIN_URL: `mysql://root:${encodeMysqlComponent(sourceRootPassword)}@127.0.0.1:3307/${sourceDatabase}`,
    SOURCE_MYSQL_ETL_USER: etlReaderUser,
    SOURCE_MYSQL_ETL_PASSWORD: etlReaderPassword,
    SOURCE_DATABASE_URL: `mysql://${encodeMysqlComponent(etlReaderUser)}:${encodeMysqlComponent(etlReaderPassword)}@127.0.0.1:3307/${sourceDatabase}`,
    MYSQL_HOST: '127.0.0.1',
    MYSQL_PORT: '3307',
    MYSQL_USER: etlReaderUser,
    MYSQL_PASSWORD: etlReaderPassword,
    MYSQL_DATABASE: sourceDatabase,
    LOCAL_SOURCE_SQL_PATH: dumpPath,
    LOCAL_SOURCE_DB_NAME: sourceDatabase,
    USE_LOCAL_SOURCE: '1',
    USE_SUPABASE_DB: '0',
    ENABLE_USER_AUTH: 'false',
    NEXT_PUBLIC_ENABLE_USER_AUTH: 'false',
    AUTHOR_REGISTRY_MODE: 'provisional-only',
    NEXT_PUBLIC_SITE_URL: existing.get('NEXT_PUBLIC_SITE_URL') ?? 'http://localhost:3000',
    NEXT_PUBLIC_CANONICAL_BASE: existing.get('NEXT_PUBLIC_CANONICAL_BASE') ?? 'http://localhost:3000',
    LEGACY_FILE_BASE_URL: existing.get('LEGACY_FILE_BASE_URL') ?? 'https://www.acarindex.com',
  }

  // Supabase katalog env'lerini kaldır (Auth sprint dışı)
  const removeKeys = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_DB_URL',
    'ISSUE_ROUTE_TEST_BASE_URL',
  ]

  const preserved = new Map(existing)
  for (const [k, v] of Object.entries(lines)) {
    preserved.set(k, v)
  }
  for (const k of removeKeys) {
    preserved.delete(k)
  }

  const out = [
    '# AcarIndex yerel geliştirme — otomatik üretildi, Git\'e eklenmez',
    '# scripts/local/setup-env-local.ts',
    '',
  ]
  for (const [k, v] of preserved) {
    out.push(`${k}=${v}`)
  }
  out.push('')

  fs.writeFileSync(ENV_PATH, out.join('\n'), 'utf8')
  console.log(
    JSON.stringify({
      action: 'env_local_updated',
      path: '.env.local',
      keys_set: Object.keys(lines).length,
      secrets_logged: false,
    }),
  )
}

main()
