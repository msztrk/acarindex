import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { ForbiddenError } from '@/lib/auth/forbidden'
import { EDITABLE_CONTENT_STATUSES } from '@/lib/applications/types'
import { submitContentApplication } from '@/lib/applications/service'
import {
  buildDeclarationAcceptanceRecord,
  type DeclarationAcceptanceInput,
} from '@/lib/journal-applications/declarations'
import {
  declarationRecordFromDb,
  parsePublisherInstitutionId,
  parseSubjectAreasFromApi,
  serializeJournalApplication,
  serializePrivateContact,
} from '@/lib/journal-applications/serialize'
import type { SubjectAreaInput } from '@/lib/journal-applications/subject-areas'
import type { JournalApplicationDraftInput } from '@/lib/journal-applications/types'
import { validateJournalApplicationForSubmit } from '@/lib/journal-applications/validate-for-submit'
import { runJournalDuplicatePrecheck } from '@/lib/journal-applications/run-duplicate-precheck'
import { recordApplicationEvent } from '@/lib/applications/events'

export type SaveJournalApplicationDraftInput = {
  contentApplicationId: string
  userId: string
  journal?: JournalApplicationDraftInput
  subjectAreas?: SubjectAreaInput[]
  declarationAcceptance?: DeclarationAcceptanceInput
  privateContact?: {
    contactName?: string | null
    contactRole?: string | null
    contactEmail?: string | null
    workPhone?: string | null
    mobilePhone?: string | null
  }
  duplicateContinueReason?: string | null
}

const journalInclude = {
  subjectAreas: { include: { category: { select: { id: true, nameTr: true, nameEn: true } } } },
  declarationAcceptance: true,
  publisherInstitution: { select: { id: true, nameTr: true } },
} as const

async function assertEditableJournalApplication(contentApplicationId: string, userId: string) {
  const content = await prisma.contentApplication.findFirst({
    where: { id: contentApplicationId, userId, kind: 'new_journal' },
    include: { journalApplication: true },
  })
  if (!content) throw new ForbiddenError()
  if (!EDITABLE_CONTENT_STATUSES.includes(content.status)) {
    throw new Error('Application not editable in current status')
  }
  if (!content.journalApplication) {
    throw new Error('Journal application record missing')
  }
  return content
}

export async function createJournalApplicationDraft(userId: string) {
  const row = await prisma.$transaction(async (tx) => {
    const content = await tx.contentApplication.create({
      data: {
        userId,
        kind: 'new_journal',
        title: 'Yeni dergi başvurusu',
        status: 'draft',
      },
    })

    const journal = await tx.journalApplication.create({
      data: { contentApplicationId: content.id },
    })

    await recordApplicationEvent({
      applicationId: content.id,
      eventType: 'draft_created',
      actorId: userId,
      toStatus: 'draft',
      metadata: { kind: 'new_journal', journalApplicationId: journal.id },
    })

    return { content, journal }
  })

  return {
    contentApplicationId: row.content.id,
    journalApplicationId: row.journal.id,
  }
}

export async function getJournalApplicationForUser(contentApplicationId: string, userId: string) {
  const content = await prisma.contentApplication.findFirst({
    where: { id: contentApplicationId, userId, kind: 'new_journal' },
    include: {
      journalApplication: { include: journalInclude },
      privateContact: true,
    },
  })
  if (!content?.journalApplication) throw new ForbiddenError()

  return {
    contentApplication: {
      id: content.id,
      status: content.status,
      title: content.title,
      submittedAt: content.submittedAt,
      updatedAt: content.updatedAt,
    },
    journalApplication: serializeJournalApplication(content.journalApplication),
    privateContact: serializePrivateContact(content.privateContact),
  }
}

function journalDraftData(journal: JournalApplicationDraftInput): Prisma.JournalApplicationUncheckedUpdateInput {
  return {
    nameTr: journal.nameTr?.trim() || null,
    nameEn: journal.nameEn?.trim() || null,
    abbreviation: journal.abbreviation?.trim() || null,
    publisherInstitutionId: journal.publisherInstitutionId ?? null,
    proposedInstitutionName: journal.proposedInstitutionName?.trim() || null,
    journalType: journal.journalType?.trim() || null,
    publishingPlatform: journal.publishingPlatform?.trim() || null,
    websiteUrl: journal.websiteUrl?.trim() || null,
    pIssn: journal.pIssn?.trim() || null,
    eIssn: journal.eIssn?.trim() || null,
    firstPublicationYear: journal.firstPublicationYear ?? null,
    publicationFrequency: journal.publicationFrequency ?? null,
    publicationMonths: journal.publicationMonths ?? [],
    correspondenceAddress: journal.correspondenceAddress?.trim() || null,
    editorName: journal.editorName?.trim() || null,
    editorTitle: journal.editorTitle?.trim() || null,
    editorEmail: journal.editorEmail?.trim() || null,
    editorOrcid: journal.editorOrcid?.trim() || null,
    editorProfileUrl: journal.editorProfileUrl?.trim() || null,
    officialJournalUrl: journal.officialJournalUrl?.trim() || null,
    editorialBoardUrl: journal.editorialBoardUrl?.trim() || null,
    latestIssueUrl: journal.latestIssueUrl?.trim() || null,
    platformProfileUrl: journal.platformProfileUrl?.trim() || null,
    publisherPageUrl: journal.publisherPageUrl?.trim() || null,
    keywords: journal.keywords ?? [],
  }
}

