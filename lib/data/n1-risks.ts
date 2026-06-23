/**
 * Katalog okuma katmanında bilinen N+1 ve limitsiz sorgu riskleri.
 * Gerçek veri doğrulaması öncesi statik envanter; restore sonrası profil ile güncellenir.
 */
export interface CatalogQueryRisk {
  id: string
  location: string
  risk: 'n+1' | 'unbounded-list'
  mitigation: string
  status: 'mitigated' | 'monitor' | 'deferred'
}

export const CATALOG_QUERY_RISKS: CatalogQueryRisk[] = [
  {
    id: 'issue-articles-list',
    location: 'lib/data/journals.ts → listArticlesForIssue',
    risk: 'unbounded-list',
    mitigation: 'ISSUE_ARTICLES_MAX take limiti uygulanır',
    status: 'mitigated',
  },
  {
    id: 'journal-issues-list',
    location: 'lib/data/journals.ts → listPublishedIssuesForJournal',
    risk: 'unbounded-list',
    mitigation: 'Dergi başına sayı sayısı sınırlı; çok büyük dergilerde sayfalama ertelenmiş doğrulama',
    status: 'monitor',
  },
  {
    id: 'author-articles-list',
    location: 'lib/data/authors.ts → listAuthorPublishedArticles',
    risk: 'unbounded-list',
    mitigation: 'Yazar makale listesi tek sorgu; çok yazarlı edge case restore sonrası profillenecek',
    status: 'monitor',
  },
  {
    id: 'article-detail-authors',
    location: 'lib/data/articles.ts → getPublishedArticleDetailById',
    risk: 'n+1',
    mitigation: 'articleAuthors include ile tek sorguda yüklenir',
    status: 'mitigated',
  },
  {
    id: 'home-recent-articles',
    location: 'lib/data/catalog.ts → listRecentArticles',
    risk: 'unbounded-list',
    mitigation: 'HOME_RECENT_ARTICLES take limiti',
    status: 'mitigated',
  },
  {
    id: 'sitemap-article-pages',
    location: 'app/sitemap-articles/[page]/route.ts',
    risk: 'unbounded-list',
    mitigation: 'SITEMAP_ARTICLES_PAGE_SIZE ve SITEMAP_ARTICLES_MAX_PAGES',
    status: 'mitigated',
  },
]
