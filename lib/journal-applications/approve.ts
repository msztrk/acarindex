import type { ContentApplicationStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/auth/audit'
import { enqueueNotification } from '@/lib/notifications/outbox'
import { formatIssn } from '@/lib/validation/issn'
import { runJournalDuplicatePrecheck } from '@/lib/journal-applications/run-duplicate-precheck'
import { generateUniqueJournalSlug } from '@/lib/journal-applications/generate-slug'
import { parsePublisherInstitutionId } from '@/lib/journal-applications/serialize'

const APPROVABLE_STATUSES: ContentApplicationStatus[] = [
  'submitted',
  'precheck',
  'under_review',
]

export type ApproveJournalApplicationInput = {
  contentApplicationId: string
  reviewerId: string
  note?: string | null
}

export type ApproveJournalApplicationResult = {
  contentApplicationId: string
  journalId: string
  journalSlug: string
  idempotent: boolean
}

function resolveLegacyLink(journal: {
  websiteUrl: string | null
  publishingPlatform: string | null
  platformProfileUrl: string | null
  officialJournalUrl: string | null
}): string | null {
  return (
    journal.websiteUrl?.trim() ||
    journal.platformProfileUrl?.trim() ||
    journal.officialJournalUrl?.trim() ||
    journal.publishingPlatform?.trim() ||
    null
  )
}

function resolvePublisher(journal: {
  proposedInstitutionName: string | null
  publisherInstitution?: { nameTr: string | null } | null
}): string | null {
  return journal.publisherInstitution?.nameTr ?? journal.proposedInstitutionName ?? null
}

export async function approveJournalApplication(
  input: ApproveJournalApplicationInput,
): Promise<ApproveJournalApplicationResult> {
  const content = await prisma.contentApplication.findFirst({
    where: { id: input.contentApplicationId, kind: 'new_journal' },
    include: {
      user: { select: { email: true } },
      journalApplication: {
        include: {
          subjectAreas: { where: { level: 'primary' }, orderBy: { createdAt: 'asc' }, take: 1 },
          publisherInstitution: { select: { nameTr: true } },
        },
      },
    },
  })

  if (!content?.journalApplication) {
    throw new Error('Journal application not found')
  }

  if (content.status === 'approved' && content.approvedJournalId) {
    const existing = await prisma.journal.findUnique({
      where: { id: content.approvedJournalId },
      select: { id: true, slug: true },
    })
    if (existing) {
      return {
        contentApplicationId: content.id,
        journalId: existing.id.toString(),
        journalSlug: existing.slug,
        idempotent: true,
      }
    }
  }

  if (!APPROVABLE_STATUSES.includes(content.status)) {
    throw new Error('Application cannot be approved in current status')
  }

  const journalApp = content.journalApplication
  if (!journalApp.nameTr?.trim()) {
    throw new Error('Journal name is required for approval')
  }

  const precheck = await runJournalDuplicatePrecheck({
    excludeJournalApplicationId: journalApp.id,
    excludeContentApplicationId: content.id,
    nameTr: journalApp.nameTr,
    nameEn: journalApp.nameEn,
    pIssn: journalApp.pIssn,
    eIssn: journalApp.eIssn,
    publisherInstitutionId: parsePublisherInstitutionId(
      journalApp.publisherInstitutionId?.toString() ?? null,
    ),
    proposedInstitutionName: journalApp.proposedInstitutionName,
    publishingPlatform: journalApp.publishingPlatform,
    websiteUrl: journalApp.websiteUrl,
    officialJournalUrl: journalApp.officialJournalUrl,
    platformProfileUrl: journalApp.platformProfileUrl,
  })

  if (precheck.hasExact) {
    throw new Error('Exact duplicate match blocks approval')
  }

  await prisma.journalApplication.update({
    where: { id: journalApp.id },
    data: { duplicateFlags: precheck.flags as unknown as Prisma.InputJsonValue },
  })

  const now = new Date()
  const pIssnFormatted =
    journalApp.pIssnNormalized != null
      ? formatIssn(journalApp.pIssnNormalized)
      : journalApp.pIssn
  const eIssnFormatted =
    journalApp.eIssnNormalized != null
      ? formatIssn(journalApp.eIssnNormalized)
      : journalApp.eIssn
  const primaryCategoryId = journalApp.subjectAreas[0]?.categoryId ?? null

  const result = await prisma.$transaction(async (tx) => {
    const slug = await generateUniqueJournalSlug(tx, journalApp.nameTr!)

    const createdJournal = await tx.journal.create({
      data: {
        slug,
        titleTr: journalApp.nameTr,
        titleEn: journalApp.nameEn,
        issn: pIssnFormatted,
        eissn: eIssnFormatted,
        publisher: resolvePublisher(journalApp),
        startYear: journalApp.firstPublicationYear?.toString() ?? null,
        legacyLink: resolveLegacyLink(journalApp),
        editorInChief: journalApp.editorName,
        categoryId: primaryCategoryId,
        status: 'draft',
      },
    })

    const updated = await tx.contentApplication.update({
      where: { id: content.id },
      data: {
        status: 'approved',
        approvedAt: now,
        approvedJournalId: createdJournal.id,
      },
    })

    await tx.applicationReview.create({
      data: {
        applicationId: content.id,
        reviewerId: input.reviewerId,
        decision: 'approved',
        note: input.note?.trim() || null,
      },
    })

    await tx.applicationEvent.create({
      data: {
        applicationId: content.id,
        eventType: 'approved',
        actorId: input.reviewerId,
        fromStatus: content.status,
        toStatus: 'approved',
        metadata: {
          journalId: createdJournal.id.toString(),
          journalSlug: createdJournal.slug,
          duplicatePrecheck: {
            hasExact: precheck.hasExact,
            flagCount: precheck.flags.length,
          },
        },
      },
    })

    await enqueueNotification(tx, {
      type: 'journal_application.approved',
      recipient: content.user.email,
      payload: {
        contentApplicationId: content.id,
        title: content.title,
        journalId: createdJournal.id.toString(),
        journalSlug: createdJournal.slug,
      },
    })

    return { createdJournal, updated }
  })

  await writeAuditLog({
    actorId: input.reviewerId,
    action: 'content_application.approved',
    entityType: 'content_application',
    entityId: content.id,
    oldValues: { status: content.status },
    newValues: {
      status: 'approved',
      journalId: result.createdJournal.id.toString(),
      journalSlug: result.createdJournal.slug,
    },
  })

  return {
    contentApplicationId: content.id,
    journalId: result.createdJournal.id.toString(),
    journalSlug: result.createdJournal.slug,
    idempotent: false,
  }
}
