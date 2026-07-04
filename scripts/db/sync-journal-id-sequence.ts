/**
 * Faz B öncesi: journals.id sequence'in MAX(id) üzerinde olduğunu doğrular.
 * Yeni dergi onay executor'ı bu script PASS etmeden açılmamalıdır.
 */
import {
  syncJournalIdSequence,
  verifyJournalIdSequence,
  type JournalSequenceReport,
} from '@/lib/db/journal-id-sequence'

export { syncJournalIdSequence, verifyJournalIdSequence, type JournalSequenceReport }

async function main() {
  const report = await verifyJournalIdSequence()
  console.log(JSON.stringify(report, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2))
  if (!report.ok) {
    console.error('Journal ID sequence out of sync. Run: npx tsx scripts/db/sync-journal-id-sequence.ts --sync')
    process.exit(1)
  }
}

const syncFlag = process.argv.includes('--sync')
if (syncFlag) {
  syncJournalIdSequence()
    .then((report) => {
      console.log(JSON.stringify(report, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2))
      process.exit(report.ok ? 0 : 1)
    })
    .catch((e) => {
      console.error(e instanceof Error ? e.message : String(e))
      process.exit(1)
    })
} else {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e))
    process.exit(1)
  })
}
