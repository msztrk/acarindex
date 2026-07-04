import type { PublicationFrequency } from '@prisma/client'

/** Taslak kayıt için tüm alanlar opsiyonel; submit kuralları Faz B2+. */
export type JournalApplicationDraftInput = {
  nameTr?: string | null
  nameEn?: string | null
  abbreviation?: string | null
  publisherInstitutionId?: bigint | null
  proposedInstitutionName?: string | null
  journalType?: string | null
  publishingPlatform?: string | null
  websiteUrl?: string | null
  pIssn?: string | null
  eIssn?: string | null
  firstPublicationYear?: number | null
  publicationFrequency?: PublicationFrequency | null
  publicationMonths?: number[]
  correspondenceAddress?: string | null
  editorName?: string | null
  editorTitle?: string | null
  editorEmail?: string | null
  editorOrcid?: string | null
  editorProfileUrl?: string | null
  officialJournalUrl?: string | null
  editorialBoardUrl?: string | null
  latestIssueUrl?: string | null
  platformProfileUrl?: string | null
  publisherPageUrl?: string | null
  keywords?: string[]
}

export const JOURNAL_APPLICATION_ROUTE = '/hesabim/basvurular/yeni-dergi'

export const PUBLICATION_FREQUENCY_LABELS: Record<PublicationFrequency, string> = {
  monthly: 'Aylık',
  bimonthly: 'İki ayda bir',
  quarterly: 'Üç ayda bir',
  four_monthly: 'Dört ayda bir',
  semiannual: 'Altı ayda bir',
  annual: 'Yıllık',
  continuous: 'Sürekli',
  irregular: 'Düzensiz',
}
