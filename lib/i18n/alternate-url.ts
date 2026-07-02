import { buildJournalCatalogPath, buildArticlePath } from '@/lib/i18n/slugs'
import { parseLocaleFromPathname, withLocalePath, type SiteLocale } from '@/lib/i18n/locale'
import { parseArticlePath, extractArticleId } from '@/lib/urls/article'
import { parseJournalSegment } from '@/lib/urls/journal'
import { prisma } from '@/lib/db/prisma'

export async function resolveAlternateLocaleUrls(pathname: string): Promise<{
  tr: string
  en: string | null
  current: SiteLocale
}> {
  const { locale, pathnameWithoutLocale } = parseLocaleFromPathname(pathname)

  if (pathnameWithoutLocale.startsWith('/journals/')) {
    const rest = pathnameWithoutLocale.slice('/journals/'.length)
    const slash = rest.indexOf('/')
    const segment = slash === -1 ? rest : rest.slice(0, slash)
    const sub = slash === -1 ? '' : rest.slice(slash)
    const parsed = parseJournalSegment(segment)
    if (!parsed) return { tr: '/', en: null, current: locale }

    const journal = await prisma.journal.findFirst({
      where: { id: BigInt(parsed.journalId), status: 'published' },
      select: { id: true, slug: true, slugTr: true, slugEn: true },
    })
    if (!journal) return { tr: pathnameWithoutLocale, en: null, current: locale }

    const row = {
      id: Number(journal.id),
      slug: journal.slug,
      slugTr: journal.slugTr,
      slugEn: journal.slugEn,
    }
    const tr = `${buildJournalCatalogPath(row, 'tr')}${sub}`
    const en = row.slugEn ? `${buildJournalCatalogPath(row, 'en')}${sub}` : null
    return { tr, en, current: locale }
  }

  const parts = pathnameWithoutLocale.split('/').filter(Boolean)
  if (parts.length >= 2) {
    const journalSlug = parts[0]!
    const articleSlugAndId = parts[1]!
    const parsed = parseArticlePath(journalSlug, articleSlugAndId)
    const articleId = parsed?.articleId ?? extractArticleId(articleSlugAndId)
    if (articleId) {
      const article = await prisma.article.findFirst({
        where: { id: BigInt(articleId), status: 'published' },
        select: {
          id: true,
          slug: true,
          slugTr: true,
          slugEn: true,
          legacyJournalSlug: true,
          legacyJournalSlugEn: true,
          titleEn: true,
        },
      })
      if (article) {
        const row = {
          id: Number(article.id),
          slug: article.slug,
          slugTr: article.slugTr,
          slugEn: article.slugEn,
          legacyJournalSlug: article.legacyJournalSlug,
          legacyJournalSlugEn: article.legacyJournalSlugEn,
          titleEn: article.titleEn,
        }
        const tr = buildArticlePath(row, 'tr')
        const en = row.slugEn ? buildArticlePath(row, 'en') : null
        return { tr, en, current: locale }
      }
    }
  }

  const tr = pathnameWithoutLocale
  const en = pathnameWithoutLocale === '/' ? '/en' : withLocalePath(pathnameWithoutLocale, 'en')
  return { tr, en, current: locale }
}
