import type { ContentApplicationStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/auth/audit'
import { enqueueNotification } from '@/lib/notifications/outbox'
import { formatIssn, validateIssn } from '@/lib/validation/issn'
import { runJournalDuplicatePrecheck } from '@/lib/journal-applications/run-duplicate-precheck'
import { approveJournalApplication } from '@/lib/journal-applications/approve'
import {
  parsePublisherInstitutionId,
  serializeJournalApplication,
  serializePrivateContact,
} from '@/lib/journal-applications/serialize'
import type { ApplicationAttachmentSummary } from '@/lib/applications/attachments'

const journalInclude = {
  subjectAreas: { include: { category: { select: { id: true, nameTr: true, nameEn: true } } } },
  declarationAcceptance: true,
  publisherInstitution: { select: { id: true, nameTr: true } },
} as const

const REVIEWABLE_STATUSES: ContentApplicationStatus[] = [
  'submitted',
  'precheck',
  'under_review',
  'revision_requested',
  'approved',
  'rejected',
]

export const CONTENT_STATUS_LABELS: Record<ContentApplicationStatus, string> = {
  draft: 'Taslak',
  submitted: 'Gönderildi',
  precheck: 'Ön kontrol',
  under_review: 'İncelemede',
  revision_requested: 'Düzeltme istendi',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  cancelled: 'İptal',
}

export type AdminJournalReviewAction =
  | 'precheck'
  | 'under_review'
  | 'request_revision'
  | 'reject'
  | 'approve'

function serializeAttachment(row: {
  id: string
  kind: string
  originalName: string
  mimeType: string
  sizeBytes: number
  uploadStatus: string
  createdAt: Date
}): ApplicationAttachmentSummary {
  return {
    id: row.id,
    kind: row.kind as ApplicationAttachmentSummary['kind'],
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadStatus: row.uploadStatus,
    createdAt: row.createdAt.toISOString(),
  }
}

function issnValidationStatus(journal: {
  pIssn: string | null
  eIssn: string | null
  pIssnNormalized: string | null
  eIssnNormalized: string | null
}) {
  const p = journal.pIssnNormalized
    ? validateIssn(formatIssn(journal.pIssnNormalized))
    : journal.pIssn
      ? validateIssn(journal.pIssn)
      : null
  const e = journal.eIssnNormalized
    ? validateIssn(formatIssn(journal.eIssnNormalized))
    : journal.eIssn
      ? validateIssn(journal.eIssn)
      : null

  return {
    pIssn: p ? (p.ok ? { ok: true as const, formatted: p.formatted } : { ok: false as const, error: p.error }) : null,
    eIssn: e ? (e.ok ? { ok: true as const, formatted: e.formatted } : { ok: false as const, error: e.error }) : null,
    hasAtLeastOneValid: Boolean((p && p.ok) || (e && e.ok)),
  }
}

export async function getJournalApplicationForAdmin(contentApplicationId: string) {
  const content = await prisma.contentApplication.findFirst({
    where: { id: contentApplicationId, kind: 'new_journal' },
    include: {
      user: { select: { id: true, email: true, name: true } },
      assignee: { select: { id: true, email: true, name: true } },
      journalApplication: { include: journalInclude },
      privateContact: true,
      attachments: {
        where: { uploadStatus: 'committed' },
        orderBy: { createdAt: 'asc' },
      },
      revisions: {
        orderBy: { revisionNumber: 'desc' },
        include: { creator: { select: { email: true, name: true } } },
      },
      events: { orderBy: { createdAt: 'desc' }, take: 100 },
      reviews: {
        orderBy: { createdAt: 'desc' },
        include: { reviewer: { select: { email: true, name: true } } },
      },
      approvedJournal: { select: { id: true, slug: true, status: true, titleTr: true } },
    },
  })

  if (!content?.journalApplication) {
    throw new Error('Journal application not found')
  }

  const journal = content.journalApplication
  const duplicatePrecheck = await runJournalDuplicatePrecheck({
    excludeJournalApplicationId: journal.id,
    excludeContentApplicationId: content.id,
    nameTr: journal.nameTr ?? '',
    nameEn: journal.nameEn,
    pIssn: journal.pIssn,
    eIssn: journal.eIssn,
    publisherInstitutionId: parsePublisherInstitutionId(
      journal.publisherInstitutionId?.toString() ?? null,
    ),
    proposedInstitutionName: journal.proposedInstitutionName,
    publishingPlatform: journal.publishingPlatform,
    websiteUrl: journal.websiteUrl,
    officialJournalUrl: journal.officialJournalUrl,
    platformProfileUrl: journal.platformProfileUrl,
  })

  return {
    contentApplication: {
      id: content.id,
      kind: content.kind,
      status: content.status,
      statusLabel: CONTENT_STATUS_LABELS[content.status],
      title: content.title,
      submittedAt: content.submittedAt?.toISOString() ?? null,
      approvedAt: content.approvedAt?.toISOString() ?? null,
      assignedTo: content.assignedTo,
      approvedJournalId: content.approvedJournalId?.toString() ?? null,
      createdAt: content.createdAt.toISOString(),
      updatedAt: content.updatedAt.toISOString(),
    },
    applicant: {
      id: content.user.id,
      email: content.user.email,
      name: content.user.name,
    },
    assignee: content.assignee
      ? { id: content.assignee.id, email: content.assignee.email, name: content.assignee.name }
      : null,
    journalApplication: serializeJournalApplication(journal),
    privateContact: serializePrivateContact(content.privateContact),
    issnValidation: issnValidationStatus(journal),
    duplicateFlags: journal.duplicateFlags,
    duplicatePrecheck,
    attachments: content.attachments.map(serializeAttachment),
    revisions: content.revisions.map((r) => ({
      id: r.id,
      revisionNumber: r.revisionNumber,
      submissionType: r.submissionType,
      createdAt: r.createdAt.toISOString(),
      creator: r.creator,
      snapshotJson: r.snapshotJson,
    })),
    events: content.events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      actorId: e.actorId,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString(),
    })),
    reviews: content.reviews.map((r) => ({
      id: r.id,
      decision: r.decision,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      reviewer: r.reviewer,
    })),
    approvedJournal: content.approvedJournal
      ? {
          id: content.approvedJournal.id.toString(),
          slug: content.approvedJournal.slug,
          status: content.approvedJournal.status,
          titleTr: content.approvedJournal.titleTr,
        }
      : null,
  }
}

