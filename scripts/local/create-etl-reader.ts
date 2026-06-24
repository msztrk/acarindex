/**
 * Restore sonrası salt okunur ETL kullanıcısı oluşturur (yalnızca localhost / pilot MariaDB).
 */
import { createConnection, type Connection } from 'mysql2/promise'
import { assertLocalSourceHost } from '../source/mysql-config'

function parseAdminUrl(adminUrl: string) {
  const normalized = adminUrl.replace(/^mysql:\/\//, 'http://')
  const u = new URL(normalized)
  assertLocalSourceHost(u.hostname)
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  }
}

async function expectDenied(conn: Connection, sql: string, label: string): Promise<void> {
  try {
    await conn.query(sql)
    throw new Error(`${label} beklenmedik şekilde başarılı — reddedilmesi gerekirdi`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!/denied|privilege|access|read-only/i.test(msg)) {
      throw new Error(`${label} için beklenen yetki hatası alınamadı: ${msg.slice(0, 120)}`)
    }
  }
}

async function main() {
  const adminUrl = process.env.SOURCE_MYSQL_ADMIN_URL?.trim()
  if (!adminUrl) {
    throw new Error('SOURCE_MYSQL_ADMIN_URL gerekli')
  }

  const admin = parseAdminUrl(adminUrl)
  const etlUser = process.env.SOURCE_MYSQL_ETL_USER?.trim() || 'acarindex_etl_reader'
  const etlPassword = process.env.SOURCE_MYSQL_ETL_PASSWORD
  if (!etlPassword) {
    throw new Error('SOURCE_MYSQL_ETL_PASSWORD gerekli')
  }

  const adminConn = await createConnection({
    host: admin.host,
    port: admin.port,
    user: admin.user,
    password: admin.password,
    multipleStatements: true,
  })

  await adminConn.query(`CREATE USER IF NOT EXISTS '${etlUser}'@'%' IDENTIFIED BY ?`, [etlPassword])
  await adminConn.query(`GRANT SELECT, SHOW VIEW ON \`${admin.database}\`.* TO '${etlUser}'@'%'`)
  await adminConn.query('FLUSH PRIVILEGES')
  await adminConn.end()

  const readerConn = await createConnection({
    host: admin.host,
    port: admin.port,
    user: etlUser,
    password: etlPassword,
    database: admin.database,
  })

  const [rows] = await readerConn.query('SELECT 1 AS ok')
  const ok = (rows as { ok: number }[])[0]?.ok === 1
  if (!ok) throw new Error('Reader SELECT başarısız')

  await expectDenied(
    readerConn,
    `INSERT INTO \`${admin.database}\`.dergiler (DergiID) VALUES (0)`,
    'INSERT',
  )
  await expectDenied(
    readerConn,
    `UPDATE \`${admin.database}\`.dergiler SET Hit = Hit WHERE DergiID = 1 LIMIT 0`,
    'UPDATE',
  )
  await expectDenied(
    readerConn,
    `DELETE FROM \`${admin.database}\`.dergiler WHERE DergiID = 0`,
    'DELETE',
  )
  await expectDenied(readerConn, `CREATE TABLE \`${admin.database}\`.etl_guard_test (id INT)`, 'CREATE')
  await expectDenied(
    readerConn,
    `ALTER TABLE \`${admin.database}\`.dergiler ADD COLUMN etl_guard_test INT`,
    'ALTER',
  )
  await expectDenied(readerConn, `DROP TABLE IF EXISTS \`${admin.database}\`.etl_guard_drop_test`, 'DROP')

  await readerConn.end()

  console.log(
    JSON.stringify({
      action: 'etl_reader_created',
      user: etlUser,
      database: admin.database,
      privileges: ['SELECT', 'SHOW VIEW'],
      reader_guard_tests: {
        select: 'ok',
        insert: 'denied',
        update: 'denied',
        delete: 'denied',
        create: 'denied',
        alter: 'denied',
        drop: 'denied',
      },
    }),
  )
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
