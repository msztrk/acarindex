/**
 * Dergi URL yardımcıları
 *
 * Canonical format:
 *   /journals/{journalSlug}-{journalId}
 *   /journals/{journalSlug}-{journalId}/sayi/{issueId}
 *   /journals/{journalSlug}-{journalId}/arsiv
 *   /journals/{journalSlug}-{journalId}/amac-kapsam
 *   /journals/{journalSlug}-{journalId}/editor-kurulu
 *   /journals/{journalSlug}-{journalId}/yazim-kurallari
 *   /journals/{journalSlug}-{journalId}/iletisim
 */

import { urlYap } from './slug'

export type JournalSubPage =
  | 'home'
  | 'arsiv'
  | 'amac-kapsam'
  | 'editor-kurulu'
  | 'yazim-kurallari'
  | 'iletisim'

export interface JournalUrlParts {
  journalSlug: string
  journalId: number
}

/**
 * Dergi başlığından canonical URL segmenti: "{slug}-{id}"
 */
export function buildJournalPathSegment(titleTr: string, journalId: number): string {
  return `${urlYap(titleTr)}-${journalId}`
}

/**
 * /journals/{segment} → { journalSlug, journalId } | null
 *
 * PHP: explode('-', DergiURL) → end($parcala) = ID
 */
export function parseJournalSegment(segment: string): JournalUrlParts | null {
  const match = segment.match(/^(.+)-(\d+)$/)
  if (!match) return null
  const journalId = parseInt(match[2], 10)
  if (isNaN(journalId) || journalId <= 0) return null
  return { journalSlug: match[1], journalId }
}

export function buildJournalUrl(titleTr: string, journalId: number): string {
  return `/journals/${buildJournalPathSegment(titleTr, journalId)}`
}

export function buildJournalSubUrl(
  titleTr: string,
  journalId: number,
  sub: Exclude<JournalSubPage, 'home'>,
): string {
  return `${buildJournalUrl(titleTr, journalId)}/${sub}`
}

export function buildIssueUrl(titleTr: string, journalId: number, issueId: number): string {
  return `${buildJournalUrl(titleTr, journalId)}/sayi/${issueId}`
}

/**
 * /sayi/{segment} path segmentinden pozitif tam sayı issue ID çıkarır.
 * Geçersiz: abc, 0, -1, boş.
 */
export function parseIssueIdSegment(segment: string): number | null {
  if (!segment || !/^\d+$/.test(segment)) return null
  const issueId = Number(segment)
  if (!Number.isSafeInteger(issueId) || issueId <= 0) return null
  return issueId
}
