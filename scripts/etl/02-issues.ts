/**
 * ETL 02 — dergi_arsiv → issues
 *
 * Kullanım:
 *   npx tsx scripts/etl/02-issues.ts            # tüm kayıtlar
 *   npx tsx scripts/etl/02-issues.ts --pilot    # ilk 500 sayı
 *
 * Kaynak  : MySQL dergi_arsiv (ana kaynak; bot_dergi_arsiv dışlandı)
 * Bağımlı : 01-journals.ts (journal_id FK)
 */

import { getMysqlPool, getSupabaseAdmin, batchUpsert, startRun, finishRun, logErrors, type EtlErrorEntry } from './db'
import type mysql from 'mysql2/promise'

const isPilot = process.argv.includes('--pilot')
const PILOT_LIMIT = 500

interface LegacyArsiv {
  ArsivID: number
  DergiID: number
  Yil: string        // VARCHAR(300)
  Sayi: string       // VARCHAR(300)
  issue_id: number   // DergiPark external ID (0 = yok)
  Aktif: number
  Hit: number
}

function buildIssueLabel(yil: string | null, sayi: string | null): string | null {
  const parts: string[] = []
  if (yil?.trim()) parts.push(yil.trim())
  if (sayi?.trim()) parts.push(`Sayı ${sayi.trim()}`)
  return parts.length > 0 ? parts.join(' / ') : null
}

async function main() {
  console.log(`📋 ETL 02 — dergi_arsiv → issues [${isPilot ? `PILOT: ilk ${PILOT_LIMIT}` : 'FULL'}]`)
  const pool = getMysqlPool()
  const sb = getSupabaseAdmin()

  const runId = await startRun(sb, {
    script: '02-issues',
    mode: isPilot ? 'pilot' : 'full',
    sourceTable: 'dergi_arsiv',
    targetTable: 'issues',
    limitRows: isPilot ? PILOT_LIMIT : undefined,
  })

  const limitClause = isPilot ? `LIMIT ${PILOT_LIMIT}` : ''
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT ArsivID, DergiID, Yil, Sayi, issue_id, Aktif, Hit
     FROM dergi_arsiv
     ORDER BY DergiID ASC, Yil DESC, Sayi ASC ${limitClause}`,
  )
  console.log(`  MySQL'den ${rows.length} arşiv kaydı okundu.`)

  const issues: Record<string, unknown>[] = []
  const errorLog: EtlErrorEntry[] = []
  let skipped = 0

  for (const raw of rows as LegacyArsiv[]) {
    if (!raw.ArsivID || !raw.DergiID) {
      errorLog.push({ sourceTable: 'dergi_arsiv', sourceId: raw.ArsivID ?? null, errorType: 'validation', errorMessage: 'ArsivID veya DergiID boş' })
      skipped++; continue
    }

    const yilInt = raw.Yil?.trim() ? parseInt(raw.Yil.trim(), 10) : null
    const year = yilInt && !isNaN(yilInt) && yilInt > 1900 && yilInt < 2100 ? yilInt : null

    if (!year && raw.Yil?.trim()) {
      errorLog.push({ sourceTable: 'dergi_arsiv', sourceId: raw.ArsivID, errorType: 'mapping', errorMessage: `Yıl parse edilemedi: "${raw.Yil}"`, fieldName: 'Yil' })
    }

    issues.push({
      id: raw.ArsivID,
      legacy_id: raw.ArsivID,
      journal_id: raw.DergiID,
      year,
      issue_number: raw.Sayi?.trim() || null,
      volume: null,
      issue_label: buildIssueLabel(raw.Yil, raw.Sayi),
      dergipark_issue_id: (raw.issue_id ?? 0) > 0 ? raw.issue_id : null,
      status: raw.Aktif === 1 ? 'published' : 'draft',
      hit_count: raw.Hit || 0,
    })
  }

  const { inserted, errors } = await batchUpsert(sb, 'issues', issues)
  await logErrors(sb, runId, errorLog)
  await finishRun(sb, runId, {
    rowsRead: rows.length,
    rowsInserted: inserted,
    rowsUpdated: 0,
    rowsSkipped: skipped,
    rowsError: errors + errorLog.filter((e) => e.errorType !== 'mapping').length,
  }, errors > 0 ? 'partial' : 'success')

  console.log(`✅ issues: ${inserted} upsert | skip: ${skipped} | hata: ${errors} | uyarı: ${errorLog.length}`)
  await pool.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
