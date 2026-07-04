import type { PublicationFrequency } from '@prisma/client'
import {
  validateFirstPublicationYear,
  validatePublicationSchedule,
} from '@/lib/journal-applications/publication-schedule'
import {
  validateJournalKeywords,
  validateJournalSubjectAreas,
  type SubjectAreaInput,
} from '@/lib/journal-applications/subject-areas'
import { isDeclarationCompleteForSubmit, type DeclarationAcceptanceRecord } from '@/lib/journal-applications/declarations'
import { validateIssnPair } from '@/lib/validation/issn'
import type { JournalApplicationDraftInput } from '@/lib/journal-applications/types'

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export type StepValidationIssue = { field: string; message: string }

export type PrivateContactDraft = {
  contactName?: string | null
  contactRole?: string | null
  contactEmail?: string | null
  workPhone?: string | null
  mobilePhone?: string | null
}

export type WizardFormState = JournalApplicationDraftInput & {
  subjectAreas: SubjectAreaInput[]
  declarationAcceptance: DeclarationAcceptanceRecord | null
  privateContact: PrivateContactDraft
  duplicateContinueReason?: string | null
}

export const WIZARD_STEP_TITLES: Record<WizardStep, string> = {
  1: 'Dergi kimlik bilgileri',
  2: 'ISSN ve yayın geçmişi',
  3: 'Kurum ve yayın platformu',
  4: 'Yayın sıklığı ve ayları',
  5: 'Bilim alanları ve anahtar kelimeler',
  6: 'Editör bilgileri',
  7: 'İletişim bilgileri',
  8: 'Resmî bağlantılar',
  9: 'Kapak ve belgeler',
  10: 'Beyanlar ve önizleme',
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

export function validateWizardStep(step: WizardStep, form: WizardFormState): StepValidationIssue[] {
  const issues: StepValidationIssue[] = []

  switch (step) {
    case 1:
      if (!hasText(form.nameTr)) {
        issues.push({ field: 'nameTr', message: 'Dergi adı (Türkçe) zorunludur.' })
      }
      break
    case 2: {
      const issn = validateIssnPair(form.pIssn, form.eIssn)
      if (!issn.ok) {
        issues.push({ field: 'issn', message: issn.error })
      }
      const year = validateFirstPublicationYear(form.firstPublicationYear)
      if (!year.ok) {
        issues.push({ field: 'firstPublicationYear', message: year.error })
      }
      break
    }
    case 3:
      if (form.publisherInstitutionId == null && !hasText(form.proposedInstitutionName)) {
        issues.push({
          field: 'publisher',
          message: 'Yayıncı kurum seçin veya önerilen kurum adı yazın.',
        })
      }
      break
    case 4: {
      const schedule = validatePublicationSchedule(
        form.publicationFrequency as PublicationFrequency | null | undefined,
        form.publicationMonths ?? [],
      )
      if (!schedule.ok) {
        issues.push({ field: 'publicationSchedule', message: schedule.error })
      }
      break
    }
    case 5: {
      const keywords = validateJournalKeywords(form.keywords ?? [])
      if (!keywords.ok) {
        issues.push({ field: 'keywords', message: keywords.error })
      }
      const areas = validateJournalSubjectAreas(form.subjectAreas ?? [])
      if (!areas.ok) {
        issues.push({ field: 'subjectAreas', message: areas.error })
      }
      break
    }
    case 6:
      if (!hasText(form.editorName)) {
        issues.push({ field: 'editorName', message: 'Editör adı önerilir.' })
      }
      if (!hasText(form.editorEmail)) {
        issues.push({ field: 'editorEmail', message: 'Editör e-postası önerilir.' })
      }
      break
    case 7:
      if (!hasText(form.privateContact.contactName)) {
        issues.push({ field: 'contactName', message: 'İletişim kişisi adı zorunludur.' })
      }
      if (!hasText(form.privateContact.contactEmail)) {
        issues.push({ field: 'contactEmail', message: 'İletişim e-postası zorunludur.' })
      }
      break
    case 8:
      break
    case 9:
      break
    case 10:
      if (!form.declarationAcceptance || !isDeclarationCompleteForSubmit(form.declarationAcceptance)) {
        issues.push({
          field: 'declarationAcceptance',
          message: 'Gönderim için tüm beyanlar kabul edilmelidir.',
        })
      }
      break
  }

  return issues
}

export function validateAllWizardSteps(form: WizardFormState): Record<WizardStep, StepValidationIssue[]> {
  const out = {} as Record<WizardStep, StepValidationIssue[]>
  for (let step = 1; step <= 10; step++) {
    out[step as WizardStep] = validateWizardStep(step as WizardStep, form)
  }
  return out
}
