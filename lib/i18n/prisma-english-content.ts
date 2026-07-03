import type { Prisma } from '@prisma/client'

/** Published makaleler — gerçek İngilizce içerik + geçerli slug + aktif dergi. */
export const publishedEnglishArticleWhere: Prisma.ArticleWhereInput = {
  status: 'published',
  hasEnContent: true,
  AND: [{ slugEn: { not: null } }, { NOT: { slugEn: '' } }],
  journal: { status: 'published' },
}

/** Published dergiler — gerçek İngilizce içerik + geçerli slug. */
export const publishedEnglishJournalWhere: Prisma.JournalWhereInput = {
  status: 'published',
  hasEnContent: true,
  AND: [{ slugEn: { not: null } }, { NOT: { slugEn: '' } }],
}

export const publishedEnglishArticleSelect = {
  id: true,
  slug: true,
  slugTr: true,
  slugEn: true,
  titleTr: true,
  titleEn: true,
  abstractTr: true,
  abstractEn: true,
  language: true,
  documentLanguage: true,
  hasEnContent: true,
  legacyJournalSlug: true,
  legacyJournalSlugEn: true,
} as const

export const publishedEnglishJournalSelect = {
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
} as const
