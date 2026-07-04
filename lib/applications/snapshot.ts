import type { ContentApplication } from '@prisma/client'

export async function buildRevisionSnapshot(
  app: ContentApplication & {
    attachments?: { id: string }[]
    privateContact?: { applicationId: string } | null
  },
) {
  return {
    title: app.title,
    kind: app.kind,
    draftPayload: (app.draftPayload as Record<string, unknown> | null) ?? null,
    attachmentIds: app.attachments?.map((a) => a.id) ?? [],
    hasPrivateContact: Boolean(app.privateContact),
  }
}
