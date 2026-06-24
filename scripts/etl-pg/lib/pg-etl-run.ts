/**
 * ETL run audit — Prisma / PostgreSQL hedef.
 */
import { prisma } from '../../../lib/db/prisma'

export interface PgEtlRunStart {
  script: string
  mode: string
  sourceTable?: string
  targetTable?: string
  limitRows?: number
  notes?: string
}

export async function startPgEtlRun(opts: PgEtlRunStart): Promise<string> {
  const runId = `pg-${opts.script}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await prisma.etlRun.create({
    data: {
      runId,
      script: opts.script,
      mode: opts.mode,
      sourceTable: opts.sourceTable,
      targetTable: opts.targetTable,
      limitRows: opts.limitRows,
      status: 'running',
    },
  })
  return runId
}

export interface PgEtlRunFinish {
  rowsRead?: number
  rowsInserted?: number
  rowsUpdated?: number
  rowsSkipped?: number
  rowsError?: number
  status: 'success' | 'partial' | 'failed' | 'interrupted'
  errorSummary?: string
  notes?: string
}

export async function finishPgEtlRun(runId: string, result: PgEtlRunFinish): Promise<void> {
  await prisma.etlRun.update({
    where: { runId },
    data: {
      finishedAt: new Date(),
      rowsRead: result.rowsRead ?? 0,
      rowsInserted: result.rowsInserted ?? 0,
      rowsUpdated: result.rowsUpdated ?? 0,
      rowsSkipped: result.rowsSkipped ?? 0,
      rowsError: result.rowsError ?? 0,
      status: result.status,
      errorSummary: result.errorSummary ? sanitizeEtlErrorMessage(result.errorSummary) : null,
      notes: result.notes,
    },
  })
}

export function sanitizeEtlErrorMessage(msg: string): string {
  return msg
    .replace(/postgres(ql)?:\/\/[^\s'"]+/gi, 'postgresql://***')
    .replace(/mysql:\/\/[^\s'"]+/gi, 'mysql://***')
    .replace(/(password|MYSQL_PWD)[=:]\S+/gi, '$1=***')
}

export async function failPgEtlRun(
  runId: string,
  errorSummary: string,
  partial?: Partial<PgEtlRunFinish>,
): Promise<void> {
  await finishPgEtlRun(runId, {
    rowsRead: partial?.rowsRead ?? 0,
    rowsInserted: partial?.rowsInserted ?? 0,
    rowsUpdated: partial?.rowsUpdated ?? 0,
    rowsSkipped: partial?.rowsSkipped ?? 0,
    rowsError: partial?.rowsError ?? 0,
    status: 'failed',
    errorSummary,
    notes: partial?.notes,
  })
}

export async function interruptPgEtlRun(
  runId: string,
  errorSummary: string,
  partial?: Partial<PgEtlRunFinish>,
): Promise<void> {
  await finishPgEtlRun(runId, {
    rowsRead: partial?.rowsRead ?? 0,
    rowsInserted: partial?.rowsInserted ?? 0,
    rowsUpdated: partial?.rowsUpdated ?? 0,
    rowsSkipped: partial?.rowsSkipped ?? 0,
    rowsError: partial?.rowsError ?? 0,
    status: 'interrupted',
    errorSummary,
    notes: partial?.notes,
  })
}

export interface PgEtlErrorEntry {
  sourceTable?: string
  sourceId?: number | null
  errorType: string
  errorMessage: string
  fieldName?: string
  sourceRow?: Record<string, unknown>
}

export async function logPgEtlErrors(runId: string, errors: PgEtlErrorEntry[]): Promise<void> {
  if (errors.length === 0) return
  const slice = errors.slice(0, 500)
  await prisma.etlError.createMany({
    data: slice.map((e) => ({
      runId,
      sourceTable: e.sourceTable,
      sourceId: e.sourceId != null ? BigInt(e.sourceId) : null,
      errorType: e.errorType,
      errorMessage: e.errorMessage,
      fieldName: e.fieldName,
      sourceRow: e.sourceRow ?? undefined,
    })),
  })
}
