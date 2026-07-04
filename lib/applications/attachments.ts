import type { ApplicationAttachmentKind } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { ForbiddenError } from '@/lib/auth/forbidden'
import { hasAdminPermission } from '@/lib/auth/authorization'
import { EDITABLE_CONTENT_STATUSES } from '@/lib/applications/types'
import { getApplicationStorage } from '@/lib/applications/storage'
import {
  AttachmentValidationError,
  isJournalUploadKind,
  type JournalUploadKind,
  validateApplicationFile,
} from '@/lib/applications/storage/file-validation'

export type ApplicationAttachmentSummary = {
  id: string
  kind: ApplicationAttachmentKind
  originalName: string
  mimeType: string
  sizeBytes: number
  uploadStatus: string
  createdAt: string
}

export type UploadAttachmentInput = {
  applicationId: string
  userId: string
  kind: JournalUploadKind
  file: {
    buffer: Buffer
    originalName: string
    mimeType: string
    sizeBytes: number
  }
}

function serializeAttachment(row: {
  id: string
  kind: ApplicationAttachmentKind
  originalName: string
  mimeType: string
  sizeBytes: number
  uploadStatus: string
  createdAt: Date
}): ApplicationAttachmentSummary {
  return {
    id: row.id,
    kind: row.kind,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadStatus: row.uploadStatus,
    createdAt: row.createdAt.toISOString(),
  }
}

async function assertEditableApplicationOwner(applicationId: string, userId: string) {
  const app = await prisma.contentApplication.findFirst({
    where: { id: applicationId, userId },
    select: { id: true, status: true },
  })
  if (!app) throw new ForbiddenError()
  if (!EDITABLE_CONTENT_STATUSES.includes(app.status)) {
    throw new Error('Application not editable in current status')
  }
  return app
}

export async function listAttachmentsForApplication(
  applicationId: string,
  userId: string,
): Promise<ApplicationAttachmentSummary[]> {
  await assertEditableApplicationOwner(applicationId, userId)
  const rows = await prisma.applicationAttachment.findMany({
    where: {
      applicationId,
      uploadStatus: { in: ['pending', 'committed'] },
    },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map(serializeAttachment)
}

export async function uploadAttachment(input: UploadAttachmentInput) {
  if (!isJournalUploadKind(input.kind)) {
    throw new AttachmentValidationError('Geçersiz dosya türü.')
  }

  await assertEditableApplicationOwner(input.applicationId, input.userId)

  const validated = validateApplicationFile({
    kind: input.kind,
    buffer: input.file.buffer,
    mimeType: input.file.mimeType,
    sizeBytes: input.file.sizeBytes,
    originalName: input.file.originalName,
  })

  const storage = getApplicationStorage()
  const stored = await storage.putObject({
    applicationId: input.applicationId,
    kind: input.kind,
    originalName: `upload.${validated.extension}`,
    mimeType: validated.detectedMime,
    sizeBytes: validated.sizeBytes,
    body: input.file.buffer,
  })

  const row = await prisma.applicationAttachment.create({
    data: {
      applicationId: input.applicationId,
      kind: input.kind,
      storageKey: stored.storageKey,
      originalName: input.file.originalName,
      mimeType: validated.detectedMime,
      sizeBytes: validated.sizeBytes,
      checksumSha256: stored.checksumSha256,
      uploadStatus: 'pending',
      uploadedBy: input.userId,
    },
  })

  return serializeAttachment(row)
}

export async function commitAttachments(applicationId: string, attachmentIds?: string[]) {
  const where = attachmentIds?.length
    ? { applicationId, id: { in: attachmentIds }, uploadStatus: 'pending' as const }
    : { applicationId, uploadStatus: 'pending' as const }

  const pending = await prisma.applicationAttachment.findMany({ where })
  if (attachmentIds?.length && pending.length !== attachmentIds.length) {
    throw new Error('One or more attachments do not belong to this application')
  }

  if (pending.length === 0) return []

  await prisma.applicationAttachment.updateMany({
    where: { id: { in: pending.map((p) => p.id) } },
    data: { uploadStatus: 'committed' },
  })

  return pending.map((p) => p.id)
}

export async function deleteAttachment(input: {
  applicationId: string
  attachmentId: string
  userId: string
}) {
  await assertEditableApplicationOwner(input.applicationId, input.userId)

  const row = await prisma.applicationAttachment.findFirst({
    where: {
      id: input.attachmentId,
      applicationId: input.applicationId,
      uploadStatus: { in: ['pending', 'committed'] },
    },
  })
  if (!row) throw new ForbiddenError()

  const storage = getApplicationStorage()
  await storage.deleteObject(row.storageKey).catch(() => {
    /* storage cleanup best-effort */
  })

  await prisma.applicationAttachment.delete({ where: { id: row.id } })
}

export async function getAttachmentDownloadUrl(input: {
  applicationId: string
  attachmentId: string
  userId: string
  userRoles?: string[]
}) {
  const attachment = await prisma.applicationAttachment.findFirst({
    where: { id: input.attachmentId, applicationId: input.applicationId },
    include: { application: { select: { userId: true } } },
  })
  if (!attachment) throw new ForbiddenError()

  const isOwner = attachment.application.userId === input.userId
  const isAdmin = await hasAdminPermission(
    input.userId,
    'review_content_applications',
    input.userRoles,
  )
  if (!isOwner && !isAdmin) throw new ForbiddenError()

  const storage = getApplicationStorage()
  const url = await storage.getSignedDownloadUrl(attachment.storageKey)
  return { url, originalName: attachment.originalName, mimeType: attachment.mimeType }
}

export async function hasCommittedCoverImage(applicationId: string): Promise<boolean> {
  const row = await prisma.applicationAttachment.findFirst({
    where: {
      applicationId,
      kind: 'cover_image',
      uploadStatus: 'committed',
    },
    select: { id: true },
  })
  return Boolean(row)
}

export async function hasPendingOrCommittedCoverImage(applicationId: string): Promise<boolean> {
  const row = await prisma.applicationAttachment.findFirst({
    where: {
      applicationId,
      kind: 'cover_image',
      uploadStatus: { in: ['pending', 'committed'] },
    },
    select: { id: true },
  })
  return Boolean(row)
}

/** Mark pending attachments older than N hours as orphaned (run via cron/script). */
export async function markOrphanPendingAttachments(olderThanHours = 48) {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000)
  const result = await prisma.applicationAttachment.updateMany({
    where: {
      uploadStatus: 'pending',
      createdAt: { lt: cutoff },
    },
    data: { uploadStatus: 'orphaned' },
  })
  return result.count
}
