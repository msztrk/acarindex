import type { ContentApplicationKind, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { ForbiddenError } from '@/lib/auth/forbidden'
import { EDITABLE_CONTENT_STATUSES } from '@/lib/applications/types'
import { recordApplicationEvent } from '@/lib/applications/events'
import { buildRevisionSnapshot } from '@/lib/applications/snapshot'

export type CreateDraftInput = {
  userId: string
  kind: ContentApplicationKind
  title?: string
}

export async function createContentApplicationDraft(input: CreateDraftInput) {
  const row = await prisma.contentApplication.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      title: input.title?.trim() || 'Taslak başvuru',
      status: 'draft',
    },
  })

  await recordApplicationEvent({
    applicationId: row.id,
    eventType: 'draft_created',
    actorId: input.userId,
    toStatus: 'draft',
    metadata: { kind: input.kind },
  })

  return row
}

export async function updateContentApplicationDraft(input: {
  applicationId: string
  userId: string
  title?: string
  draftPayload?: Record<string, unknown> | null
}) {
  const existing = await prisma.contentApplication.findFirst({
    where: { id: input.applicationId, userId: input.userId },
  })
  if (!existing) throw new ForbiddenError()
  if (!EDITABLE_CONTENT_STATUSES.includes(existing.status)) {
    throw new Error('Application not editable in current status')
  }

  return prisma.contentApplication.update({
    where: { id: input.applicationId },
    data: {
      title: input.title?.trim() || existing.title,
      draftPayload:
        input.draftPayload !== undefined
          ? (input.draftPayload as Prisma.InputJsonValue)
          : undefined,
    },
  })
}

export async function submitContentApplication(input: {
  applicationId: string
  userId: string
}) {
  const existing = await prisma.contentApplication.findFirst({
    where: { id: input.applicationId, userId: input.userId },
    include: {
      attachments: { where: { uploadStatus: 'committed' }, select: { id: true } },
      privateContact: { select: { applicationId: true } },
    },
  })
  if (!existing) throw new ForbiddenError()

  const canSubmit =
    existing.status === 'draft' || existing.status === 'revision_requested'
  if (!canSubmit) {
    throw new Error('Application cannot be submitted in current status')
  }

  const submissionType =
    existing.status === 'revision_requested' ? 'resubmit' : 'initial_submit'

  const snapshot = await buildRevisionSnapshot(existing)

  const row = await prisma.$transaction(async (tx) => {
    const last = await tx.applicationRevision.findFirst({
      where: { applicationId: existing.id },
      orderBy: { revisionNumber: 'desc' },
      select: { revisionNumber: true },
    })
    const revisionNumber = (last?.revisionNumber ?? 0) + 1

    const revision = await tx.applicationRevision.create({
      data: {
        applicationId: existing.id,
        revisionNumber,
        snapshotJson: snapshot as object,
        createdBy: input.userId,
        submissionType,
      },
    })

    const updated = await tx.contentApplication.update({
      where: { id: existing.id },
      data: {
        status: 'submitted',
        submittedAt: new Date(),
        draftPayload: null,
      },
    })

    return { updated, revision }
  })

  await recordApplicationEvent({
    applicationId: existing.id,
    eventType: 'submitted',
    actorId: input.userId,
    fromStatus: existing.status,
    toStatus: 'submitted',
    metadata: {
      revisionId: row.revision.id,
      revisionNumber: row.revision.revisionNumber,
      submissionType,
    },
  })

  return row.updated
}

export async function cancelContentApplication(input: {
  applicationId: string
  userId: string
}) {
  const existing = await prisma.contentApplication.findFirst({
    where: { id: input.applicationId, userId: input.userId },
  })
  if (!existing) throw new ForbiddenError()

  const cancellable = ['draft', 'submitted', 'revision_requested'] as const
  if (!cancellable.includes(existing.status as (typeof cancellable)[number])) {
    throw new Error('Application cannot be cancelled in current status')
  }

  const updated = await prisma.contentApplication.update({
    where: { id: existing.id },
    data: { status: 'cancelled' },
  })

  await recordApplicationEvent({
    applicationId: existing.id,
    eventType: 'cancelled',
    actorId: input.userId,
    fromStatus: existing.status,
    toStatus: 'cancelled',
  })

  return updated
}

export async function getContentApplicationDetail(applicationId: string, userId: string) {
  const row = await prisma.contentApplication.findFirst({
    where: { id: applicationId, userId },
    include: {
      events: { orderBy: { createdAt: 'desc' }, take: 50 },
      revisions: { orderBy: { revisionNumber: 'desc' }, take: 20 },
    },
  })
  if (!row) throw new ForbiddenError()
  return row
}

export async function listContentApplicationsForUser(userId: string) {
  return prisma.contentApplication.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })
}

export async function listAdminContentApplicationQueue(limit = 100) {
  return prisma.contentApplication.findMany({
    where: {
      status: {
        in: ['submitted', 'precheck', 'under_review', 'revision_requested'],
      },
    },
    orderBy: { submittedAt: 'asc' },
    take: limit,
    include: {
      user: { select: { email: true, name: true } },
    },
  })
}

export type { RevisionSnapshot } from '@/lib/applications/revisions'
