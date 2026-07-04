import type { ContentApplication } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { serializeJournalApplication } from '@/lib/journal-applications/serialize'

export async function buildRevisionSnapshot(
  app: ContentApplication & {
    attachments?: { id: string }[]
    privateContact?: { applicationId: string } | null
  },
) {
  const base = {
    title: app.title,
    kind: app.kind,
    draftPayload: (app.draftPayload as Record<string, unknown> | null) ?? null,
    attachmentIds: app.attachments?.map((a) => a.id) ?? [],
    hasPrivateContact: Boolean(app.privateContact),
  }

  if (app.kind !== 'new_journal') return base

  const journal = await prisma.journalApplication.findUnique({
    where: { contentApplicationId: app.id },
    include: {
      subjectAreas: { include: { category: { select: { id: true, nameTr: true, nameEn: true } } } },
      declarationAcceptance: true,
      publisherInstitution: { select: { id: true, nameTr: true } },
    },
  })

  if (!journal) return base

  return {
    ...base,
    journalApplication: serializeJournalApplication(journal),
  }
}
