import type { Prisma } from '@prisma/client'

/** Published makaleler — gerçek İngilizce içerik (has_en_content bayrağı). */
export const publishedEnglishArticleWhere: Prisma.ArticleWhereInput = {
  status: 'published',
  hasEnContent: true,
}

/** Published dergiler — gerçek İngilizce içerik. */
export const publishedEnglishJournalWhere: Prisma.JournalWhereInput = {
  status: 'published',
  hasEnContent: true,
}
