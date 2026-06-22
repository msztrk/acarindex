/**
 * Makale yazar kaynağı kolon seçimi — merkezi politika.
 * Kolon adına göre varsayım yapılmaz; şema doğrulaması ve doluluk politikası burada tanımlıdır.
 */

export const ARTICLE_AUTHOR_SOURCE_COLUMNS = {
  display: 'Yazarlar',
  citation: 'YazarlarKAYNAKCA',
  legacyIds: 'YazarID',
  references: 'Kaynakca',
} as const

export type ArticleAuthorSourceColumn =
  | typeof ARTICLE_AUTHOR_SOURCE_COLUMNS.display
  | typeof ARTICLE_AUTHOR_SOURCE_COLUMNS.citation

export type AuthorRegistryMode = 'required' | 'provisional-only'

export interface MakaleAuthorFields {
  Yazarlar?: string | null
  YazarlarKAYNAKCA?: string | null
  YazarID?: string | null
  Kaynakca?: string | null
}

export interface ArticleAuthorSourceSelection {
  /** Supabase articles.authors_raw için kaynak kolon */
  sourceColumn: ArticleAuthorSourceColumn
  /** Ham metin (trim uygulanmış veya null) */
  authorsRaw: string | null
  /** Kaynakça/atıf formatı — authors_citation */
  authorsCitation: string | null
  /** Seçim gerekçesi (log/rapor) */
  reason: string
}

export class ArticleAuthorSourceError extends Error {
  constructor(
    message: string,
    public readonly code: 'missing_column' | 'no_filled_column',
  ) {
    super(message)
    this.name = 'ArticleAuthorSourceError'
  }
}

/** Ortam değişkeninden registry modu; varsayılan required. */
export function resolveAuthorRegistryMode(
  env: Record<string, string | undefined> = process.env,
): AuthorRegistryMode {
  const raw = env.AUTHOR_REGISTRY_MODE?.trim().toLowerCase()
  if (raw === 'provisional-only' || raw === 'provisional_only') return 'provisional-only'
  return 'required'
}

/** makaleler satırından authors_raw kaynağını seçer. Sessiz fallback yok. */
export function selectArticleAuthorSource(
  row: MakaleAuthorFields,
  options: {
    /** Zorunlu kolon; yoksa hata */
    requiredColumn?: ArticleAuthorSourceColumn
    /** Doluluk karşılaştırmasıyla otomatik seçim (yalnızca profil/doğrulama) */
    preferFilled?: boolean
  } = {},
): ArticleAuthorSourceSelection {
  const hasYazarlar = 'Yazarlar' in row
  const hasKaynakca = 'YazarlarKAYNAKCA' in row

  if (!hasYazarlar && !hasKaynakca) {
    throw new ArticleAuthorSourceError(
      'makaleler satırında Yazarlar veya YazarlarKAYNAKCA kolonu bulunamadı',
      'missing_column',
    )
  }

  const yazarlar = trimOrNull(row.Yazarlar)
  const kaynakcaField = trimOrNull(row.YazarlarKAYNAKCA)

  if (options.requiredColumn === ARTICLE_AUTHOR_SOURCE_COLUMNS.display) {
    if (!hasYazarlar) {
      throw new ArticleAuthorSourceError('Yazarlar kolonu kaynakta yok', 'missing_column')
    }
    return {
      sourceColumn: ARTICLE_AUTHOR_SOURCE_COLUMNS.display,
      authorsRaw: yazarlar,
      authorsCitation: hasKaynakca ? kaynakcaField : null,
      reason: 'Politika: makaleler.Yazarlar → articles.authors_raw',
    }
  }

  if (options.requiredColumn === ARTICLE_AUTHOR_SOURCE_COLUMNS.citation) {
    if (!hasKaynakca) {
      throw new ArticleAuthorSourceError('YazarlarKAYNAKCA kolonu kaynakta yok', 'missing_column')
    }
    return {
      sourceColumn: ARTICLE_AUTHOR_SOURCE_COLUMNS.citation,
      authorsRaw: kaynakcaField,
      authorsCitation: kaynakcaField,
      reason: 'Politika: makaleler.YazarlarKAYNAKCA → articles.authors_raw (açık override)',
    }
  }

  // Varsayılan ETL politikası: Yazarlar birincil; yalnızca Yazarlar boşsa YazarlarKAYNAKCA kullanılmaz
  // (kaynakça/atıf formatı karışmasın). Dump analizi: Yazarlar %99.8 dolu, KAYNAKCA %51.6 ve çoğunlukla aynı metin.
  if (!hasYazarlar) {
    throw new ArticleAuthorSourceError('Yazarlar kolonu kaynakta yok', 'missing_column')
  }

  return {
    sourceColumn: ARTICLE_AUTHOR_SOURCE_COLUMNS.display,
    authorsRaw: yazarlar,
    authorsCitation: hasKaynakca ? kaynakcaField : null,
    reason: 'makaleler.Yazarlar → articles.authors_raw (birincil makale yazarı listesi)',
  }
}

/** ETL 03 için makale → Supabase alan eşlemesi. */
export function mapMakaleAuthorFields(row: MakaleAuthorFields): {
  authors_raw: string | null
  authors_citation: string | null
  sourceColumn: ArticleAuthorSourceColumn
  sourceReason: string
} {
  const sel = selectArticleAuthorSource(row)
  return {
    authors_raw: sel.authorsRaw,
    authors_citation: sel.authorsCitation,
    sourceColumn: sel.sourceColumn,
    sourceReason: sel.reason,
  }
}

/** SQL SELECT listesi — kolon adları merkezi sabitlerden. */
export function makaleAuthorSelectColumns(): string {
  return [
    ARTICLE_AUTHOR_SOURCE_COLUMNS.display,
    ARTICLE_AUTHOR_SOURCE_COLUMNS.citation,
    ARTICLE_AUTHOR_SOURCE_COLUMNS.legacyIds,
    ARTICLE_AUTHOR_SOURCE_COLUMNS.references,
  ].join(', ')
}

/** Doluluk karşılaştırma sorgusu parçaları (inventory / dry-run). */
export function authorColumnFillSql(): {
  yazarlarFilled: string
  kaynakcaFilled: string
  bothFilled: string
  onlyYazarlar: string
  onlyKaynakca: string
} {
  const y = `Yazarlar IS NOT NULL AND TRIM(Yazarlar) != ''`
  const k = `YazarlarKAYNAKCA IS NOT NULL AND TRIM(YazarlarKAYNAKCA) != ''`
  return {
    yazarlarFilled: y,
    kaynakcaFilled: k,
    bothFilled: `(${y}) AND (${k})`,
    onlyYazarlar: `(${y}) AND NOT (${k})`,
    onlyKaynakca: `(${k}) AND NOT (${y})`,
  }
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null
  const t = value.trim()
  return t.length > 0 ? t : null
}
