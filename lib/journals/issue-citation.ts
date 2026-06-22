import type { Issue } from '@/types/database'

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

export function buildIssueMetadataTitle(journalTitle: string, issue: Issue): string {
  const { volumeLabel, issueNumLabel, year } = parseIssueCitationParts(issue)
  const detailParts: string[] = []

  if (volumeLabel && issueNumLabel) {
    detailParts.push(`Cilt ${volumeLabel}, Sayı ${issueNumLabel}`)
  } else if (issueNumLabel) {
    detailParts.push(`Sayı ${issueNumLabel}`)
  } else if (volumeLabel) {
    detailParts.push(`Cilt ${volumeLabel}`)
  } else {
    const label = issue.issue_label?.trim()
    if (label && !isRedundantYearLabel(label, year)) {
      detailParts.push(label)
    }
  }

  if (detailParts.length === 0) {
    return year ? `${journalTitle} — ${year}` : journalTitle
  }

  return year
    ? `${journalTitle} — ${detailParts[0]} (${year})`
    : `${journalTitle} — ${detailParts[0]}`
}

export function buildIssueMetadataDescription(
  journalTitle: string,
  issue: Issue,
  articleCount: number,
): string | undefined {
  const { volumeLabel, issueNumLabel, year } = parseIssueCitationParts(issue)
  const issueBits: string[] = []
  if (volumeLabel) issueBits.push(`Cilt ${volumeLabel}`)
  if (issueNumLabel) issueBits.push(`Sayı ${issueNumLabel}`)
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
