import {
  formatIssueVolumeIssueLabel,
  getIssueLabelStrings,
  isRedundantYearLabel,
  parseIssueCitationParts,
  buildIssueMetadataTitle,
} from '@/lib/journals/issue-citation'
import type { SiteLocale } from '@/lib/i18n/locale'
import { buildIssueUrlFromSegment } from '@/lib/urls/journal'
import type { Issue } from '@/types/database'

export const ARCHIVE_UNDATED_YEAR_KEY = 0

export interface ArchiveYearGroup {
  yearKey: number
  heading: string
  issues: Issue[]
}

export interface GroupedArchiveIssues {
  groups: ArchiveYearGroup[]
  totalIssues: number
}

function parseNumericSortValue(value: string | null | undefined): number | null {
  if (!value?.trim()) return null
  const match = value.trim().match(/\d+/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

export function buildArchiveIssueLabel(issue: Issue, locale: SiteLocale = 'tr'): string {
  const labels = getIssueLabelStrings(locale)
  const { volumeLabel, issueNumLabel, year } = parseIssueCitationParts(issue)
  const structured = formatIssueVolumeIssueLabel(volumeLabel, issueNumLabel, labels)

  if (structured) return structured

  const label = issue.issue_label?.trim()
  if (label && !isRedundantYearLabel(label, year)) {
    return label
  }

  return labels.issueFallback
}

export function compareArchiveIssues(a: Issue, b: Issue): number {
  const aParts = parseIssueCitationParts(a)
  const bParts = parseIssueCitationParts(b)

  const aVolume = parseNumericSortValue(aParts.volumeLabel)
  const bVolume = parseNumericSortValue(bParts.volumeLabel)
  if (aVolume !== null && bVolume !== null && aVolume !== bVolume) {
    return bVolume - aVolume
  }
  if (aVolume !== null && bVolume === null) return -1
  if (aVolume === null && bVolume !== null) return 1

  const aIssue = parseNumericSortValue(aParts.issueNumLabel)
  const bIssue = parseNumericSortValue(bParts.issueNumLabel)
  if (aIssue !== null && bIssue !== null && aIssue !== bIssue) {
    return bIssue - aIssue
  }
  if (aIssue !== null && bIssue === null) return -1
  if (aIssue === null && bIssue !== null) return 1

  return b.id - a.id
}

export function groupArchiveIssues(issues: Issue[], locale: SiteLocale = 'tr'): GroupedArchiveIssues {
  const labels = getIssueLabelStrings(locale)
  const uniqueById = new Map<number, Issue>()
  for (const issue of issues) {
    if (!uniqueById.has(issue.id)) {
      uniqueById.set(issue.id, issue)
    }
  }

  const deduped = [...uniqueById.values()]
  const byYear = new Map<number, Issue[]>()

  for (const issue of deduped) {
    const yearKey = issue.year ?? ARCHIVE_UNDATED_YEAR_KEY
    const bucket = byYear.get(yearKey) ?? []
    bucket.push(issue)
    byYear.set(yearKey, bucket)
  }

  const datedYears = [...byYear.keys()]
    .filter((year) => year !== ARCHIVE_UNDATED_YEAR_KEY)
    .sort((a, b) => b - a)

  const groups: ArchiveYearGroup[] = datedYears.map((year) => ({
    yearKey: year,
    heading: String(year),
    issues: [...byYear.get(year)!].sort(compareArchiveIssues),
  }))

  const undated = byYear.get(ARCHIVE_UNDATED_YEAR_KEY)
  if (undated?.length) {
    groups.push({
      yearKey: ARCHIVE_UNDATED_YEAR_KEY,
      heading: labels.undatedIssuesHeading,
      issues: [...undated].sort(compareArchiveIssues),
    })
  }

  return {
    groups,
    totalIssues: deduped.length,
  }
}

export function buildArchiveIssueHref(journalSegment: string, issueId: number): string {
  return buildIssueUrlFromSegment(journalSegment, issueId)
}

export function buildArchiveIssueDisplayTitle(
  journalTitle: string,
  issue: Issue,
  locale: SiteLocale = 'tr',
): string {
  return buildIssueMetadataTitle(journalTitle, issue, locale)
}
