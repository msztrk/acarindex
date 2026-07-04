import { normalizeExternalUrl, normalizePlatformUrlKey } from '@/lib/validation/url'
import {
  isStrongNameSimilarity,
  isWeakNameSimilarity,
  journalNameSimilarity,
  publisherSimilarity,
} from '@/lib/journal-applications/text-similarity'

export type DuplicateMatchLevel = 'exact' | 'strong' | 'weak'

export type DuplicateFlagSource = 'catalog_journal' | 'pending_application'

export type DuplicateMatchedField =
  | 'p_issn'
  | 'e_issn'
  | 'platform_url'
  | 'name'
  | 'domain'
  | 'publisher'

export type DuplicateFlag = {
  matchLevel: DuplicateMatchLevel
  canContinue: boolean
  source: DuplicateFlagSource
  reason: string
  matchedField: DuplicateMatchedField
  journalId?: string
  applicationId?: string
  contentApplicationId?: string
  displayName?: string
}

export type DuplicatePrecheckInput = {
  excludeJournalApplicationId?: string
  excludeContentApplicationId?: string
  nameTr: string
  nameEn?: string | null
  pIssnNormalized?: string | null
  eIssnNormalized?: string | null
  publisherInstitutionId?: bigint | null
  proposedInstitutionName?: string | null
  publishingPlatform?: string | null
  websiteUrl?: string | null
  officialJournalUrl?: string | null
  platformProfileUrl?: string | null
  websiteDomain?: string | null
  platformUrlKey?: string | null
}

export type CatalogJournalCandidate = {
  id: bigint
  titleTr: string | null
  titleEn: string | null
  issn: string | null
  eissn: string | null
  publisher: string | null
  legacyLink: string | null
  slug: string
}

export type PendingApplicationCandidate = {
  id: string
  contentApplicationId: string
  nameTr: string | null
  nameEn: string | null
  pIssnNormalized: string | null
  eIssnNormalized: string | null
  publisherInstitutionId: bigint | null
  proposedInstitutionName: string | null
  publishingPlatform: string | null
  websiteUrl: string | null
  officialJournalUrl: string | null
  platformProfileUrl: string | null
}

export type DuplicatePrecheckResult = {
  flags: DuplicateFlag[]
  hasExact: boolean
  hasStrongOrWeak: boolean
  canSubmit: boolean
  requiresContinueReason: boolean
}

function issnMatches(stored: string | null, normalized: string | null): boolean {
  if (!stored || !normalized) return false
  const digits = stored.replace(/[^0-9Xx]/g, '').toUpperCase()
  return digits === normalized
}

export function mergeDuplicateFlags(flags: DuplicateFlag[]): DuplicatePrecheckResult {
  const hasExact = flags.some((f) => f.matchLevel === 'exact')
  const hasStrongOrWeak = flags.some((f) => f.matchLevel === 'strong' || f.matchLevel === 'weak')
  return {
    flags,
    hasExact,
    hasStrongOrWeak,
    canSubmit: !hasExact,
    requiresContinueReason: hasStrongOrWeak && !hasExact,
  }
}

