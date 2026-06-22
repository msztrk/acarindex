/**
 * SQL dump stream: makaleler yazar kolonları profili.
 * Tam dump belleğe alınmaz; genel SQL parser kullanılmaz.
 */
import fs from 'fs'
import path from 'path'
import { createInterface } from 'readline'
import { requireLocalSourceSqlPath } from './mysql-config'
import {
  classifyCommaAuthorSample,
  profileAuthorSource,
  type AuthorProfileStats,
} from '../../lib/etl/author-utils'

const CREATE_MARKER = 'CREATE TABLE `makaleler`'
const INSERT_MARKER = 'INSERT INTO `makaleler`'

interface ColumnDef {
  name: string
  type: string
  nullable: boolean
}

function parseCreateTableBlock(text: string): ColumnDef[] {
  const cols: ColumnDef[] = []
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*`([^`]+)`\s+([^,]+)/)
    if (!m) continue
    const type = m[2].trim()
    cols.push({
      name: m[1],
      type: type.replace(/\s+DEFAULT.*$/i, '').trim(),
      nullable: !/\bNOT NULL\b/i.test(type),
    })
  }
  return cols
}

async function findByteOffset(filePath: string, needle: string): Promise<number> {
  const bufNeedle = Buffer.from(needle, 'utf8')
  const fd = fs.openSync(filePath, 'r')
  const size = fs.fstatSync(fd).size
  const chunkSize = 8 * 1024 * 1024
  const overlap = bufNeedle.length
  const buf = Buffer.alloc(chunkSize + overlap)
  let offset = 0
  while (offset < size) {
    const read = fs.readSync(fd, buf, 0, chunkSize + overlap, offset)
    const idx = buf.subarray(0, read).indexOf(bufNeedle)
    if (idx >= 0) {
      fs.closeSync(fd)
      return offset + idx
    }
    offset += chunkSize
  }
  fs.closeSync(fd)
  return -1
}

function readSlice(filePath: string, start: number, length: number): string {
  const buf = Buffer.alloc(length)
  const fd = fs.openSync(filePath, 'r')
  fs.readSync(fd, buf, 0, length, start)
  fs.closeSync(fd)
  return buf.toString('utf8')
}

async function extractCreateTable(filePath: string): Promise<ColumnDef[]> {
  const offset = await findByteOffset(filePath, CREATE_MARKER)
  if (offset < 0) throw new Error('CREATE TABLE makaleler bulunamadı')
  const block = readSlice(filePath, offset, 64_000)
  const end = block.indexOf(') ENGINE=')
  if (end < 0) throw new Error('CREATE TABLE makaleler kapanışı bulunamadı')
  return parseCreateTableBlock(block.slice(0, end))
}

/** mysqldump VALUES tuple — yalnızca makaleler INSERT satırları için sınırlı parser. */
function splitSqlValues(tuple: string): string[] {
  const values: string[] = []
  let i = 0
  let cur = ''
  let inStr = false
  let escape = false

  const push = () => {
    const v = cur.trim()
    if (v === 'NULL' || v === 'null') values.push('')
    else if (v.startsWith("'") && v.endsWith("'")) {
      values.push(
        v
          .slice(1, -1)
          .replace(/\\'/g, "'")
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\\\/g, '\\'),
      )
    } else values.push(v)
    cur = ''
  }

  while (i < tuple.length) {
    const ch = tuple[i]
    if (inStr) {
      if (escape) {
        cur += ch
        escape = false
      } else if (ch === '\\') {
        cur += ch
        escape = true
      } else if (ch === "'") {
        cur += ch
        inStr = false
      } else {
        cur += ch
      }
    } else if (ch === "'") {
      cur += ch
      inStr = true
    } else if (ch === ',') {
      push()
    } else {
      cur += ch
    }
    i++
  }
  if (cur.length) push()
  return values
}

function extractInsertTuples(line: string): string[] {
  const idx = line.indexOf('VALUES')
  if (idx < 0) return []
  const rest = line.slice(idx + 6).trim()
  const tuples: string[] = []
  let depth = 0
  let start = -1
  let inStr = false
  let escape = false

  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i]
    if (inStr) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === "'") inStr = false
      continue
    }
    if (ch === "'") {
      inStr = true
      continue
    }
    if (ch === '(') {
      if (depth === 0) start = i + 1
      depth++
    } else if (ch === ')') {
      depth--
      if (depth === 0 && start >= 0) {
        tuples.push(rest.slice(start, i))
        start = -1
      }
    }
  }
  return tuples
}

interface SampleRow {
  makaleId: number
  titleTr: string
  yazarlar: string
  yazarlarKaynakca: string
}

export interface AuthorColumnProfileReport {
  table: string
  columns: {
    yazarlar: ColumnDef | null
    yazarlarKaynakca: ColumnDef | null
    yazarId: ColumnDef | null
    kaynakca: ColumnDef | null
    related: string[]
  }
  fill: {
    sampledRows: number
    yazarlarFilled: number
    yazarlarKaynakcaFilled: number
    bothFilled: number
    neitherFilled: number
    onlyYazarlar: number
    onlyKaynakca: number
    sameNormalized: number
    differentContent: number
  }
  length: {
    yazarlarAvg: number
    yazarlarMax: number
    kaynakcaAvg: number
    kaynakcaMax: number
  }
  parseProfile: AuthorProfileStats | null
  selectedSourceField: 'Yazarlar' | 'YazarlarKAYNAKCA' | 'none' | 'undetermined'
  sourceFieldReason: string
  maskedSamples: Array<{
    makaleId: number
    titleShort: string
    yazarlarShort: string
    kaynakcaShort: string
    classification?: string
  }>
}

function maskSample(s: string, max = 48): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function shortTitle(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length <= 40 ? t : `${t.slice(0, 39)}…`
}

function normCmp(a: string, b: string): boolean {
  return a.trim().toLowerCase().replace(/\s+/g, ' ') === b.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function resolveArticleAuthorSourceColumn(fill: {
  yazarlarFilled: number
  yazarlarKaynakcaFilled: number
  sampledRows: number
}): { field: 'Yazarlar' | 'YazarlarKAYNAKCA' | 'none'; reason: string } {
  const { yazarlarFilled, yazarlarKaynakcaFilled, sampledRows } = fill
  if (sampledRows === 0) {
    return { field: 'none', reason: 'Örnek satır yok' }
  }
  const yRate = yazarlarFilled / sampledRows
  const kRate = yazarlarKaynakcaFilled / sampledRows

  if (yazarlarFilled === 0 && yazarlarKaynakcaFilled === 0) {
    return { field: 'none', reason: 'Her iki kolon da boş (örneklem)' }
  }
  if (yazarlarFilled > 0 && yazarlarKaynakcaFilled === 0) {
    return { field: 'Yazarlar', reason: 'Yalnızca Yazarlar dolu' }
  }
  if (yazarlarKaynakcaFilled > 0 && yazarlarFilled === 0) {
    return { field: 'YazarlarKAYNAKCA', reason: 'Yalnızca YazarlarKAYNAKCA dolu' }
  }
  if (yRate >= kRate * 1.05) {
    return {
      field: 'Yazarlar',
      reason: `Yazarlar doluluk oranı daha yüksek (örneklem: ${(yRate * 100).toFixed(1)}% vs ${(kRate * 100).toFixed(1)}%)`,
    }
  }
  if (kRate > yRate * 1.05) {
    return {
      field: 'YazarlarKAYNAKCA',
      reason: `YazarlarKAYNAKCA doluluk oranı daha yüksek (örneklem: ${(kRate * 100).toFixed(1)}% vs ${(yRate * 100).toFixed(1)}%)`,
    }
  }
  return {
    field: 'Yazarlar',
    reason: 'Her iki kolon da dolu; Yazarlar makale gösterim formatına daha yakın (varsayılan)',
  }
}

export async function profileAuthorColumnsFromDump(
  filePath: string,
  options: { maxSamples?: number; minSamplesForParse?: number } = {},
): Promise<AuthorColumnProfileReport> {
  const maxSamples = options.maxSamples ?? 10_000
  const minSamplesForParse = options.minSamplesForParse ?? 1_000

  const columnDefs = await extractCreateTable(filePath)
  const names = columnDefs.map((c) => c.name)
  const idx = (n: string) => names.indexOf(n)
  const iYazarlar = idx('Yazarlar')
  const iKaynakca = idx('YazarlarKAYNAKCA')
  const iTitle = idx('TitleTR')
  const iId = idx('MakaleID')

  if (iYazarlar < 0 && iKaynakca < 0) {
    throw new Error('makaleler tablosunda Yazarlar veya YazarlarKAYNAKCA kolonu yok')
  }

  const related = columnDefs
    .map((c) => c.name)
    .filter((n) => /yazar|kaynak|author/i.test(n))

  const rows: SampleRow[] = []
  const rl = createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    if (!line.startsWith(INSERT_MARKER)) continue
    for (const tuple of extractInsertTuples(line)) {
      const vals = splitSqlValues(tuple)
      if (vals.length < names.length) continue
      const yazarlar = iYazarlar >= 0 ? (vals[iYazarlar] ?? '').trim() : ''
      const kaynakca = iKaynakca >= 0 ? (vals[iKaynakca] ?? '').trim() : ''
      const makaleId = iId >= 0 ? parseInt(vals[iId], 10) : rows.length + 1
      const titleTr = iTitle >= 0 ? vals[iTitle] ?? '' : ''
      rows.push({ makaleId, titleTr, yazarlar, yazarlarKaynakca: kaynakca })
      if (rows.length >= maxSamples) break
    }
    if (rows.length >= maxSamples) break
  }

  let yazarlarFilled = 0
  let kaynakcaFilled = 0
  let bothFilled = 0
  let neitherFilled = 0
  let onlyYazarlar = 0
  let onlyKaynakca = 0
  let sameNormalized = 0
  let differentContent = 0
  const yLen: number[] = []
  const kLen: number[] = []

  for (const r of rows) {
    const y = r.yazarlar.length > 0
    const k = r.yazarlarKaynakca.length > 0
    if (y) {
      yazarlarFilled++
      yLen.push(r.yazarlar.length)
    }
    if (k) {
      kaynakcaFilled++
      kLen.push(r.yazarlarKaynakca.length)
    }
    if (y && k) {
      bothFilled++
      if (normCmp(r.yazarlar, r.yazarlarKaynakca)) sameNormalized++
      else differentContent++
    } else if (!y && !k) neitherFilled++
    else if (y) onlyYazarlar++
    else onlyKaynakca++
  }

  const fill = {
    sampledRows: rows.length,
    yazarlarFilled,
    yazarlarKaynakcaFilled: kaynakcaFilled,
    bothFilled,
    neitherFilled,
    onlyYazarlar,
    onlyKaynakca,
    sameNormalized,
    differentContent,
  }

  const pick = resolveArticleAuthorSourceColumn(fill)
  const sourceTexts =
    pick.field === 'YazarlarKAYNAKCA'
      ? rows.map((r) => r.yazarlarKaynakca).filter(Boolean)
      : pick.field === 'Yazarlar'
        ? rows.map((r) => r.yazarlar).filter(Boolean)
        : []

  const parseProfile =
    sourceTexts.length >= minSamplesForParse
      ? profileAuthorSource(
          rows
            .filter((r) => {
              const raw =
                pick.field === 'YazarlarKAYNAKCA' ? r.yazarlarKaynakca : r.yazarlar
              return raw.length > 0
            })
            .map((r) => ({
              id: r.makaleId,
              authors_raw:
                pick.field === 'YazarlarKAYNAKCA' ? r.yazarlarKaynakca : r.yazarlar,
            })),
        )
      : null

  const sampleIndices = new Set<number>()
  const step = Math.max(1, Math.floor(rows.length / 8))
  for (let i = 0; i < rows.length && sampleIndices.size < 8; i += step) {
    sampleIndices.add(i)
  }
  for (let i = 0; i < rows.length && sampleIndices.size < 8; i++) {
    const r = rows[i]
    if (r.yazarlar && r.yazarlarKaynakca && !normCmp(r.yazarlar, r.yazarlarKaynakca)) {
      sampleIndices.add(i)
    }
  }

  const maskedSamples = [...sampleIndices]
    .sort((a, b) => a - b)
    .slice(0, 8)
    .map((i) => {
      const r = rows[i]
      const raw = pick.field === 'YazarlarKAYNAKCA' ? r.yazarlarKaynakca : r.yazarlar
      return {
        makaleId: r.makaleId,
        titleShort: shortTitle(r.titleTr),
        yazarlarShort: maskSample(r.yazarlar),
        kaynakcaShort: maskSample(r.yazarlarKaynakca),
        classification: raw ? classifyCommaAuthorSample(r.makaleId, raw).classification : undefined,
      }
    })

  const avg = (arr: number[]) =>
    arr.length === 0 ? 0 : Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10

  return {
    table: 'makaleler',
    columns: {
      yazarlar: columnDefs.find((c) => c.name === 'Yazarlar') ?? null,
      yazarlarKaynakca: columnDefs.find((c) => c.name === 'YazarlarKAYNAKCA') ?? null,
      yazarId: columnDefs.find((c) => c.name === 'YazarID') ?? null,
      kaynakca: columnDefs.find((c) => c.name === 'Kaynakca') ?? null,
      related,
    },
    fill,
    length: {
      yazarlarAvg: avg(yLen),
      yazarlarMax: yLen.length ? Math.max(...yLen) : 0,
      kaynakcaAvg: avg(kLen),
      kaynakcaMax: kLen.length ? Math.max(...kLen) : 0,
    },
    parseProfile,
    selectedSourceField: pick.field === 'none' ? 'none' : pick.field,
    sourceFieldReason: pick.reason,
    maskedSamples,
  }
}

async function main() {
  const filePath = process.argv[2] ?? requireLocalSourceSqlPath()
  if (!fs.existsSync(filePath)) {
    throw new Error(`SQL dosyası bulunamadı: ${path.basename(filePath)}`)
  }
  console.log(`Profil: ${path.basename(filePath)} (stream, max 10000 örnek)`)
  const report = await profileAuthorColumnsFromDump(filePath)
  console.log(JSON.stringify(report, null, 2))
}

const isMain =
  process.argv[1]?.replace(/\\/g, '/').endsWith('profile-author-columns.ts') ||
  process.argv[1]?.includes('profile-author-columns')

if (isMain) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
