import { buildJournalCatalogPath, buildArticlePath } from '@/lib/i18n/slugs'
import { parseLocaleFromPathname, withLocalePath, type SiteLocale } from '@/lib/i18n/locale'
import { parseArticlePath, extractArticleId } from '@/lib/urls/article'
import { parseJournalSegment } from '@/lib/urls/journal'
import { prisma } from '@/lib/db/prisma'
import {
  hasEnglishArticleContent,
  hasEnglishJournalContent,
} from '@/lib/i18n/content-availability'

export type LocaleAlternateDetail = {
  available: boolean
  locale: SiteLocale
  url: string | null
  reason?: 'english_content_unavailable'
}

export type AlternateLocaleResult = {
  tr: string
  en: string | null
  current: SiteLocale
  alternates: {
    tr: LocaleAlternateDetail
    en: LocaleAlternateDetail
  }
}

function enUnavailable(): LocaleAlternateDetail {
  return {
    available: false,
    locale: 'en',
    url: null,
    reason: 'english_content_unavailable',
  }
}

export async function resolveAlternateLocaleUrls(pathname: string): Promise<AlternateLocaleResult> {
  const { locale, pathnameWithoutLocale } = parseLocaleFromPathname(pathname)

  if (pathnameWithoutLocale.startsWith('/journals/')) {
    const rest = pathnameWithoutLocale.slice('/journals/'.length)
    const slash = rest.indexOf('/')
    const segment = slash === -1 ? rest : rest.slice(0, slash)
    const sub = slash === -1 ? '' : rest.slice(slash)
    const parsed = parseJournalSegment(segment)
    if (!parsed) {
      return wrapStatic('/', locale)
    }

    const journal = await prisma.journal.findFirst({
      where: { id: BigInt(parsed.journalId), status: 'published' },
      select: {
        id: true,
        slug: true,
        slugTr: true,
        slugEn: true,
        titleTr: true,
        titleEn: true,
        description: true,
        about: true,
        aimAndScope: true,
        hasEnContent: true,
      },
    })
    if (!journal) return wrapPaths(pathnameWithoutLocale, null, locale)

    const row = {
      id: Number(journal.id),
      slug: journal.slug,
      slugTr: journal.slugTr,
      slugEn: journal.slugEn,
      titleTr: journal.titleTr,
      titleEn: journal.titleEn,
      description: journal.description,
      about: journal.about,
      aimAndScope: journal.aimAndScope,
      hasEnContent: journal.hasEnContent,
    }
    const tr = `${buildJournalCatalogPath(row, 'tr')}${sub}`
    const hasEn =
      journal.hasEnContent ||
      hasEnglishJournalContent({
        titleEn: journal.titleEn,
        titleTr: journal.titleTr,
        description: journal.description,
        about: journal.about,
        aimAndScope: journal.aimAndScope,
      })
    const en = hasEn ? `${buildJournalCatalogPath(row, 'en')}${sub}` : null
    return wrapPaths(tr, en, locale)
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
          titleTr: true,
          titleEn: true,
          abstractTr: true,
          abstractEn: true,
          language: true,
          documentLanguage: true,
          hasEnContent: true,
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
          titleTr: article.titleTr,
          titleEn: article.titleEn,
          abstractTr: article.abstractTr,
          abstractEn: article.abstractEn,
          language: article.language,
          documentLanguage: article.documentLanguage,
          hasEnContent: article.hasEnContent,
        }
        const tr = buildArticlePath(row, 'tr')
        const hasEn =
          article.hasEnContent ||
          hasEnglishArticleContent({
            titleEn: article.titleEn,
            abstractEn: article.abstractEn,
            language: article.language,
            documentLanguage: article.documentLanguage,
          })
        const en = hasEn ? buildArticlePath(row, 'en') : null
        return wrapPaths(tr, en, locale)
      }
    }
  }

  const tr = pathnameWithoutLocale
  const en = pathnameWithoutLocale === '/' ? '/en' : withLocalePath(pathnameWithoutLocale, 'en')
  return wrapPaths(tr, en, locale)
}

function wrapStatic(tr: string, current: SiteLocale): AlternateLocaleResult {
  return wrapPaths(tr, '/en', current)
}

function wrapPaths(tr: string, en: string | null, current: SiteLocale): AlternateLocaleResult {
  return {
    tr,
    en,
    current,
    alternates: {
      tr: { available: true, locale: 'tr', url: tr },
      en: en
        ? { available: true, locale: 'en', url: en }
        : enUnavailable(),
    },
  }
}
