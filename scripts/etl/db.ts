/**
 * ETL yardımcılar: MySQL bağlantısı, Supabase admin, batch upsert,
 * ETL audit log (etl_runs + etl_errors).
 */

import mysql from 'mysql2/promise'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

// ─── Bağlantılar ──────────────────────────────────────────────────────────────

export function getMysqlPool() {
  const required = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE']
  for (const k of required) {
    if (!process.env[k]) throw new Error(`Eksik env: ${k}`)
  }
  return mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT ?? '3306', 10),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 5,
    decimalNumbers: true,
    charset: 'utf8mb4',
  })
}

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Eksik env: SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

// ─── Batch upsert ─────────────────────────────────────────────────────────────

export async function batchUpsert(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  table: string,
  rows: Record<string, unknown>[],
  batchSize = 500,
  onConflict = 'legacy_id',
): Promise<{ inserted: number; errors: number }> {
  let inserted = 0
  let errors = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await sb.from(table).upsert(batch, { onConflict })
    if (error) {
      console.error(`  [HATA] ${table} batch ${i}–${i + batchSize}: ${error.message}`)
      errors += batch.length
    } else {
      inserted += batch.length
      process.stdout.write(`\r  ${table}: ${Math.min(i + batchSize, rows.length)}/${rows.length}`)
    }
  }
  if (rows.length > 0) console.log()
  return { inserted, errors }
}

// ─── ETL Audit Log ────────────────────────────────────────────────────────────

export interface RunOptions {
  script: string          // "01-journals"
  mode: 'full' | 'pilot' | 'dry-run'
  sourceTable: string
  targetTable: string
  limitRows?: number
  offsetRows?: number
}

export interface RunStats {
  rowsRead: number
  rowsInserted: number
  rowsUpdated: number
  rowsSkipped: number
  rowsError: number
}

export interface EtlErrorEntry {
  sourceTable: string
  sourceId: number | null
  sourceRow?: Record<string, unknown>
  errorType: 'validation' | 'constraint' | 'mapping' | 'network'
  errorMessage: string
  fieldName?: string
}

/**
 * ETL run kaydı başlatır. run_id döner (finish ve error log için kullanılır).
 */
export async function startRun(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  opts: RunOptions,
): Promise<string> {
  const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)
  const runId = `${opts.script}-${ts}-${Math.random().toString(36).slice(2, 8)}`

  const { error } = await sb.from('etl_runs').insert({
    run_id: runId,
    script: opts.script,
    mode: opts.mode,
    source_table: opts.sourceTable,
    target_table: opts.targetTable,
    limit_rows: opts.limitRows ?? null,
    offset_rows: opts.offsetRows ?? 0,
    status: 'running',
  })

  if (error) {
    console.warn(`  [UYARI] etl_runs kaydı oluşturulamadı: ${error.message}`)
  }
  return runId
}

/**
 * ETL run kaydını tamamlar (success / partial / failed).
 */
export async function finishRun(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  runId: string,
  stats: RunStats,
  status: 'success' | 'partial' | 'failed' = 'success',
  errorSummary?: string,
): Promise<void> {
  const { error } = await sb.from('etl_runs').update({
    rows_read: stats.rowsRead,
    rows_inserted: stats.rowsInserted,
    rows_updated: stats.rowsUpdated,
    rows_skipped: stats.rowsSkipped,
    rows_error: stats.rowsError,
    finished_at: new Date().toISOString(),
    status: stats.rowsError > 0 && status === 'success' ? 'partial' : status,
    error_summary: errorSummary ?? null,
  }).eq('run_id', runId)

  if (error) console.warn(`  [UYARI] etl_runs güncelleme hatası: ${error.message}`)
}

/**
 * ETL hata kaydı ekler. Toplu: `entries` dizisini batch olarak yazar.
 */
export async function logErrors(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  runId: string,
  entries: EtlErrorEntry[],
): Promise<void> {
  if (entries.length === 0) return
  const rows = entries.map((e) => ({
    run_id: runId,
    source_table: e.sourceTable,
    source_id: e.sourceId,
    source_row: e.sourceRow ?? null,
    error_type: e.errorType,
    error_message: e.errorMessage,
    field_name: e.fieldName ?? null,
  }))
  // max 100 hata kaydı (log şişmesini önle)
  const { error } = await sb.from('etl_errors').insert(rows.slice(0, 100))
  if (error) console.warn(`  [UYARI] etl_errors yazma hatası: ${error.message}`)
}
