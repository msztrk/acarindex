import type { PublicationFrequency } from '@prisma/client'
import {
  isDeclarationCompleteForSubmit,
  type DeclarationAcceptanceRecord,
} from '@/lib/journal-applications/declarations'
import type { DuplicateFlag, DuplicatePrecheckResult } from '@/lib/journal-applications/duplicate-precheck'
import {
  validateFirstPublicationYear,
  validatePublicationSchedule,
} from '@/lib/journal-applications/publication-schedule'
import { runJournalDuplicatePrecheck } from '@/lib/journal-applications/run-duplicate-precheck'
import {
  type SubjectAreaInput,
  validateJournalKeywords,
  validateJournalSubjectAreas,
} from '@/lib/journal-applications/subject-areas'
import type { JournalApplicationDraftInput } from '@/lib/journal-applications/types'
import { formatIssn, validateIssnPair } from '@/lib/validation/issn'
import { normalizeExternalUrl, validateExternalUrlFields } from '@/lib/validation/url'

export type JournalApplicationSubmitError = {
  field: string
  error: string
}

export type JournalApplicationSubmitInput = JournalApplicationDraftInput & {
  subjectAreas: SubjectAreaInput[]
  declarationAcceptance: DeclarationAcceptanceRecord | null
  duplicateContinueReason?: string | null
  excludeJournalApplicationId?: string
  excludeContentApplicationId?: string
}

export type JournalApplicationSubmitNormalized = {
  nameTr: string
  nameEn: string | null
  abbreviation: string | null
  publisherInstitutionId: bigint | null
  proposedInstitutionName: string | null
  journalType: string | null
  publishingPlatform: string | null
  websiteUrl: string | null
  pIssn: string | null
  eIssn: string | null
  pIssnNormalized: string | null
  eIssnNormalized: string | null
  firstPublicationYear: number
  publicationFrequency: PublicationFrequency
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
  subjectAreas: SubjectAreaInput[]
  declarationAcceptance: DeclarationAcceptanceRecord
  duplicateFlags: DuplicateFlag[]
  duplicatePrecheck: DuplicatePrecheckResult
  duplicateContinueReason: string | null
}

export type JournalApplicationSubmitResult =
  | { ok: true; normalized: JournalApplicationSubmitNormalized }
  | { ok: false; errors: JournalApplicationSubmitError[] }

const EXTERNAL_URL_FIELDS = [
  'websiteUrl',
  'officialJournalUrl',
  'platformProfileUrl',
  'editorProfileUrl',
  'editorialBoardUrl',
  'latestIssueUrl',
  'publisherPageUrl',
] as const

function pushError(errors: JournalApplicationSubmitError[], field: string, error: string): void {
  errors.push({ field, error })
}

