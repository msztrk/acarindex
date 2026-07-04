import { ContentApplicationStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { normalizeIssn } from '@/lib/validation/issn'
import { normalizeExternalUrl, normalizePlatformUrlKey } from '@/lib/validation/url'
import {
  type CatalogJournalCandidate,
  type DuplicateFlag,
  type DuplicatePrecheckInput,
  type DuplicatePrecheckResult,
  type PendingApplicationCandidate,
  dedupeDuplicateFlags,
  evaluateCatalogJournalDuplicate,
  evaluatePendingApplicationDuplicate,
  summarizeDuplicatePrecheck,
} from '@/lib/journal-applications/duplicate-precheck'
import { journalNameSimilarity } from '@/lib/journal-applications/text-similarity'

export type RunDuplicatePrecheckParams = {
  excludeJournalApplicationId?: string
  excludeContentApplicationId?: string
  nameTr: string
  nameEn?: string | null
  pIssn?: string | null
  eIssn?: string | null
  publisherInstitutionId?: bigint | null
  proposedInstitutionName?: string | null
  publishingPlatform?: string | null
  websiteUrl?: string | null
  officialJournalUrl?: string | null
  platformProfileUrl?: string | null
}

function buildPrecheckInput(params: RunDuplicatePrecheckParams): DuplicatePrecheckInput {
  const website = params.websiteUrl ? normalizeExternalUrl(params.websiteUrl) : null
  const platformUrls = [
    params.platformProfileUrl,
    params.officialJournalUrl,
    params.websiteUrl,
  ].filter(Boolean) as string[]

  let platformUrlKey: string | null = null
  for (const url of platformUrls) {
    platformUrlKey = normalizePlatformUrlKey(url)
    if (platformUrlKey) break
  }

  return {
    excludeJournalApplicationId: params.excludeJournalApplicationId,
    excludeContentApplicationId: params.excludeContentApplicationId,
    nameTr: params.nameTr,
    nameEn: params.nameEn,
    pIssnNormalized: params.pIssn ? normalizeIssn(params.pIssn) : null,
    eIssnNormalized: params.eIssn ? normalizeIssn(params.eIssn) : null,
    publisherInstitutionId: params.publisherInstitutionId,
    proposedInstitutionName: params.proposedInstitutionName,
    publishingPlatform: params.publishingPlatform,
    websiteUrl: params.websiteUrl,
    officialJournalUrl: params.officialJournalUrl,
    platformProfileUrl: params.platformProfileUrl,
    websiteDomain: website?.ok ? website.domain : null,
    platformUrlKey,
  }
}

async function loadCatalogCandidates(input: DuplicatePrecheckInput): Promise<CatalogJournalCandidate[]> {
  const or: object[] = []

  if (input.pIssnNormalized) {
    or.push({ issn: { not: null } })
  }
  if (input.eIssnNormalized) {
    or.push({ eissn: { not: null } })
  }
  if (input.platformUrlKey) {
    or.push({ legacyLink: { not: null } })
  }
  if (input.nameTr.trim()) {
    or.push({
      titleTr: { contains: input.nameTr.trim().slice(0, Math.min(12, input.nameTr.length)), mode: 'insensitive' },
    })
  }

  if (or.length === 0) return []

  const rows = await prisma.journal.findMany({
    where: { OR: or },
    select: {
      id: true,
      titleTr: true,
      titleEn: true,
      issn: true,
      eissn: true,
      publisher: true,
      legacyLink: true,
      slug: true,
    },
    take: 100,
  })

  return rows.filter((row) => {
    if (input.pIssnNormalized && row.issn) {
      const n = normalizeIssn(row.issn)
      if (n === input.pIssnNormalized) return true
    }
    if (input.eIssnNormalized && row.eissn) {
      const n = normalizeIssn(row.eissn)
      if (n === input.eIssnNormalized) return true
    }
    if (input.platformUrlKey && row.legacyLink) {
      const key = normalizePlatformUrlKey(row.legacyLink)
      if (key === input.platformUrlKey) return true
    }
    const score = Math.max(
      journalNameSimilarity(input.nameTr, row.titleTr ?? ''),
      input.nameEn ? journalNameSimilarity(input.nameEn, row.titleEn ?? '') : 0,
    )
    return score >= 0.65
  })
}

async function loadPendingCandidates(input: DuplicatePrecheckInput): Promise<PendingApplicationCandidate[]> {
  const or: object[] = []
  if (input.pIssnNormalized) or.push({ pIssnNormalized: input.pIssnNormalized })
  if (input.eIssnNormalized) or.push({ eIssnNormalized: input.eIssnNormalized })

  if (or.length === 0 && !input.platformUrlKey) return []

  const rows = await prisma.journalApplication.findMany({
    where: {
      AND: [
        input.excludeJournalApplicationId
          ? { id: { not: input.excludeJournalApplicationId } }
          : {},
        input.excludeContentApplicationId
          ? { contentApplicationId: { not: input.excludeContentApplicationId } }
          : {},
        {
          contentApplication: {
            status: {
              in: [
                ContentApplicationStatus.draft,
                ContentApplicationStatus.submitted,
                ContentApplicationStatus.precheck,
                ContentApplicationStatus.under_review,
                ContentApplicationStatus.revision_requested,
              ],
            },
          },
        },
        or.length > 0 ? { OR: or } : {},
      ],
    },
    select: {
      id: true,
      contentApplicationId: true,
      nameTr: true,
      nameEn: true,
      pIssnNormalized: true,
      eIssnNormalized: true,
      publisherInstitutionId: true,
      proposedInstitutionName: true,
      publishingPlatform: true,
      websiteUrl: true,
      officialJournalUrl: true,
      platformProfileUrl: true,
    },
    take: 50,
  })

  if (!input.platformUrlKey) return rows

  return rows.filter((row) => {
    const urls = [row.platformProfileUrl, row.officialJournalUrl, row.websiteUrl].filter(Boolean) as string[]
    return urls.some((url) => normalizePlatformUrlKey(url) === input.platformUrlKey)
  })
}

export async function runJournalDuplicatePrecheck(
  params: RunDuplicatePrecheckParams,
): Promise<DuplicatePrecheckResult> {
  const input = buildPrecheckInput(params)
  const flags: DuplicateFlag[] = []

  const [catalog, pending] = await Promise.all([
    loadCatalogCandidates(input),
    loadPendingCandidates(input),
  ])

  for (const journal of catalog) {
    flags.push(...evaluateCatalogJournalDuplicate(input, journal, input.platformUrlKey ?? null))
  }
  for (const app of pending) {
    flags.push(...evaluatePendingApplicationDuplicate(input, app, input.platformUrlKey ?? null))
  }

  return summarizeDuplicatePrecheck(dedupeDuplicateFlags(flags))
}
