/**
 * Kritik vs düşük riskli alan ayrımı — change request UI Faz 3+.
 * Bu aşamada yalnızca politika sabitleri; CRUD UI yok.
 */

export const LOW_RISK_ARTICLE_FIELDS = [
  'title_tr',
  'title_en',
  'abstract_tr',
  'abstract_en',
  'keywords_tr',
  'keywords_en',
  'page_start',
  'page_end',
  'authors_raw',
  'institution_raw',
  'language',
] as const

export const LOW_RISK_JOURNAL_FIELDS = [
  'description',
  'website',
  'email',
  'publisher',
  'cover_path',
] as const

export type LowRiskArticleField = (typeof LOW_RISK_ARTICLE_FIELDS)[number]
export type LowRiskJournalField = (typeof LOW_RISK_JOURNAL_FIELDS)[number]

/** Change request gerektiren kritik işlemler / alanlar. */
export const CRITICAL_CHANGE_TYPES = [
  'journal.name_change',
  'journal.issn_change',
  'journal.eissn_change',
  'article.doi_change',
  'article.pdf_replace',
  'article.delete',
  'journal.delete',
  'journal.merge',
  'article.move_journal',
  'article.move_issue',
  'issue.identity_change',
  'slug.change',
  'journal.ownership_change',
] as const

export type CriticalChangeType = (typeof CRITICAL_CHANGE_TYPES)[number]

export function isLowRiskArticleField(field: string): field is LowRiskArticleField {
  return (LOW_RISK_ARTICLE_FIELDS as readonly string[]).includes(field)
}

export function isLowRiskJournalField(field: string): field is LowRiskJournalField {
  return (LOW_RISK_JOURNAL_FIELDS as readonly string[]).includes(field)
}

export function isCriticalChangeType(changeType: string): changeType is CriticalChangeType {
  return (CRITICAL_CHANGE_TYPES as readonly string[]).includes(changeType)
}

export function requiresChangeRequest(changeType: string): boolean {
  return isCriticalChangeType(changeType)
}