function normalizeOptionalUrl(value: string | null | undefined): string | null {
  if (value == null || value.trim() === '') return null
  const result = normalizeExternalUrl(value)
  return result.ok ? result.normalized : null
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export async function validateJournalApplicationForSubmit(
  input: JournalApplicationSubmitInput,
): Promise<JournalApplicationSubmitResult> {
  const errors: JournalApplicationSubmitError[] = []

  const nameTr = input.nameTr?.trim() ?? ''
  if (!nameTr) {
    pushError(errors, 'nameTr', 'Dergi adı (Türkçe) zorunludur.')
  }

  const hasPublisherInstitution = input.publisherInstitutionId != null
  const proposedInstitutionName = normalizeOptionalText(input.proposedInstitutionName)
  if (!hasPublisherInstitution && !proposedInstitutionName) {
    pushError(errors, 'publisher', 'Yayıncı kurum veya önerilen kurum adı zorunludur.')
  }

  const issnResult = validateIssnPair(input.pIssn, input.eIssn)
  if (!issnResult.ok) {
    pushError(errors, 'issn', issnResult.error)
  }

  const yearResult = validateFirstPublicationYear(input.firstPublicationYear)
  if (!yearResult.ok) {
    pushError(errors, 'firstPublicationYear', yearResult.error)
  }

  const scheduleResult = validatePublicationSchedule(
    input.publicationFrequency,
    input.publicationMonths ?? [],
  )
  if (!scheduleResult.ok) {
    pushError(errors, 'publicationSchedule', scheduleResult.error)
  }

  const keywordsResult = validateJournalKeywords(input.keywords ?? [])
  if (!keywordsResult.ok) {
    pushError(errors, 'keywords', keywordsResult.error)
  }

  const subjectAreasResult = validateJournalSubjectAreas(input.subjectAreas ?? [])
  if (!subjectAreasResult.ok) {
    pushError(errors, 'subjectAreas', subjectAreasResult.error)
  }

  if (!input.declarationAcceptance || !isDeclarationCompleteForSubmit(input.declarationAcceptance)) {
    pushError(errors, 'declarationAcceptance', 'Tüm beyan metinleri kabul edilmelidir.')
  }

  const urlFieldValues: Record<string, string | null | undefined> = {}
  for (const field of EXTERNAL_URL_FIELDS) {
    urlFieldValues[field] = input[field]
  }
  const urlResult = validateExternalUrlFields(urlFieldValues)
  if (!urlResult.ok) {
    pushError(errors, urlResult.field, urlResult.error)
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const issn = issnResult as Extract<typeof issnResult, { ok: true }>
  const year = yearResult as Extract<typeof yearResult, { ok: true }>
  const schedule = scheduleResult as Extract<typeof scheduleResult, { ok: true }>
  const keywords = keywordsResult as Extract<typeof keywordsResult, { ok: true }>
  const subjectAreas = subjectAreasResult as Extract<typeof subjectAreasResult, { ok: true }>

  const duplicatePrecheck = await runJournalDuplicatePrecheck({
    excludeJournalApplicationId: input.excludeJournalApplicationId,
    excludeContentApplicationId: input.excludeContentApplicationId,
    nameTr,
    nameEn: normalizeOptionalText(input.nameEn),
    pIssn: issn.pIssn ? formatIssn(issn.pIssn) : input.pIssn ?? null,
    eIssn: issn.eIssn ? formatIssn(issn.eIssn) : input.eIssn ?? null,
    publisherInstitutionId: input.publisherInstitutionId ?? null,
    proposedInstitutionName,
    publishingPlatform: normalizeOptionalText(input.publishingPlatform),
    websiteUrl: normalizeOptionalUrl(input.websiteUrl),
    officialJournalUrl: normalizeOptionalUrl(input.officialJournalUrl),
    platformProfileUrl: normalizeOptionalUrl(input.platformProfileUrl),
  })

  const duplicateContinueReason = normalizeOptionalText(input.duplicateContinueReason)

  if (!duplicatePrecheck.canSubmit) {
    pushError(
      errors,
      'duplicate',
      'Başvuru mevcut katalog veya bekleyen başvuru kaydı ile birebir eşleşiyor; gönderilemez.',
    )
  }

  if (duplicatePrecheck.requiresContinueReason && !duplicateContinueReason) {
    pushError(
      errors,
      'duplicateContinueReason',
      'Benzer kayıt tespit edildi; devam etmek için gerekçe yazılmalıdır.',
    )
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    normalized: {
      nameTr,
      nameEn: normalizeOptionalText(input.nameEn),
      abbreviation: normalizeOptionalText(input.abbreviation),
      publisherInstitutionId: input.publisherInstitutionId ?? null,
      proposedInstitutionName,
      journalType: normalizeOptionalText(input.journalType),
      publishingPlatform: normalizeOptionalText(input.publishingPlatform),
      websiteUrl: normalizeOptionalUrl(input.websiteUrl),
      pIssn: issn.pIssn ? formatIssn(issn.pIssn) : null,
      eIssn: issn.eIssn ? formatIssn(issn.eIssn) : null,
      pIssnNormalized: issn.pIssn,
      eIssnNormalized: issn.eIssn,
      firstPublicationYear: year.year,
      publicationFrequency: input.publicationFrequency!,
      publicationMonths: schedule.months,
      correspondenceAddress: normalizeOptionalText(input.correspondenceAddress),
      editorName: normalizeOptionalText(input.editorName),
      editorTitle: normalizeOptionalText(input.editorTitle),
      editorEmail: normalizeOptionalText(input.editorEmail),
      editorOrcid: normalizeOptionalText(input.editorOrcid),
      editorProfileUrl: normalizeOptionalUrl(input.editorProfileUrl),
      officialJournalUrl: normalizeOptionalUrl(input.officialJournalUrl),
      editorialBoardUrl: normalizeOptionalUrl(input.editorialBoardUrl),
      latestIssueUrl: normalizeOptionalUrl(input.latestIssueUrl),
      platformProfileUrl: normalizeOptionalUrl(input.platformProfileUrl),
      publisherPageUrl: normalizeOptionalUrl(input.publisherPageUrl),
      keywords: keywords.keywords,
      subjectAreas: subjectAreas.areas,
      declarationAcceptance: input.declarationAcceptance!,
      duplicateFlags: duplicatePrecheck.flags,
      duplicatePrecheck,
      duplicateContinueReason,
    },
  }
}