export function evaluateCatalogJournalDuplicate(
  input: DuplicatePrecheckInput,
  journal: CatalogJournalCandidate,
  platformUrlKey: string | null,
): DuplicateFlag[] {
  const flags: DuplicateFlag[] = []
  const displayName = journal.titleTr ?? journal.titleEn ?? journal.slug

  if (input.pIssnNormalized && issnMatches(journal.issn, input.pIssnNormalized)) {
    flags.push({
      matchLevel: 'exact',
      canContinue: false,
      source: 'catalog_journal',
      reason: 'P-ISSN katalogda kayıtlı bir dergi ile eşleşiyor.',
      matchedField: 'p_issn',
      journalId: journal.id.toString(),
      displayName,
    })
  }

  if (input.eIssnNormalized && issnMatches(journal.eissn, input.eIssnNormalized)) {
    flags.push({
      matchLevel: 'exact',
      canContinue: false,
      source: 'catalog_journal',
      reason: 'E-ISSN katalogda kayıtlı bir dergi ile eşleşiyor.',
      matchedField: 'e_issn',
      journalId: journal.id.toString(),
      displayName,
    })
  }

  if (platformUrlKey && journal.legacyLink) {
    const legacyKey = normalizePlatformUrlKey(journal.legacyLink)
    if (legacyKey && legacyKey === platformUrlKey) {
      flags.push({
        matchLevel: 'exact',
        canContinue: false,
        source: 'catalog_journal',
        reason: 'Platform URL katalogdaki dergi ile aynı.',
        matchedField: 'platform_url',
        journalId: journal.id.toString(),
        displayName,
      })
    }
  }

  const nameScore = Math.max(
    journalNameSimilarity(input.nameTr, journal.titleTr ?? ''),
    input.nameEn ? journalNameSimilarity(input.nameEn, journal.titleEn ?? '') : 0,
  )

  const sameDomain =
    input.websiteDomain &&
    journal.legacyLink &&
    (() => {
      const legacy = normalizeExternalUrl(journal.legacyLink)
      return legacy.ok && legacy.domain === input.websiteDomain
    })()

  const pubScore = publisherSimilarity(
    input.proposedInstitutionName ?? (input.publisherInstitutionId ? String(input.publisherInstitutionId) : null),
    journal.publisher,
  )

  if (isStrongNameSimilarity(nameScore) && sameDomain) {
    flags.push({
      matchLevel: 'strong',
      canContinue: true,
      source: 'catalog_journal',
      reason: 'Dergi adı ve alan adı katalog kaydı ile güçlü benzerlik gösteriyor.',
      matchedField: 'name',
      journalId: journal.id.toString(),
      displayName,
    })
  } else if (isStrongNameSimilarity(nameScore) && pubScore >= 0.8) {
    flags.push({
      matchLevel: 'strong',
      canContinue: true,
      source: 'catalog_journal',
      reason: 'Dergi adı ve yayıncı bilgisi katalog kaydı ile güçlü benzerlik gösteriyor.',
      matchedField: 'publisher',
      journalId: journal.id.toString(),
      displayName,
    })
  } else if (isWeakNameSimilarity(nameScore)) {
    flags.push({
      matchLevel: 'weak',
      canContinue: true,
      source: 'catalog_journal',
      reason: 'Dergi adı katalogdaki bir kayıt ile benzer.',
      matchedField: 'name',
      journalId: journal.id.toString(),
      displayName,
    })
  } else if (sameDomain) {
    flags.push({
      matchLevel: 'weak',
      canContinue: true,
      source: 'catalog_journal',
      reason: 'Alan adı katalogdaki bir dergi ile aynı.',
      matchedField: 'domain',
      journalId: journal.id.toString(),
      displayName,
    })
  } else if (pubScore >= 0.8) {
    flags.push({
      matchLevel: 'weak',
      canContinue: true,
      source: 'catalog_journal',
      reason: 'Yayıncı bilgisi katalogdaki bir dergi ile benzer.',
      matchedField: 'publisher',
      journalId: journal.id.toString(),
      displayName,
    })
  }

  return flags
}

export function evaluatePendingApplicationDuplicate(
  input: DuplicatePrecheckInput,
  pending: PendingApplicationCandidate,
  platformUrlKey: string | null,
): DuplicateFlag[] {
  const flags: DuplicateFlag[] = []
  const displayName = pending.nameTr ?? pending.nameEn ?? 'Başvuru'

  if (input.pIssnNormalized && pending.pIssnNormalized === input.pIssnNormalized) {
    flags.push({
      matchLevel: 'exact',
      canContinue: false,
      source: 'pending_application',
      reason: 'P-ISSN bekleyen bir başvuru ile eşleşiyor.',
      matchedField: 'p_issn',
      applicationId: pending.id,
      contentApplicationId: pending.contentApplicationId,
      displayName,
    })
  }

  if (input.eIssnNormalized && pending.eIssnNormalized === input.eIssnNormalized) {
    flags.push({
      matchLevel: 'exact',
      canContinue: false,
      source: 'pending_application',
      reason: 'E-ISSN bekleyen bir başvuru ile eşleşiyor.',
      matchedField: 'e_issn',
      applicationId: pending.id,
      contentApplicationId: pending.contentApplicationId,
      displayName,
    })
  }

  const pendingUrls = [pending.platformProfileUrl, pending.officialJournalUrl, pending.websiteUrl].filter(Boolean)
  if (platformUrlKey) {
    for (const url of pendingUrls) {
      const key = normalizePlatformUrlKey(url!)
      if (key && key === platformUrlKey) {
        flags.push({
          matchLevel: 'exact',
          canContinue: false,
          source: 'pending_application',
          reason: 'Platform URL bekleyen bir başvuru ile aynı.',
          matchedField: 'platform_url',
          applicationId: pending.id,
          contentApplicationId: pending.contentApplicationId,
          displayName,
        })
        break
      }
    }
  }

  return flags
}

export function dedupeDuplicateFlags(flags: DuplicateFlag[]): DuplicateFlag[] {
  const seen = new Set<string>()
  const out: DuplicateFlag[] = []
  for (const flag of flags) {
    const key = [
      flag.matchLevel,
      flag.source,
      flag.matchedField,
      flag.journalId ?? '',
      flag.applicationId ?? '',
    ].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(flag)
  }
  return out
}

export function summarizeDuplicatePrecheck(flags: DuplicateFlag[]): DuplicatePrecheckResult {
  return mergeDuplicateFlags(dedupeDuplicateFlags(flags))
}

export const DUPLICATE_CONTINUE_ALTERNATIVES = [
  { id: 'journal_editor', label: 'Dergi yetkilisi olma başvurusu', href: '/editor/basvuru' },
  { id: 'data_correction', label: 'Veri düzeltme başvurusu', href: '/hesabim/basvurular/yeni' },
  { id: 'manual_review', label: 'Manuel inceleme talebi', href: '/contact' },
] as const
