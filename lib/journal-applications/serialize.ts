import type { ApplicationDeclarationAcceptance, ApplicationPrivateContact, JournalApplication, JournalApplicationSubjectArea } from '@prisma/client'
import type { DeclarationAcceptanceRecord } from '@/lib/journal-applications/declarations'
import type { SubjectAreaInput } from '@/lib/journal-applications/subject-areas'

type SubjectAreaWithCategory = JournalApplicationSubjectArea & {
  category?: { id: bigint; nameTr: string | null; nameEn: string | null } | null
}

export type SerializedJournalApplication = {
  id: string
  contentApplicationId: string
  nameTr: string | null
  nameEn: string | null
  abbreviation: string | null
  publisherInstitutionId: string | null
  publisherInstitutionName: string | null
  proposedInstitutionName: string | null
  journalType: string | null
  publishingPlatform: string | null
  websiteUrl: string | null
  pIssn: string | null
  eIssn: string | null
  firstPublicationYear: number | null
  publicationFrequency: string | null
  publicationMonths: number[]
  correspondenceAddress: string | null
  editorName: string | null
  editorTitle: string | null
  editorEmail: string | null
  editorOrcid: string | null
  editorProfileUrl: string | null
  officialJournalUrl: string | null
  editorialBoardUrl: string | null
  latestIssueUrl: string | null
  platformProfileUrl: string | null
  publisherPageUrl: string | null
  keywords: string[]
  duplicateFlags: unknown
  duplicateContinueReason: string | null
  subjectAreas: Array<{
    categoryId: string
    level: string
    categoryNameTr: string | null
    categoryNameEn: string | null
  }>
  declarationAcceptance: DeclarationAcceptanceRecord | null
}

export function declarationRecordFromDb(
  row: ApplicationDeclarationAcceptance | null | undefined,
): DeclarationAcceptanceRecord | null {
  if (!row) return null
  return {
    criteriaVersion: row.criteriaVersion,
    criteriaAcceptedAt: row.criteriaAcceptedAt,
    standardsVersion: row.standardsVersion,
    standardsAcceptedAt: row.standardsAcceptedAt,
    privacyNoticeVersion: row.privacyNoticeVersion,
    privacyNoticeAcceptedAt: row.privacyNoticeAcceptedAt,
    imageRightsVersion: row.imageRightsVersion,
    imageRightsAcceptedAt: row.imageRightsAcceptedAt,
    informationAccuracyVersion: row.informationAccuracyVersion,
    informationAccuracyConfirmedAt: row.informationAccuracyConfirmedAt,
  }
}

export function serializePrivateContact(row: ApplicationPrivateContact | null | undefined) {
  if (!row) {
    return {
      contactName: null,
      contactRole: null,
      contactEmail: null,
      workPhone: null,
      mobilePhone: null,
    }
  }
  return {
    contactName: row.contactName,
    contactRole: row.contactRole,
    contactEmail: row.contactEmail,
    workPhone: row.workPhone,
    mobilePhone: row.mobilePhone,
  }
}

export function serializeJournalApplication(
  journal: JournalApplication & {
    subjectAreas?: SubjectAreaWithCategory[]
    declarationAcceptance?: ApplicationDeclarationAcceptance | null
    publisherInstitution?: { id: bigint; nameTr: string } | null
  },
): SerializedJournalApplication {
  return {
    id: journal.id,
    contentApplicationId: journal.contentApplicationId,
    nameTr: journal.nameTr,
    nameEn: journal.nameEn,
    abbreviation: journal.abbreviation,
    publisherInstitutionId: journal.publisherInstitutionId?.toString() ?? null,
    publisherInstitutionName: journal.publisherInstitution?.nameTr ?? null,
    proposedInstitutionName: journal.proposedInstitutionName,
    journalType: journal.journalType,
    publishingPlatform: journal.publishingPlatform,
    websiteUrl: journal.websiteUrl,
    pIssn: journal.pIssn,
    eIssn: journal.eIssn,
    firstPublicationYear: journal.firstPublicationYear,
    publicationFrequency: journal.publicationFrequency,
    publicationMonths: journal.publicationMonths ?? [],
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
    keywords: journal.keywords ?? [],
    duplicateFlags: journal.duplicateFlags,
    duplicateContinueReason: journal.duplicateContinueReason,
    subjectAreas: (journal.subjectAreas ?? []).map((area) => ({
      categoryId: area.categoryId.toString(),
      level: area.level,
      categoryNameTr: area.category?.nameTr ?? null,
      categoryNameEn: area.category?.nameEn ?? null,
    })),
    declarationAcceptance: declarationRecordFromDb(journal.declarationAcceptance),
  }
}

export function parseSubjectAreasFromApi(
  raw: Array<{ categoryId: string | number; level: string }> | undefined,
): SubjectAreaInput[] {
  if (!raw?.length) return []
  return raw.map((item) => ({
    categoryId: BigInt(item.categoryId),
    level: item.level as SubjectAreaInput['level'],
  }))
}

export function parsePublisherInstitutionId(value: string | number | null | undefined): bigint | null {
  if (value == null || value === '') return null
  return BigInt(value)
}
