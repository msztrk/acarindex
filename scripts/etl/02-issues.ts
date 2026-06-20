/**
 * ETL 02 — dergi_arsiv → issues
 *
 * Kullanım:
 *   npx tsx scripts/etl/02-issues.ts            # tüm kayıtlar
 *   npx tsx scripts/etl/02-issues.ts --pilot    # ilk 500 sayı
 *
 * Kaynak  : MySQL dergi_arsiv (ana kaynak; bot_dergi_arsiv dışlandı)
 * Bağımlı : 01-journals.ts (journal_id FK)
 *
 * LIMIT/OFFSET batch'leme kullanılır — büyük sort temp dosyasından kaçınmak için.
 */

import { getMysqlPool, getSupabaseAdmin, batchUpsert, startRun, finishRun, logErrors, type EtlErrorEntry } from './db'
import type mysql from 'mysql2/promise'

const isPilot   = process.argv.includes('--pilot')
const PILOT_LIMIT = 500
const BATCH_SIZE  = 1000   // her MySQL sorgusunda çekilecek kayıt sayısı

interface LegacyArsiv {
  ArsivID:  number
  DergiID:  number
  Yil:      string
  Sayi:     string
  issue_id: number
  Aktif:    number
  Hit:      number
}

function buildIssueLabel(yil: string | null, sayi: string | null): string | null {
  const parts: string[] = []
  if (yil?.trim())  parts.push(yil.trim())
  if (sayi?.trim()) parts.push(`Sayı ${sayi.trim()}`)
  return parts.length > 0 ? parts.join(' / ') : null
}

async function main() {
  console.log(`📋 ETL 02 — dergi_arsiv → issues [${isPilot ? `PILOT: ilk ${PILOT_LIMIT}` : 'FULL'}]`)
  const pool = getMysqlPool()
  const sb   = getSupabaseAdmin()

  // Toplam kayıt sayısını öğren
  const [countRows] = await pool.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM dergi_arsiv')
  const totalRows   = isPilot ? Math.min(PILOT_LIMIT, Number(countRows[0].cnt)) : Number(countRows[0].cnt)
  console.log(`  MySQL'de ${totalRows} arşiv kaydı var.`)

  const runId = await startRun(sb, {
    script:      '02-issues',
    mode:        isPilot ? 'pilot' : 'full',
    sourceTable: 'dergi_arsiv',
    targetTable: 'issues',
    limitRows:   isPilot ? PILOT_LIMIT : undefined,
  })

  let totalInserted = 0
  let totalErrors   = 0
  let totalSkipped  = 0
  const errorLog: EtlErrorEntry[] = []

  for (let offset = 0; offset < totalRows; offset += BATCH_SIZE) {
    const limit = Math.min(BATCH_SIZE, totalRows - offset)

    // pool.query() ile string interpolasyon — MySQL 8.4 LIMIT/OFFSET uyumlu
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT ArsivID, DergiID, Yil, Sayi, issue_id, Aktif, Hit
       FROM dergi_arsiv
       ORDER BY ArsivID ASC
       LIMIT ${limit} OFFSET ${offset}`
    )

    const issues: Record<string, unknown>[] = []

    for (const raw of rows as LegacyArsiv[]) {
      if (!raw.ArsivID || !raw.DergiID) {
        errorLog.push({ sourceTable: 'dergi_arsiv', sourceId: raw.ArsivID ?? null, errorType: 'validation', errorMessage: 'ArsivID veya DergiID boş' })
        totalSkipped++; continue
      }

      const yilInt = raw.Yil?.trim() ? parseInt(raw.Yil.trim(), 10) : null
      const year   = yilInt && !isNaN(yilInt) && yilInt > 1900 && yilInt < 2100 ? yilInt : null

      if (!year && raw.Yil?.trim()) {
        errorLog.push({ sourceTable: 'dergi_arsiv', sourceId: raw.ArsivID, errorType: 'mapping', errorMessage: `Yıl parse edilemedi: "${raw.Yil}"`, fieldName: 'Yil' })
      }

      issues.push({
        id:                  raw.ArsivID,
        legacy_id:           raw.ArsivID,
        journal_id:          raw.DergiID,
        year,
        issue_number:        raw.Sayi?.trim() || null,
        volume:              null,
        issue_label:         buildIssueLabel(raw.Yil, raw.Sayi),
        dergipark_issue_id:  (raw.issue_id ?? 0) > 0 ? raw.issue_id : null,
        status:              raw.Aktif === 1 ? 'published' : 'draft',
        hit_count:           raw.Hit || 0,
      })
    }

    if (issues.length > 0) {
      const { inserted, errors } = await batchUpsert(sb, 'issues', issues)
      totalInserted += inserted
      totalErrors   += errors
    }

    process.stdout.write(`  issues: ${Math.min(offset + BATCH_SIZE, totalRows)}/${totalRows}  `)
    if ((offset + BATCH_SIZE) % 10000 === 0) process.stdout.write('\n')
  }
  process.stdout.write('\n')

  await logErrors(sb, runId, errorLog)
  await finishRun(sb, runId, {
    rowsRead:     totalRows,
    rowsInserted: totalInserted,
    rowsUpdated:  0,
    rowsSkipped:  totalSkipped,
    rowsError:    totalErrors + errorLog.filter((e) => e.errorType !== 'mapping').length,
  }, totalErrors > 0 ? 'partial' : 'success')

  console.log(`✅ issues: ${totalInserted} upsert | skip: ${totalSkipped} | hata: ${totalErrors} | uyarı: ${errorLog.length}`)
  await pool.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