async function transitionStatus(input: {
  contentApplicationId: string
  reviewerId: string
  fromStatuses: ContentApplicationStatus[]
  toStatus: ContentApplicationStatus
  eventType: string
  decision?: string
  note?: string | null
  assignedTo?: string | null
  notificationType?: string
  applicantEmail: string
  title: string
}) {
  const content = await prisma.contentApplication.findFirst({
    where: { id: input.contentApplicationId, kind: 'new_journal' },
    select: { id: true, status: true, title: true, user: { select: { email: true } } },
  })

  if (!content) throw new Error('Journal application not found')
  if (!input.fromStatuses.includes(content.status)) {
    throw new Error('Invalid status transition')
  }

  await prisma.$transaction(async (tx) => {
    await tx.contentApplication.update({
      where: { id: content.id },
      data: {
        status: input.toStatus,
        assignedTo: input.assignedTo !== undefined ? input.assignedTo : undefined,
      },
    })

    if (input.decision) {
      await tx.applicationReview.create({
        data: {
          applicationId: content.id,
          reviewerId: input.reviewerId,
          decision: input.decision,
          note: input.note?.trim() || null,
        },
      })
    }

    await tx.applicationEvent.create({
      data: {
        applicationId: content.id,
        eventType: input.eventType,
        actorId: input.reviewerId,
        fromStatus: content.status,
        toStatus: input.toStatus,
        metadata: input.note ? { note: input.note } : undefined,
      },
    })

    if (input.notificationType) {
      await enqueueNotification(tx, {
        type: input.notificationType,
        recipient: input.applicantEmail,
        payload: {
          contentApplicationId: content.id,
          title: input.title,
          note: input.note ?? null,
        },
      })
    }
  })

  await writeAuditLog({
    actorId: input.reviewerId,
    action: `content_application.${input.eventType}`,
    entityType: 'content_application',
    entityId: content.id,
    oldValues: { status: content.status },
    newValues: { status: input.toStatus, assignedTo: input.assignedTo ?? undefined },
  })

  return getJournalApplicationForAdmin(content.id)
}

export async function reviewJournalApplication(input: {
  contentApplicationId: string
  reviewerId: string
  action: AdminJournalReviewAction
  note?: string | null
  assignedTo?: string | null
}) {
  const loaded = await prisma.contentApplication.findFirst({
    where: { id: input.contentApplicationId, kind: 'new_journal' },
    include: { user: { select: { email: true } } },
  })
  if (!loaded) throw new Error('Journal application not found')

  switch (input.action) {
    case 'precheck':
      return transitionStatus({
        contentApplicationId: input.contentApplicationId,
        reviewerId: input.reviewerId,
        fromStatuses: ['submitted'],
        toStatus: 'precheck',
        eventType: 'precheck',
        applicantEmail: loaded.user.email,
        title: loaded.title,
      })

    case 'under_review':
      return transitionStatus({
        contentApplicationId: input.contentApplicationId,
        reviewerId: input.reviewerId,
        fromStatuses: ['submitted', 'precheck', 'under_review'],
        toStatus: 'under_review',
        eventType: 'under_review',
        assignedTo: input.assignedTo ?? input.reviewerId,
        applicantEmail: loaded.user.email,
        title: loaded.title,
      })

    case 'request_revision': {
      if (!input.note?.trim()) throw new Error('Revision note is required')
      return transitionStatus({
        contentApplicationId: input.contentApplicationId,
        reviewerId: input.reviewerId,
        fromStatuses: ['submitted', 'precheck', 'under_review'],
        toStatus: 'revision_requested',
        eventType: 'revision_requested',
        decision: 'revision_requested',
        note: input.note,
        notificationType: 'journal_application.revision_requested',
        applicantEmail: loaded.user.email,
        title: loaded.title,
      })
    }

    case 'reject': {
      if (!input.note?.trim()) throw new Error('Rejection note is required')
      return transitionStatus({
        contentApplicationId: input.contentApplicationId,
        reviewerId: input.reviewerId,
        fromStatuses: ['submitted', 'precheck', 'under_review', 'revision_requested'],
        toStatus: 'rejected',
        eventType: 'rejected',
        decision: 'rejected',
        note: input.note,
        notificationType: 'journal_application.rejected',
        applicantEmail: loaded.user.email,
        title: loaded.title,
      })
    }

    case 'approve': {
      await approveJournalApplication({
        contentApplicationId: input.contentApplicationId,
        reviewerId: input.reviewerId,
        note: input.note,
      })
      return getJournalApplicationForAdmin(input.contentApplicationId)
    }

    default:
      throw new Error('Unknown action')
  }
}

export { REVIEWABLE_STATUSES }
