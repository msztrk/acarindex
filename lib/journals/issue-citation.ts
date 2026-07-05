import type { SiteLocale } from '@/lib/i18n/locale'
import type { Issue } from '@/types/database'

export type IssueLabelStrings = {
  volume: string
  issue: string
  issueFallback: string
  undatedIssuesHeading: string
}

export function getIssueLabelStrings(locale: SiteLocale): IssueLabelStrings {
  if (locale === 'en') {
    return {
      volume: 'Vol.',
      issue: 'Issue',
      issueFallback: 'Issue',
      undatedIssuesHeading: 'Issues without publication year',
    }
  }
  return {
    volume: 'Cilt',
    issue: 'Sayı',
    issueFallback: 'Sayı',
    undatedIssuesHeading: 'Yılı belirtilmemiş sayılar',
  }
}

export function formatIssueVolumeIssueLabel(
  volumeLabel: string | null,
  issueNumLabel: string | null,
  labels: IssueLabelStrings,
): string | null {
  if (volumeLabel && issueNumLabel) {
    return `${labels.volume} ${volumeLabel}, ${labels.issue} ${issueNumLabel}`
  }
  if (issueNumLabel) {
    return `${labels.issue} ${issueNumLabel}`
  }
  if (volumeLabel) {
    return `${labels.volume} ${volumeLabel}`
  }
  return null
}

export function isRedundantYearLabel(label: string, year: number | null): boolean {
  return year !== null && label === String(year)
}

export function parseIssueCitationParts(issue: Issue): {
  volumeLabel: string | null
  issueNumLabel: string | null
  year: number | null
} {
  const year = issue.year ?? null
  let volumeLabel = issue.volume?.trim() || null
  let issueNumLabel: string | null = null
  const raw = issue.issue_number?.trim()

  if (raw) {
    const ciltMatch = raw.match(/Cilt:\s*([^,-]+)/i)
    const sayiMatch = raw.match(/Sayı:\s*(\S+)/i)
    if (ciltMatch) volumeLabel = ciltMatch[1].trim()
    if (sayiMatch) issueNumLabel = sayiMatch[1].trim()
    if (!sayiMatch && !ciltMatch) issueNumLabel = raw
  }

  return { volumeLabel, issueNumLabel, year }
}

export function buildIssueMetadataTitle(
  journalTitle: string,
  issue: Issue,
  locale: SiteLocale = 'tr',
): string {
  const labels = getIssueLabelStrings(locale)
  const { volumeLabel, issueNumLabel, year } = parseIssueCitationParts(issue)
  const structured = formatIssueVolumeIssueLabel(volumeLabel, issueNumLabel, labels)
  let detail: string | null = structured

  if (!detail) {
    const label = issue.issue_label?.trim()
    if (label && !isRedundantYearLabel(label, year)) {
      detail = label
    }
  }

  if (!detail) {
    return year ? `${journalTitle} — ${year}` : journalTitle
  }

  return year
    ? `${journalTitle} — ${detail} (${year})`
    : `${journalTitle} — ${detail}`
}

export function buildIssueMetadataDescription(
  journalTitle: string,
  issue: Issue,
  articleCount: number,
  locale: SiteLocale = 'tr',
): string | undefined {
  const labels = getIssueLabelStrings(locale)
  const { volumeLabel, issueNumLabel, year } = parseIssueCitationParts(issue)
  const issueBits: string[] = []
  if (volumeLabel) issueBits.push(`${labels.volume} ${volumeLabel}`)
  if (issueNumLabel) issueBits.push(`${labels.issue} ${issueNumLabel}`)
  const labelFallback = issue.issue_label?.trim()
  const issueStr =
    issueBits.join(' ') ||
    (labelFallback && !isRedundantYearLabel(labelFallback, year) ? labelFallback : undefined)

  if (!issueStr && !year) return undefined

  let desc = journalTitle
  if (issueStr) {
    desc += `, ${issueStr}`
    if (year) desc += ` (${year})`
  } else if (year) {
    desc += ` (${year})`
  }
  desc += ' içinde yayımlanan'
  if (articleCount > 0) {
    desc += ` ${articleCount} akademik makaleyi inceleyin.`
  } else {
    desc += ' akademik makaleleri inceleyin.'
  }
  return desc.slice(0, 160)
}
