import { prisma } from '@/lib/db/prisma'

export const JOURNAL_ID_SEQUENCE = 'journals_id_seq'

export type JournalSequenceReport = {
  maxJournalId: bigint
  sequenceLastValue: bigint | null
  ok: boolean
  message: string
}

export async function readJournalSequenceLastValue(): Promise<bigint | null> {
  const rows = await prisma.$queryRaw<{ last_value: bigint | null }[]>`
    SELECT last_value FROM journals_id_seq
  `
  return rows[0]?.last_value ?? null
}

export async function verifyJournalIdSequence(): Promise<JournalSequenceReport> {
  const maxRow = await prisma.$queryRaw<{ max: bigint | null }[]>`
    SELECT MAX(id) AS max FROM journals
  `
  const maxJournalId = maxRow[0]?.max ?? BigInt(0)

  let sequenceLastValue: bigint | null = null
  try {
    sequenceLastValue = await readJournalSequenceLastValue()
  } catch {
    sequenceLastValue = null
  }

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

/** Idempotent: set journals_id_seq so next nextval() > MAX(id). */
export async function syncJournalIdSequence(): Promise<JournalSequenceReport> {
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      'journals_id_seq',
      (SELECT COALESCE(MAX(id), 1) FROM journals),
      true
    );
  `)
  return verifyJournalIdSequence()
}
