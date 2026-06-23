/**
 * Restore sonrası salt okunur ETL kullanıcısı oluşturur (yalnızca localhost MariaDB).
 */
import { createConnection } from 'mysql2/promise'
import { assertLocalSourceHost } from '../source/mysql-config'

async function main() {
  const adminUrl = process.env.SOURCE_MYSQL_ADMIN_URL?.trim()
  if (!adminUrl) {
    throw new Error('SOURCE_MYSQL_ADMIN_URL gerekli')
  }
  const normalized = adminUrl.replace(/^mysql:\/\//, 'http://')
  const u = new URL(normalized)
  assertLocalSourceHost(u.hostname)

  const database = u.pathname.replace(/^\//, '')
  const etlUser = process.env.SOURCE_MYSQL_ETL_USER?.trim() || 'acarindex_etl_reader'
  const etlPassword = process.env.SOURCE_MYSQL_ETL_PASSWORD
  if (!etlPassword) {
    throw new Error('SOURCE_MYSQL_ETL_PASSWORD gerekli')
  }

  const conn = await createConnection({
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    multipleStatements: true,
  })

  await conn.query(`CREATE USER IF NOT EXISTS '${etlUser}'@'%' IDENTIFIED BY ?`, [etlPassword])
  await conn.query(`GRANT SELECT, SHOW VIEW ON \`${database}\`.* TO '${etlUser}'@'%'`)
  await conn.query('FLUSH PRIVILEGES')

  // Salt okunur guard testi
  try {
    await conn.query(`INSERT INTO \`${database}\`.dergiler (DergiID) VALUES (0)`)
    throw new Error('INSERT beklenmedik şekilde başarılı — yetki hatası bekleniyordu')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!/denied|privilege|access/i.test(msg)) {
      throw new Error(`Beklenen yetki hatası alınamadı: ${msg.slice(0, 120)}`)
    }
  }

  await conn.end()
  console.log(
    JSON.stringify({
      action: 'etl_reader_created',
      user: etlUser,
      database,
      privileges: ['SELECT', 'SHOW VIEW'],
      write_guard_test: 'denied',
    }),
  )
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
