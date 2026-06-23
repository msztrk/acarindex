/**
 * Yerel MySQL'e SQL dump restore (CLI). Production'a bağlanmaz.
 *
 * İzin verilen hedef: yeni yerel Docker MariaDB (127.0.0.1:3307) — kaynak ETL için.
 * Yasak: canlı/uzak MySQL, production host.
 *
 * Gereksinimler:
 *   LOCAL_SOURCE_SQL_PATH
 *   LOCAL_MYSQL_BIN (mysql.exe yolu) veya PATH'te mysql
 *   SOURCE_MYSQL_ADMIN_URL — restore için admin (root) bağlantısı, yalnızca localhost
 */
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { createConnection } from 'mysql2/promise'
import {
  assertLocalSourceHost,
  maskMysqlUrl,
  requireLocalSourceSqlPath,
  resolveSourceMysqlConfig,
} from './mysql-config'

const TARGET_DB = process.env.LOCAL_SOURCE_DB_NAME?.trim() || 'acarindex_source_local'

function resolveMysqlBin(): string {
  return process.env.LOCAL_MYSQL_BIN?.trim() || 'mysql'
}

function resolveAdminConfig() {
  const adminUrl = process.env.SOURCE_MYSQL_ADMIN_URL?.trim()
  if (adminUrl) {
    const normalized = adminUrl.replace(/^mysql:\/\//, 'http://')
    const u = new URL(normalized)
    assertLocalSourceHost(u.hostname)
    return {
      host: u.hostname,
      port: u.port ? parseInt(u.port, 10) : 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, '') || undefined,
    }
  }
  const cfg = resolveSourceMysqlConfig()
  if (cfg.user !== 'root' && !process.env.SOURCE_MYSQL_ADMIN_URL) {
    throw new Error(
      'Restore için SOURCE_MYSQL_ADMIN_URL (root) veya root MYSQL kullanıcısı gerekli. Şifreyi komut satırına yazmayın.',
    )
  }
  return cfg
}

async function runMysqlImport(
  bin: string,
  admin: ReturnType<typeof resolveAdminConfig>,
  sqlPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      `-h${admin.host}`,
      `-P${admin.port}`,
      `-u${admin.user}`,
      `--default-character-set=utf8mb4`,
      TARGET_DB,
    ]
    const child = spawn(bin, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, MYSQL_PWD: admin.password },
    })
    const input = fs.createReadStream(sqlPath)
    input.pipe(child.stdin)
    child.stdin.on('error', () => {
      /* EPIPE when mysql closes early */
    })
    let stderr = ''
    child.stderr.on('data', (d) => {
      stderr += String(d)
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`mysql import çıkış kodu ${code}: ${stderr.slice(0, 500)}`))
    })
    child.on('error', (e) => reject(e))
  })
}

async function main() {
  const sqlPath = requireLocalSourceSqlPath()
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`SQL dosyası yok: ${path.basename(sqlPath)}`)
  }
  if (path.extname(sqlPath).toLowerCase() === '.gz') {
    throw new Error('Sıkıştırılmış dump için önce gzip açın')
  }

  const admin = resolveAdminConfig()
  assertLocalSourceHost(admin.host)
  const bin = resolveMysqlBin()

  console.log(
    JSON.stringify({
      action: 'restore_start',
      target_database: TARGET_DB,
      sql_file: path.basename(sqlPath),
      mysql_bin: bin,
      admin_host: admin.host,
      admin_user_masked: '***',
    }),
  )

  const conn = await createConnection({
    host: admin.host,
    port: admin.port,
    user: admin.user,
    password: admin.password,
    multipleStatements: true,
  })

  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${TARGET_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  )
  await conn.end()

  console.log(`Veritabanı hazır: ${TARGET_DB}. Import başlıyor (büyük dosyada uzun sürebilir)...`)
  await runMysqlImport(bin, admin, sqlPath)

  const verify = await createConnection({
    host: admin.host,
    port: admin.port,
    user: admin.user,
    password: admin.password,
    database: TARGET_DB,
  })
  const [tables] = await verify.query<Array<{ cnt: number }>>(
    `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = ?`,
    [TARGET_DB],
  )
  await verify.end()

  console.log(
    JSON.stringify({
      action: 'restore_complete',
      target_database: TARGET_DB,
      table_count: (tables as unknown as { cnt: number }[])[0]?.cnt ?? 0,
    }),
  )
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e)
  console.error(msg.replace(/MYSQL_PWD=\S+/g, 'MYSQL_PWD=***'))
  process.exit(1)
})
