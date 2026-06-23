/**
 * Eski PHP / legacy URL → yeni Next.js canonical yönlendirme taslağı.
 * Uygulama henüz deploy edilmedi; Nginx veya middleware ile uygulanacak.
 */
export interface LegacyRedirectRule {
  /** Eski path kalıbı (örnek veya prefix) */
  legacyPattern: string
  /** Yeni canonical kalıbı */
  canonicalPattern: string
  httpStatus: 301 | 302
  notes?: string
}

export const LEGACY_URL_REDIRECT_DRAFT: LegacyRedirectRule[] = [
  {
    legacyPattern: '/dergi/{journalId}',
    canonicalPattern: '/journals/{slug}-{journalId}',
    httpStatus: 301,
    notes: 'slug veritabanından veya url_aliases tablosundan',
  },
  {
    legacyPattern: '/dergi/{journalId}/sayi/{issueId}',
    canonicalPattern: '/journals/{slug}-{journalId}/sayi/{issueId}',
    httpStatus: 301,
  },
  {
    legacyPattern: '/{journalSlug}/{articleSlug}-{articleId}',
    canonicalPattern: '/{journalSlug}/{articleSlug}-{articleId}',
    httpStatus: 301,
    notes: 'Makale path korunur; slug düzeltmesi gerekirse url_aliases',
  },
  {
    legacyPattern: '/yazar/{authorId}',
    canonicalPattern: '/authors/{slug}-{authorId}',
    httpStatus: 301,
  },
  {
    legacyPattern: '/pdfgoruntule.php?id={articleId}',
    canonicalPattern: '/pdfs/{articleId}',
    httpStatus: 302,
    notes: 'Geçici viewer; tam metin legacy sunucuda',
  },
]
