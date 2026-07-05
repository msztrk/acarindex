import {
  buildArchiveIssueDisplayTitle,
  buildArchiveIssueHref,
  groupArchiveIssues,
} from '@/lib/journals/archive'
import type { SiteLocale } from '@/lib/i18n/locale'
import type { Issue, Journal } from '@/types/database'

type JsonLdNode = Record<string, unknown>

function compactNode(node: JsonLdNode): JsonLdNode | null {
  const result: JsonLdNode = {}

  for (const [key, value] of Object.entries(node)) {
    if (value === null || value === undefined) continue
    if (typeof value === 'string' && value.trim() === '') continue

    if (Array.isArray(value)) {
      const items = value
        .map((item) => {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            return compactNode(item as JsonLdNode)
          }
          return item
        })
        .filter((item) => item !== null && item !== undefined)
      if (items.length > 0) result[key] = items
      continue
    }

    if (typeof value === 'object') {
      const nested = compactNode(value as JsonLdNode)
      if (nested && Object.keys(nested).length > 0) result[key] = nested
      continue
    }

    result[key] = value
  }

  return Object.keys(result).length > 0 ? result : null
}

export interface BuildArchivePageJsonLdInput {
  canonicalBase: string
  journalSegment: string
  journal: Journal
  issues: Issue[]
  pageTitle: string
  description?: string
  locale?: SiteLocale
}

export function buildArchivePageJsonLd(input: BuildArchivePageJsonLdInput): JsonLdNode {
  const { canonicalBase, journalSegment, journal, issues, pageTitle, description, locale = 'tr' } = input
  const journalTitle = journal.title_tr ?? journal.title_en ?? 'Dergi'
  const archiveCanonical = `${canonicalBase}/journals/${journalSegment}/arsiv`
  const journalCanonical = `${canonicalBase}/journals/${journalSegment}`
  const periodicalId = `${journalCanonical}#periodical`
  const webpageId = `${archiveCanonical}#webpage`

  const grouped = groupArchiveIssues(issues, locale)
  const listItems: JsonLdNode[] = []

  let position = 0
  for (const group of grouped.groups) {
    for (const issue of group.issues) {
      position += 1
      const issueCanonical = `${canonicalBase}${buildArchiveIssueHref(journalSegment, issue.id)}`
      const issueName = buildArchiveIssueDisplayTitle(journalTitle, issue, locale)
      listItems.push({
        '@type': 'ListItem',
        position,
        item: compactNode({
          '@type': 'PublicationIssue',
          url: issueCanonical,
          name: issueName,
        })!,
      })
    }
  }

  const graph: JsonLdNode[] = []

  const collectionPage = compactNode({
    '@type': 'CollectionPage',
    '@id': webpageId,
    url: archiveCanonical,
    name: pageTitle,
    description,
    isPartOf: { '@id': periodicalId },
    mainEntity: { '@id': periodicalId },
  })
  if (collectionPage) graph.push(collectionPage)

  if (listItems.length > 0) {
    const itemList = compactNode({
      '@type': 'ItemList',
      '@id': `${archiveCanonical}#issue-list`,
      name: `${pageTitle} sayı listesi`,
      numberOfItems: listItems.length,
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      itemListElement: listItems,
    })
    if (itemList) graph.push(itemList)
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  }
}