export async function saveJournalApplicationDraft(input: SaveJournalApplicationDraftInput) {
  const content = await assertEditableJournalApplication(input.contentApplicationId, input.userId)
  const journalId = content.journalApplication!.id

  await prisma.$transaction(async (tx) => {
    if (input.journal) {
      await tx.journalApplication.update({
        where: { id: journalId },
        data: {
          ...journalDraftData(input.journal),
          duplicateContinueReason:
            input.duplicateContinueReason !== undefined
              ? input.duplicateContinueReason?.trim() || null
              : undefined,
        },
      })

      const title = input.journal.nameTr?.trim()
      if (title) {
        await tx.contentApplication.update({
          where: { id: input.contentApplicationId },
          data: { title },
        })
      }
    } else if (input.duplicateContinueReason !== undefined) {
      await tx.journalApplication.update({
        where: { id: journalId },
        data: { duplicateContinueReason: input.duplicateContinueReason?.trim() || null },
      })
    }

    if (input.subjectAreas) {
      await tx.journalApplicationSubjectArea.deleteMany({ where: { journalApplicationId: journalId } })
      if (input.subjectAreas.length > 0) {
        await tx.journalApplicationSubjectArea.createMany({
          data: input.subjectAreas.map((area) => ({
            journalApplicationId: journalId,
            categoryId: area.categoryId,
            level: area.level,
          })),
        })
      }
    }

    if (input.declarationAcceptance) {
      const record = buildDeclarationAcceptanceRecord(input.declarationAcceptance)
      await tx.applicationDeclarationAcceptance.upsert({
        where: { journalApplicationId: journalId },
        create: {
          journalApplicationId: journalId,
          ...record,
        },
        update: record,
      })
    }

    if (input.privateContact) {
      await tx.applicationPrivateContact.upsert({
        where: { applicationId: input.contentApplicationId },
        create: {
          applicationId: input.contentApplicationId,
          contactName: input.privateContact.contactName ?? null,
          contactRole: input.privateContact.contactRole ?? null,
          contactEmail: input.privateContact.contactEmail ?? null,
          workPhone: input.privateContact.workPhone ?? null,
          mobilePhone: input.privateContact.mobilePhone ?? null,
        },
        update: {
          contactName: input.privateContact.contactName ?? null,
          contactRole: input.privateContact.contactRole ?? null,
          contactEmail: input.privateContact.contactEmail ?? null,
          workPhone: input.privateContact.workPhone ?? null,
          mobilePhone: input.privateContact.mobilePhone ?? null,
        },
      })
    }
  })

  return getJournalApplicationForUser(input.contentApplicationId, input.userId)
}

export async function runJournalApplicationPrecheck(contentApplicationId: string, userId: string) {
  const loaded = await getJournalApplicationForUser(contentApplicationId, userId)
  const journal = loaded.journalApplication

  const precheck = await runJournalDuplicatePrecheck({
    excludeJournalApplicationId: journal.id,
    excludeContentApplicationId: contentApplicationId,
    nameTr: journal.nameTr ?? '',
    nameEn: journal.nameEn,
    pIssn: journal.pIssn,
    eIssn: journal.eIssn,
    publisherInstitutionId: parsePublisherInstitutionId(journal.publisherInstitutionId),
    proposedInstitutionName: journal.proposedInstitutionName,
    publishingPlatform: journal.publishingPlatform,
    websiteUrl: journal.websiteUrl,
    officialJournalUrl: journal.officialJournalUrl,
    platformProfileUrl: journal.platformProfileUrl,
  })

  await prisma.journalApplication.update({
    where: { id: journal.id },
    data: { duplicateFlags: precheck.flags as unknown as Prisma.InputJsonValue },
  })

  return precheck
}

