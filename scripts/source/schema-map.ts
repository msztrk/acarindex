/**
 * Kaynak MySQL → Supabase şema haritası (ETL 01–04).
 * Kod referansı; migration öncesi manuel doğrulama gerekir.
 */

export const SOURCE_TARGET_SCHEMA_MAP = [
  {
    sourceTable: 'kategoriler',
    targetTable: 'categories',
    keyColumns: [
      { source: 'KategoriID', target: 'id', type: 'bigint', rule: 'PK korunur' },
      { source: 'KategoriID', target: 'legacy_id', type: 'bigint', rule: 'aynı' },
      { source: 'KategoriBASLIKTR', target: 'name_tr', type: 'text', rule: 'trim, null if empty' },
      { source: 'KategoriBASLIKEN', target: 'name_en', type: 'text', rule: 'trim' },
      { source: 'KategoriURL', target: 'slug', type: 'text', rule: 'snapshot' },
    ],
  },
  {
    sourceTable: 'dergiler',
    targetTable: 'journals',
    keyColumns: [
      { source: 'DergiID', target: 'id', type: 'bigint', rule: 'PK korunur' },
      { source: 'DergiBASLIK', target: 'title_tr', type: 'text', rule: 'urlYap → slug' },
      { source: 'Issn', target: 'issn', type: 'text', rule: 'normalize' },
      { source: 'Eissn', target: 'eissn', type: 'text', rule: 'normalize' },
      { source: 'KategoriID', target: 'category_id', type: 'bigint', rule: 'FK' },
      { source: 'Aktif', target: 'status', type: 'text', rule: '1=published' },
    ],
  },
  {
    sourceTable: 'dergi_arsiv',
    targetTable: 'issues',
    keyColumns: [
      { source: 'ArsivID', target: 'id', type: 'bigint', rule: 'PK korunur' },
      { source: 'DergiID', target: 'journal_id', type: 'bigint', rule: 'FK journals' },
      { source: 'Yil', target: 'year', type: 'int', rule: 'parse int' },
      { source: 'Sayi', target: 'issue_number', type: 'text', rule: 'label fallback' },
    ],
  },
  {
    sourceTable: 'makaleler',
    targetTable: 'articles',
    keyColumns: [
      { source: 'MakaleID', target: 'id', type: 'bigint', rule: 'PK korunur' },
      { source: 'DergiID', target: 'journal_id', type: 'bigint', rule: 'FK' },
      { source: 'ArsivID', target: 'issue_id', type: 'bigint', rule: 'FK nullable' },
      { source: 'TitleTR', target: 'title_tr', type: 'text', rule: 'required' },
      { source: 'Yazarlar', target: 'authors_raw', type: 'text', rule: 'parse ETL 04' },
      { source: 'PdfLINK', target: 'pdf_files', type: 'text', rule: 'ayrı tablo' },
    ],
  },
  {
    sourceTable: 'yazarlar',
    targetTable: 'authors',
    keyColumns: [
      { source: 'id', target: 'legacy_id', type: 'bigint', rule: 'canonical mysql-author:{id}' },
      { source: 'yazar', target: 'name', type: 'text', rule: 'registry only' },
    ],
  },
] as const
