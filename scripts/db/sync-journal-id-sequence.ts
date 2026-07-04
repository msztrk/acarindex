/**
 * Faz B öncesi: journals.id sequence'in MAX(id) üzerinde olduğunu doğrular.
 * Yeni dergi onay executor'ı bu script PASS etmeden açılmamalıdır.
 */
import { prisma } from '@/lib/db/prisma'

export type JournalSequenceReport = {
  maxJournalId: bigint
  sequenceLastValue: bigint | null
  ok: boolean
  message: string
}

export async function verifyJournalIdSequence(): Promise<JournalSequenceReport> {
  const maxRow = await prisma.$queryRaw<{ max: bigint | null }[]>`
    SELECT MAX(id) AS max FROM journals
  `
  const maxJournalId = maxRow[0]?.max ?? 0n

  const seqRow = await prisma.$queryRaw<{ last_value: bigint | null }[]>`
    SELECT last_value FROM pg_sequences WHERE schemaname = 'public' AND sequencename LIKE '%journals%id%'
    LIMIT 1
  `
  const sequenceLastValue = seqRow[0]?.last_value ?? null

  const ok = sequenceLastValue !== null && sequenceLastValue >= maxJournalId

  return {
    maxJournalId,
    sequenceLastValue,
    ok,
    message: ok
      ? 'Journal ID sequence is ahead of MAX(id).'
      : 'Journal ID sequence must be synced before new journal creation.',
  }
}

export async function syncJournalIdSequence(): Promise<JournalSequenceReport> {
  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE seq_name text; max_id bigint;
    BEGIN
      SELECT pg_get_serial_sequence('journals', 'id') INTO seq_name;
      IF seq_name IS NOT NULL THEN
        SELECT COALESCE(MAX(id), 1) INTO max_id FROM journals;
        PERFORM setval(seq_name, GREATEST(max_id, 1), true);
      END IF;
    END $$;
  `)
  return verifyJournalIdSequence()
}
