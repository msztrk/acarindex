/**
 * ETL 01 — dergiler → categories + journals
 *
 * Kullanım:
 *   npx tsx scripts/etl/01-journals.ts            # tüm kayıtlar
 *   npx tsx scripts/etl/01-journals.ts --pilot    # ilk 100 dergi
 *
 * Kaynak  : MySQL dergiler (ana kaynak; bot_dergiler dışlandı)
 * Hedef   : Supabase categories + journals
 * Audit   : etl_runs + etl_errors tabloları
 */

import { getMysqlPool, getSupabaseAdmin, batchUpsert, startRun, finishRun, logErrors, type EtlErrorEntry } from './db'
import { urlYap } from '../../lib/urls/slug'
import type mysql from 'mysql2/promise'

const isPilot = process.argv.includes('--pilot')
const PILOT_LIMIT = 100

interface LegacyDergi {
  DergiID: number
  DergiBASLIK: string
  Issn: string
  Eissn: string
  YayinARALIGI: string
  Baslangic: string
  Yayinci: string
  Aciklama: string
  Amac: string
  Kapsam: string
  YazimKURALLARI: string
  DergiKUNYESI: string
  EditorKURULU: string
  Iletisim: string
  KategoriID: number
  Resim: string
  contact: string | null
  about: string | null
  aim_and_scope: string | null
  policy: string | null
  indexes: string | null
  price_policy: string | null
  editor: string | null
  topics: string | null
  publisher: string | null
  publish_language: string | null
  years_indexed: string | null
  subject_category: string | null
  publication_format: string | null
  old_name: string | null
  Aktif: number
  Hit: number
  Link: string
}

async function migrateCategories(
  pool: mysql.Pool,
  sb: ReturnType<typeof getSupabaseAdmin>,
) {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT KategoriID, KategoriBASLIKTR, KategoriBASLIKEN, KategoriURL FROM kategoriler ORDER BY KategoriID',
  )
  const cats = (rows as { KategoriID: number; KategoriBASLIKTR: string; KategoriBASLIKEN: string; KategoriURL: string }[])
    .map((c) => ({
      id: c.KategoriID,
      legacy_id: c.KategoriID,
      name_tr: c.KategoriBASLIKTR || null,
      name_en: c.KategoriBASLIKEN || null,
      slug: c.KategoriURL || null,
    }))

  const { error } = await sb.from('categories').upsert(cats, { onConflict: 'legacy_id' })
  if (error) console.error('  [HATA] categories:', error.message)
  else console.log(`  categories: ${cats.length} upsert`)
}

async function main() {
  console.log(`📚 ETL 01 — dergiler → journals [${isPilot ? `PILOT: ilk ${PILOT_LIMIT}` : 'FULL'}]`)
  const pool = getMysqlPool()
  const sb = getSupabaseAdmin()

  const runId = await startRun(sb, {
    script: '01-journals',
    mode: isPilot ? 'pilot' : 'full',
    sourceTable: 'dergiler',
    targetTable: 'journals',
    limitRows: isPilot ? PILOT_LIMIT : undefined,
  })

  await migrateCategories(pool, sb)

  const limitClause = isPilot ? `LIMIT ${PILOT_LIMIT}` : ''
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT * FROM dergiler ORDER BY DergiID ASC ${limitClause}`,
  )
  console.log(`  MySQL'den ${rows.length} dergi okundu.`)

  const journals: Record<string, unknown>[] = []
  const errorLog: EtlErrorEntry[] = []
  let skipped = 0

  for (const raw of rows as LegacyDergi[]) {
    // Zorunlu alan kontrolü
    if (!raw.DergiID) {
      errorLog.push({ sourceTable: 'dergiler', sourceId: null, errorType: 'validation', errorMessage: 'DergiID boş', fieldName: 'DergiID' })
      skipped++; continue
    }
    if (!raw.DergiBASLIK?.trim()) {
      errorLog.push({ sourceTable: 'dergiler', sourceId: raw.DergiID, errorType: 'validation', errorMessage: 'DergiBASLIK boş', fieldName: 'DergiBASLIK' })
      skipped++; continue
    }

    const aimAndScope =
      raw.aim_and_scope?.trim() ||
      [raw.Amac?.trim(), raw.Kapsam?.trim()].filter(Boolean).join('\n\n') || null
    const publisher = raw.publisher?.trim() || raw.Yayinci?.trim() || null

    let contactJson: unknown = null
    if (raw.contact) {
      try { contactJson = JSON.parse(raw.contact) } catch { /* invalid JSON → null */ }
    }

    journals.push({
      id: raw.DergiID,
      legacy_id: raw.DergiID,
      slug: urlYap(raw.DergiBASLIK),
      title_tr: raw.DergiBASLIK.trim(),
      old_name: raw.old_name?.trim() || null,
      issn: raw.Issn?.trim() || null,
      eissn: raw.Eissn?.trim() || null,
      publisher,
      frequency: raw.YayinARALIGI?.trim() || null,
      start_year: raw.Baslangic?.trim() || null,
      publication_format: raw.publication_format?.trim() || null,
      publish_language: raw.publish_language?.trim() || null,
      subject_category: raw.subject_category?.trim() || null,
      topics: raw.topics?.trim() || null,
      editor_in_chief: raw.editor?.trim() || null,
      editorial_board: raw.EditorKURULU?.trim() || null,
      colophon: raw.DergiKUNYESI?.trim() || null,
      description: raw.Aciklama?.trim() || null,
      about: raw.about?.trim() || null,
      aim_and_scope: aimAndScope,
      policy: raw.policy?.trim() || null,
      writing_rules: raw.YazimKURALLARI?.trim() || null,
      price_policy: raw.price_policy?.trim() || null,
      indexes_text: raw.indexes?.trim() || null,
      years_indexed: raw.years_indexed?.trim() || null,
      contact_text: raw.Iletisim?.trim() || null,
      contact_json: contactJson as Record<string, unknown> | null,
      cover_path: raw.Resim?.trim() || null,
      legacy_link: raw.Link?.trim() || null,
      category_id: raw.KategoriID || null,
      status: raw.Aktif === 1 ? 'published' : 'draft',
      hit_count: raw.Hit || 0,
    })
  }

  const { inserted, errors } = await batchUpsert(sb, 'journals', journals)
  await logErrors(sb, runId, errorLog)
  await finishRun(sb, runId, {
    rowsRead: rows.length,
    rowsInserted: inserted,
    rowsUpdated: 0,
    rowsSkipped: skipped,
    rowsError: errors + errorLog.length,
  }, errors > 0 ? 'partial' : 'success')

  console.log(`✅ journals: ${inserted} upsert | skip: ${skipped} | hata: ${errors}`)
  await pool.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