export async function submitJournalApplication(contentApplicationId: string, userId: string) {
  const loaded = await getJournalApplicationForUser(contentApplicationId, userId)
  const journal = loaded.journalApplication

  const validation = await validateJournalApplicationForSubmit({
    nameTr: journal.nameTr,
    nameEn: journal.nameEn,
    abbreviation: journal.abbreviation,
    publisherInstitutionId: parsePublisherInstitutionId(journal.publisherInstitutionId),
    proposedInstitutionName: journal.proposedInstitutionName,
    journalType: journal.journalType,
    publishingPlatform: journal.publishingPlatform,
    websiteUrl: journal.websiteUrl,
    pIssn: journal.pIssn,
    eIssn: journal.eIssn,
    firstPublicationYear: journal.firstPublicationYear,
    publicationFrequency: journal.publicationFrequency as JournalApplicationDraftInput['publicationFrequency'],
    publicationMonths: journal.publicationMonths,
    correspondenceAddress: journal.correspondenceAddress,
    editorName: journal.editorName,
    editorTitle: journal.editorTitle,
    editorEmail: journal.editorEmail,
    editorOrcid: journal.editorOrcid,
    editorProfileUrl: journal.editorProfileUrl,
    officialJournalUrl: journal.officialJournalUrl,
    editorialBoardUrl: journal.editorialBoardUrl,
    latestIssueUrl: journal.latestIssueUrl,
    platformProfileUrl: journal.platformProfileUrl,
    publisherPageUrl: journal.publisherPageUrl,
    keywords: journal.keywords,
    subjectAreas: parseSubjectAreasFromApi(
      journal.subjectAreas.map((a) => ({ categoryId: a.categoryId, level: a.level })),
    ),
    declarationAcceptance: journal.declarationAcceptance,
    duplicateContinueReason: journal.duplicateContinueReason,
    excludeJournalApplicationId: journal.id,
    excludeContentApplicationId: contentApplicationId,
  })

  if (!validation.ok) {
    return { ok: false as const, errors: validation.errors }
  }

  const normalized = validation.normalized

  await prisma.journalApplication.update({
    where: { id: journal.id },
    data: {
      nameTr: normalized.nameTr,
      nameEn: normalized.nameEn,
      abbreviation: normalized.abbreviation,
      publisherInstitutionId: normalized.publisherInstitutionId,
      proposedInstitutionName: normalized.proposedInstitutionName,
      journalType: normalized.journalType,
      publishingPlatform: normalized.publishingPlatform,
      websiteUrl: normalized.websiteUrl,
      pIssn: normalized.pIssn,
      eIssn: normalized.eIssn,
      pIssnNormalized: normalized.pIssnNormalized,
      eIssnNormalized: normalized.eIssnNormalized,
      firstPublicationYear: normalized.firstPublicationYear,
      publicationFrequency: normalized.publicationFrequency,
      publicationMonths: normalized.publicationMonths,
      correspondenceAddress: normalized.correspondenceAddress,
      editorName: normalized.editorName,
      editorTitle: normalized.editorTitle,
      editorEmail: normalized.editorEmail,
      editorOrcid: normalized.editorOrcid,
      editorProfileUrl: normalized.editorProfileUrl,
      officialJournalUrl: normalized.officialJournalUrl,
      editorialBoardUrl: normalized.editorialBoardUrl,
      latestIssueUrl: normalized.latestIssueUrl,
      platformProfileUrl: normalized.platformProfileUrl,
      publisherPageUrl: normalized.publisherPageUrl,
      keywords: normalized.keywords,
      duplicateFlags: normalized.duplicateFlags as unknown as Prisma.InputJsonValue,
      duplicateContinueReason: normalized.duplicateContinueReason,
    },
  })

  if (normalized.subjectAreas.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.journalApplicationSubjectArea.deleteMany({ where: { journalApplicationId: journal.id } })
      await tx.journalApplicationSubjectArea.createMany({
        data: normalized.subjectAreas.map((area) => ({
          journalApplicationId: journal.id,
          categoryId: area.categoryId,
          level: area.level,
        })),
      })
    })
  }

  const declaration = buildDeclarationAcceptanceRecord({
    criteriaAcceptedAt: normalized.declarationAcceptance.criteriaAcceptedAt,
    standardsAcceptedAt: normalized.declarationAcceptance.standardsAcceptedAt,
    privacyNoticeAcceptedAt: normalized.declarationAcceptance.privacyNoticeAcceptedAt,
    imageRightsAcceptedAt: normalized.declarationAcceptance.imageRightsAcceptedAt,
    informationAccuracyConfirmedAt: normalized.declarationAcceptance.informationAccuracyConfirmedAt,
  })

  await prisma.applicationDeclarationAcceptance.upsert({
    where: { journalApplicationId: journal.id },
    create: { journalApplicationId: journal.id, ...declaration },
    update: declaration,
  })

  const submitted = await submitContentApplication({
    applicationId: contentApplicationId,
    userId,
  })

  return { ok: true as const, application: submitted }
}

export async function searchInstitutions(query: string, limit = 10) {
  const q = query.trim()
  if (q.length < 2) return []

  const rows = await prisma.institution.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      OR: [
        { nameTr: { contains: q, mode: 'insensitive' } },
        { nameEn: { contains: q, mode: 'insensitive' } },
      ],
    },
    orderBy: { nameTr: 'asc' },
    take: limit,
    select: { id: true, nameTr: true, nameEn: true },
  })

  return rows.map((row) => ({
    id: row.id.toString(),
    nameTr: row.nameTr,
    nameEn: row.nameEn,
  }))
}

export { declarationRecordFromDb, parseSubjectAreasFromApi, parsePublisherInstitutionId }
