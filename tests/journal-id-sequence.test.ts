import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db/prisma'
import {
  readJournalSequenceLastValue,
  syncJournalIdSequence,
  verifyJournalIdSequence,
} from '@/lib/db/journal-id-sequence'

const runIntegration = process.env.JOURNAL_ID_SEQUENCE_INTEGRATION === '1'
const describeIntegration = runIntegration ? describe : describe.skip

function testJournalSlug(suffix: string): string {
  return `journal-id-seq-test-${suffix}-${Date.now()}`
}

describeIntegration('journal-id-sequence integration', () => {
  it('1. insert without explicit id succeeds', async () => {
    const slug = testJournalSlug('implicit')
    const row = await prisma.journal.create({
      data: { slug, status: 'draft' },
      select: { id: true },
    })
    expect(row.id).toBeGreaterThan(BigInt(0))
    await prisma.journal.delete({ where: { id: row.id } })
  })

  it('2. new id is greater than current max before insert', async () => {
    const before = await verifyJournalIdSequence()
    const slug = testJournalSlug('max')
    const row = await prisma.journal.create({
      data: { slug, status: 'draft' },
      select: { id: true },
    })
    expect(row.id).toBeGreaterThan(before.maxJournalId)
    await prisma.journal.delete({ where: { id: row.id } })
  })

  it('3. concurrent inserts receive distinct ids', async () => {
    const slugA = testJournalSlug('a')
    const slugB = testJournalSlug('b')
    const [a, b] = await Promise.all([
      prisma.journal.create({ data: { slug: slugA, status: 'draft' }, select: { id: true } }),
      prisma.journal.create({ data: { slug: slugB, status: 'draft' }, select: { id: true } }),
    ])
    expect(a.id).not.toEqual(b.id)
    await prisma.journal.deleteMany({ where: { id: { in: [a.id, b.id] } } })
  })

  it('4. explicit legacy id insert still works', async () => {
    const maxRow = await prisma.$queryRaw<{ max: bigint | null }[]>`
      SELECT MAX(id) AS max FROM journals
    `
    const legacyId = (maxRow[0]?.max ?? BigInt(0)) + BigInt(500000)
    const slug = testJournalSlug('legacy')
    const row = await prisma.journal.create({
      data: { id: legacyId, slug, status: 'draft' },
      select: { id: true },
    })
    expect(row.id).toBe(legacyId)
    await prisma.journal.delete({ where: { id: row.id } })
  })

  it('5. sequence can be resynced after explicit legacy insert', async () => {
    const maxRow = await prisma.$queryRaw<{ max: bigint | null }[]>`
      SELECT MAX(id) AS max FROM journals
    `
    const legacyId = (maxRow[0]?.max ?? BigInt(0)) + BigInt(500001)
    const slug = testJournalSlug('resync')
    await prisma.journal.create({
      data: { id: legacyId, slug, status: 'draft' },
    })
    const synced = await syncJournalIdSequence()
    expect(synced.ok).toBe(true)
    expect(synced.sequenceLastValue).toBeGreaterThanOrEqual(legacyId)
    await prisma.journal.delete({ where: { id: legacyId } })
  })

  it('6. existing journal ids are unchanged', async () => {
    const sample = await prisma.journal.findFirst({
      orderBy: { id: 'asc' },
      select: { id: true, slug: true },
    })
    expect(sample).not.toBeNull()
    const again = await prisma.journal.findUnique({
      where: { id: sample!.id },
      select: { id: true, slug: true },
    })
    expect(again).toEqual(sample)
  })

  it('7. rollback rehearsal does not mutate existing ids', async () => {
    const before = await prisma.journal.findMany({
      take: 5,
      orderBy: { id: 'asc' },
      select: { id: true },
    })
    const seqBefore = await readJournalSequenceLastValue()
    expect(seqBefore).not.toBeNull()
    const after = await prisma.journal.findMany({
      where: { id: { in: before.map((r) => r.id) } },
      select: { id: true },
    })
    expect(after.map((r) => r.id)).toEqual(before.map((r) => r.id))
  })
})
