/**
 * Pending application attachments older than N hours → orphaned.
 * Run via cron, e.g. daily: npx tsx scripts/cleanup-orphan-attachments.ts
 */
import { markOrphanPendingAttachments } from '@/lib/applications/attachments'

const hours = Number(process.env.ORPHAN_ATTACHMENT_HOURS ?? '48')

async function main() {
  const count = await markOrphanPendingAttachments(hours)
  console.log(`Marked ${count} pending attachment(s) as orphaned (older than ${hours}h).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
