# ETL Scripts — MySQL → Supabase

Bu dizin Acarindex legacy MySQL veritabanından Supabase PostgreSQL'e veri aktarımı için ETL scriptlerini içerir.

## Kullanım

```bash
# Tüm tabloları sırayla aktar (önerilen)
npx tsx scripts/etl/run-all.ts

# Sadece dergiler
npx tsx scripts/etl/01-journals.ts

# Sadece sayılar
npx tsx scripts/etl/02-issues.ts

# Sadece makaleler (çok sayıda kayıt; batch işler)
npx tsx scripts/etl/03-articles.ts

# Yazarlar + junction
npx tsx scripts/etl/04-authors.ts
```

## Ön koşullar

`.env.local` dosyasında şu değişkenler dolu olmalı:

```
MYSQL_HOST=
MYSQL_PORT=3306
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

## Sıra önemli

1. `01-journals.ts` — categories → journals
2. `02-issues.ts` — dergi_arsiv → issues
3. `03-articles.ts` — makaleler → articles + pdf_files
4. `04-authors.ts` — yazarlar → authors + article_authors

## Notlar

- Scriptler idempotent'tir: aynı `legacy_id` için `upsert` kullanır.
- Her script ilerlemeyi konsola basar.
- Büyük tablolar (articles) `BATCH_SIZE` (varsayılan 500) kayıt batchlerle aktarılır.
