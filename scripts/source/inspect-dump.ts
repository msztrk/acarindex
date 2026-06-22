/**
 * SQL dump stream analizi — dosyanın tamamı belleğe alınmaz.
 */
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { createHash } from 'crypto'
import { requireLocalSourceSqlPath } from './mysql-config'

const KEY_TABLES = [
  'kategoriler',
  'dergiler',
  'dergi_arsiv',
  'makaleler',
  'yazarlar',
  'bot_dergiler',
  'bot_dergi_arsiv',
  'bot_makaleler',
]

async function streamSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

async function readTail(filePath: string, bytes = 8192): Promise<string> {
  const stat = fs.statSync(filePath)
  const start = Math.max(0, stat.size - bytes)
  const buf = Buffer.alloc(stat.size - start)
  const fd = fs.openSync(filePath, 'r')
  fs.readSync(fd, buf, 0, buf.length, start)
  fs.closeSync(fd)
  return buf.toString('utf8')
}

async function collectCreateTables(filePath: string): Promise<string[]> {
  const tables: string[] = []
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })
  for await (const line of rl) {
    const m = line.match(/^CREATE TABLE `([^`]+)`/i)
    if (m) tables.push(m[1])
  }
  return tables
}

async function readHeader(filePath: string, lines = 40): Promise<string[]> {
  const out: string[] = []
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })
  for await (const line of rl) {
    if (/password|INSERT INTO `admin`|INSERT INTO `kullanici`/i.test(line)) {
      out.push('[redacted]')
    } else {
      out.push(line)
    }
    if (out.length >= lines) break
  }
  return out
}

async function main() {
  const filePath = process.argv[2] ?? requireLocalSourceSqlPath()
  if (!fs.existsSync(filePath)) {
    throw new Error(`SQL dosyası bulunamadı: ${path.basename(filePath)}`)
  }

  const stat = fs.statSync(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const compressed = ext === '.gz' || ext === '.zip'

  console.log('Checksum hesaplanıyor (stream)...')
  const sha256 = await streamSha256(filePath)
  const header = await readHeader(filePath)
  const tail = await readTail(filePath)
  const tables = await collectCreateTables(filePath)

  const dumpCompleted = /Dump completed on/i.test(tail)
  const hasLockTables = /LOCK TABLES/i.test(tail) || /LOCK TABLES/i.test(header.join('\n'))
  const hasInsert = /INSERT INTO/i.test(tail)
  const serverVersion = header.find((l) => /Server version/i.test(l)) ?? null
  const dumpTool = header.find((l) => /MariaDB dump|mysqldump|PostgreSQL/i.test(l)) ?? null
  const dbName = header.find((l) => /Database:/i.test(l))?.match(/Database:\s*(\S+)/)?.[1] ?? null
  const charsetLine = header.find((l) => /SET NAMES|utf8/i.test(l)) ?? null

  const isPostgres = /PostgreSQL database dump/i.test(header.join('\n'))
  const isMysql = /MariaDB dump|MySQL dump|mysqldump/i.test(header.join('\n'))

  const report = {
    file_name: path.basename(filePath),
    file_size_bytes: stat.size,
    file_size_mb: Math.round((stat.size / (1024 * 1024)) * 100) / 100,
    compressed,
    format: isPostgres ? 'postgresql' : isMysql ? 'mysql_mariadb' : 'unknown',
    sha256,
    database_name: dbName,
    dump_tool: dumpTool?.trim() ?? null,
    server_version: serverVersion?.trim() ?? null,
    charset_hint: charsetLine?.trim() ?? null,
    integrity: {
      dump_completed_marker: dumpCompleted,
      has_lock_tables: hasLockTables,
      tail_has_insert: hasInsert,
      tail_looks_truncated: !dumpCompleted && hasInsert,
    },
    table_count: tables.length,
    key_tables_present: Object.fromEntries(
      KEY_TABLES.map((t) => [t, tables.includes(t)]),
    ),
    all_tables_sample: tables.slice(0, 60),
  }

  console.log(JSON.stringify(report, null, 2))
  if (report.integrity.tail_looks_truncated) process.exit(1)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
