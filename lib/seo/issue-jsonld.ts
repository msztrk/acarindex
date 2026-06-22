import { parseIssueCitationParts, isRedundantYearLabel } from '@/lib/journals/issue-citation'
import type { Article, Issue, Journal } from '@/types/database'

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

function resolveReliableIssueNumber(issue: Issue, issueNumLabel: string | null): string | undefined {
  if (!issueNumLabel) return undefined

  const year = issue.year ?? null
  if (isRedundantYearLabel(issueNumLabel, year)) return undefined

  const raw = issue.issue_number?.trim()
  if (!raw) return undefined

  const sayiMatch = raw.match(/Sayı:\s*(\S+)/i)
  if (sayiMatch) return issueNumLabel

  if (/Cilt:/i.test(raw) || /Sayı:/i.test(raw)) return undefined

  return issueNumLabel
}

function buildArticleCanonicalUrl(
  canonicalBase: string,
  article: Partial<Article>,
): string | null {
  const legacyJournalSlug = article.legacy_journal_slug?.trim()
  const slug = article.slug?.trim()
  const articleId = article.id

  if (!legacyJournalSlug || !slug || !articleId) return null

  return `${canonicalBase}/${legacyJournalSlug}/${slug}-${articleId}`
}

export interface BuildIssuePageJsonLdInput {
  canonicalBase: string
  journalSegment: string
  journal: Journal
  issue: Issue
  articles: Partial<Article>[]
  pageTitle: string
  description?: string
}

export function buildIssuePageJsonLd(input: BuildIssuePageJsonLdInput): JsonLdNode {
  const { canonicalBase, journalSegment, journal, issue, articles, pageTitle, description } = input
  const journalTitle = journal.title_tr ?? journal.title_en ?? 'Dergi'
  const journalCanonical = `${canonicalBase}/journals/${journalSegment}`
  const issueCanonical = `${journalCanonical}/sayi/${issue.id}`
  const periodicalId = `${journalCanonical}#periodical`
  const issueEntityId = `${issueCanonical}#issue`
  const webpageId = `${issueCanonical}#webpage`

  const { volumeLabel, issueNumLabel } = parseIssueCitationParts(issue)
  const volumeId = volumeLabel ? `${journalCanonical}#volume-${volumeLabel}` : null
  const issueNumber = resolveReliableIssueNumber(issue, issueNumLabel)

  const periodicalNode = compactNode({
    '@type': 'Periodical',
    '@id': periodicalId,
    url: journalCanonical,
    name: journalTitle,
    issn: journal.issn?.trim() || undefined,
    identifier:
      journal.eissn?.trim()
        ? [{ '@type': 'PropertyValue', propertyID: 'eISSN', value: journal.eissn.trim() }]
        : undefined,
  })

  const volumeNode =
    volumeId && volumeLabel
      ? compactNode({
          '@type': 'PublicationVolume',
          '@id': volumeId,
          volumeNumber: volumeLabel,
          isPartOf: { '@id': periodicalId },
        })
      : null

  const issueIsPartOf = volumeId ? { '@id': volumeId } : { '@id': periodicalId }

  const articleCanonicalUrls: string[] = []
  const scholarlyArticleNodes: JsonLdNode[] = []
  const listItems: JsonLdNode[] = []

  for (const [index, article] of articles.entries()) {
    const articleCanonical = buildArticleCanonicalUrl(canonicalBase, article)
    if (!articleCanonical) continue

    const articleTitle = article.title_tr ?? article.title_en ?? 'Başlıksız'
    articleCanonicalUrls.push(articleCanonical)

    scholarlyArticleNodes.push(
      compactNode({
        '@type': 'ScholarlyArticle',
        '@id': articleCanonical,
        url: articleCanonical,
        name: articleTitle,
        isPartOf: { '@id': issueEntityId },
      })!,
    )

    listItems.push({
      '@type': 'ListItem',
      position: index + 1,
      item: { '@id': articleCanonical },
    })
  }

  const publicationIssueNode = compactNode({
    '@type': 'PublicationIssue',
    '@id': issueEntityId,
    url: issueCanonical,
    name: pageTitle,
    description,
    issueNumber,
    isPartOf: issueIsPartOf,
    hasPart:
      articleCanonicalUrls.length > 0
        ? articleCanonicalUrls.map((url) => ({ '@id': url }))
        : undefined,
  })

  const webpageNode = compactNode({
    '@type': 'WebPage',
    '@id': webpageId,
    url: issueCanonical,
    name: pageTitle,
    description,
    mainEntity: { '@id': issueEntityId },
  })

  const graph: JsonLdNode[] = []

  if (webpageNode) graph.push(webpageNode)
  if (publicationIssueNode) graph.push(publicationIssueNode)
  if (periodicalNode) graph.push(periodicalNode)
  if (volumeNode) graph.push(volumeNode)

  if (listItems.length > 0) {
    const itemListNode = compactNode({
      '@type': 'ItemList',
      '@id': `${issueCanonical}#article-list`,
      name: `${pageTitle} makaleleri`,
      numberOfItems: listItems.length,
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      itemListElement: listItems,
    })
    if (itemListNode) graph.push(itemListNode)
  }

  graph.push(...scholarlyArticleNodes)

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  }
}
