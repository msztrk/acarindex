#!/usr/bin/env tsx
/**
 * CLI batch processor for notification outbox — safe for cron (Resend optional).
 */
import { processNotificationOutbox } from '@/lib/notifications/process-outbox'

function parseLimit(): number {
  const fromArg = process.argv[2]
  const raw = fromArg ?? process.env.OUTBOX_BATCH_LIMIT ?? '20'
  const limit = Number(raw)
  if (!Number.isFinite(limit) || limit < 1 || limit > 500) {
    console.error('Geçersiz limit (1–500).')
    process.exit(1)
  }
  return limit
}

async function main(): Promise<void> {
  const limit = parseLimit()
  const processed = await processNotificationOutbox(limit)
  console.log(`outbox_processed=${processed}`)
}

main().catch((error) => {
  console.error(
    'Notification outbox processor failed:',
    error instanceof Error ? error.message : error,
  )
  process.exit(1)
})
