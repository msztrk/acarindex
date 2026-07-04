import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/auth/audit'
import { revalidateEnglishContentCache } from '@/lib/i18n/revalidate-english-content'
import { revalidatePath, revalidateTag } from 'next/cache'
import { I18N_SITEMAP_TAG } from '@/lib/i18n/cache-tags'

const PUBLISHABLE_STATUSES = new Set(['draft', 'pending_publication'])

export const JOURNAL_STATUS_LABELS: Record<string, string> = {
  published: 'Yayında',
  draft: 'Taslak',
  archived: 'Arşiv',
  pending_publication: 'Yayın bekliyor',
}

export type PublishDraftJournalResult = {
  journalId: string
  slug: string
  status: string
  idempotent: boolean
}

export async function publishDraftJournal(
  journalId: bigint,
  actorId: string,
): Promise<PublishDraftJournalResult> {
  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    select: { id: true, slug: true, titleTr: true, status: true },
  })

  if (!journal) {
    throw new Error('Journal not found')
  }

  if (journal.status === 'published') {
    return {
      journalId: journal.id.toString(),
      slug: journal.slug,
      status: journal.status,
      idempotent: true,
    }
  }

  if (!PUBLISHABLE_STATUSES.has(journal.status)) {
    throw new Error('Journal cannot be published in current status')
  }

  if (!journal.slug?.trim()) {
    throw new Error('Journal slug is required for publication')
  }
  if (!journal.titleTr?.trim()) {
    throw new Error('Journal title (TR) is required for publication')
  }

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.journal.findUnique({
      where: { id: journalId },
      select: { id: true, slug: true, titleTr: true, status: true },
    })
    if (!current) {
      throw new Error('Journal not found')
    }
    if (current.status === 'published') {
      return current
    }
    if (!PUBLISHABLE_STATUSES.has(current.status)) {
      throw new Error('Journal cannot be published in current status')
    }

    return tx.journal.update({
      where: { id: journalId },
      data: { status: 'published' },
      select: { id: true, slug: true, titleTr: true, status: true },
    })
  })

  await writeAuditLog({
    actorId,
    action: 'journal.published',
    entityType: 'journal',
    entityId: updated.id.toString(),
    oldValues: { status: journal.status },
    newValues: { status: 'published', slug: updated.slug },
  })

  revalidateTag(I18N_SITEMAP_TAG, 'max')
  revalidatePath('/journals')
  revalidatePath('/sitemap-journals')
  revalidatePath(`/journals/${updated.slug}-${updated.id}`)
  revalidateEnglishContentCache()

  return {
    journalId: updated.id.toString(),
    slug: updated.slug,
    status: updated.status,
    idempotent: false,
  }
}
