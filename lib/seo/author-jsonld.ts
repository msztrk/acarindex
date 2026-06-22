import { buildOrcidUrl, normalizeOrcidValue } from '@/lib/authors/orcid'
import { normalizeAuthorDisplayName } from '@/lib/authors/display'
import { buildAuthorUrl } from '@/lib/urls/author'
import type { Author } from '@/types/database'

type JsonLdNode = Record<string, unknown>

export interface AuthorJsonLdArticle {
  id: number
  slug: string
  legacy_journal_slug: string
  title_tr: string | null
  title_en: string | null
}

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

export interface BuildAuthorPageJsonLdInput {
  canonicalBase: string
  author: Author
  articles: AuthorJsonLdArticle[]
  pageTitle: string
  description?: string
}

export function buildAuthorPageJsonLd(input: BuildAuthorPageJsonLdInput): JsonLdNode {
  const { canonicalBase, author, articles, pageTitle, description } = input
  const displayName = normalizeAuthorDisplayName(author.name)
  const authorPath = buildAuthorUrl(author)
  const authorCanonical = `${canonicalBase}${authorPath}`
  const personId = `${authorCanonical}#person`
  const profileId = `${authorCanonical}#profile`
  const orcid = normalizeOrcidValue(author.orcid)
  const institution = author.institution?.trim()

  const personNode = compactNode({
    '@type': 'Person',
    '@id': personId,
    name: displayName,
    url: authorCanonical,
    sameAs: orcid ? buildOrcidUrl(orcid) : undefined,
    affiliation: institution
      ? { '@type': 'Organization', name: institution }
      : undefined,
  })

  const profileNode = compactNode({
    '@type': 'ProfilePage',
    '@id': profileId,
    url: authorCanonical,
    name: pageTitle,
    description,
    mainEntity: { '@id': personId },
  })

  const graph: JsonLdNode[] = []
  if (profileNode) graph.push(profileNode)
  if (personNode) graph.push(personNode)

  const scholarlyNodes: JsonLdNode[] = []
  const listItems: JsonLdNode[] = []

  for (const [index, article] of articles.entries()) {
    const title = article.title_tr ?? article.title_en ?? 'Başlıksız'
    const articleCanonical = `${canonicalBase}/${article.legacy_journal_slug}/${article.slug}-${article.id}`

    scholarlyNodes.push(
      compactNode({
        '@type': 'ScholarlyArticle',
        '@id': articleCanonical,
        url: articleCanonical,
        name: title,
        author: { '@id': personId },
      })!,
    )

    listItems.push({
      '@type': 'ListItem',
      position: index + 1,
      item: { '@id': articleCanonical },
    })
  }

  if (listItems.length > 0) {
    const itemList = compactNode({
      '@type': 'ItemList',
      '@id': `${authorCanonical}#article-list`,
      name: `${displayName} makaleleri`,
      numberOfItems: listItems.length,
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      itemListElement: listItems,
    })
    if (itemList) graph.push(itemList)
  }

  graph.push(...scholarlyNodes)

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  }
}
