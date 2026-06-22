# Supabase → Standart PostgreSQL Bağımlılık Raporu

**Tarih:** 2026-06-22  
**Branch:** `redesign-v2`  
**Hedef:** Next.js + Prisma + `DATABASE_URL` (provider-agnostic PostgreSQL)

---

## Özet

| Kategori | Dosya sayısı (yaklaşık) | Aksiyon |
|---|---|---|
| Supabase DB client (app reads) | ~20 | B → Prisma `lib/data` |
| Supabase ETL admin | ~15 script | B → Prisma ETL hedefi |
| Supabase Auth | 4 | A (geçici koru) |
| Supabase Storage | 0 | C (kullanılmıyor) |
| Supabase Realtime | 0 | C |
| Supabase RPC / Edge | 0 | C |
| Supabase özel SQL (RLS) | 19 migration | B (baseline’da opsiyonel) |
| Prisma | 0 → yeni | B (oluşturuluyor) |
| Vercel özel | 0 | — |

---

## A. Silinmeden korunabilecek kodlar

| Bileşen | Konum | Not |
|---|---|---|
| Supabase Auth (login/register/OAuth) | `app/(site)/login/LoginForm.tsx`, `app/auth/*` | Kullanıcı hesabı pilot aşamada Supabase’de kalabilir |
| `lib/supabase/server.ts` | Geçici | Auth + fallback okuma |
| `types/database.ts` | Geçici | Supabase tip tanımları |
| Staging snapshot araçları | `scripts/staging/*` | Eski pilot ortamı; yeni staging’de kullanılmayacak |
| Kaynak MySQL araçları | `scripts/source/*` | Salt okunur kaynak; hedeften ayrı |

---

## B. Standart PostgreSQL / Prisma ile değiştirilmesi gereken kodlar

### Uygulama okuma katmanı

| Dosya | Kullanım |
|---|---|
| `lib/home/data.ts` | `platform_stats`, `articles`, `journals` |
| `lib/search/search.ts` | Arama sorguları |
| `app/(site)/journals/**` | journals, issues, articles |
| `app/(site)/[journalSlug]/[articleSlugAndId]/page.tsx` | article detay |
| `app/(site)/authors/[slugAndId]/page.tsx` | author profil |
| `app/(site)/pdfs/[id]/page.tsx` | PDF metadata |
| `app/(site)/istatistikler/page.tsx` | stats |
| `app/api/pdf-proxy/[id]/route.ts` | pdf_files |
| `app/api/search-suggest/route.ts` | suggest |
| `app/sitemap*.ts` | sitemap üretimi |

**Hedef:** `lib/data/*` + Prisma; `DATABASE_URL` varsa Prisma, yoksa geçici Supabase fallback.

### ETL hedef katmanı

| Dosya | Kullanım |
|---|---|
| `scripts/etl/db.ts` | `getSupabaseAdmin()`, batch upsert |
| `scripts/etl/01-journals.ts` … `04-authors.ts` | Supabase yazma |
| `lib/etl/run-authors-etl.ts` | Supabase client tipi |
| `lib/etl/author-upsert.ts` | Supabase upsert |
| `lib/etl/author-reconcile.ts` | Supabase okuma |

**Hedef:** `scripts/etl-pg/*` + `lib/etl/target/prisma.ts`; audit `etl_runs` / `etl_errors` Prisma üzerinden.

### Bağlantı yapılandırması

| Dosya | Sorun |
|---|---|
| `scripts/lib/database-url.ts` | `SUPABASE_DB_URL` öncelikli |
| `.env.example` | Supabase-centric |

**Hedef:** `DATABASE_URL` birincil; `SOURCE_DATABASE_URL` / `SOURCE_MYSQL_URL` kaynak için.

### Migration’lar

`supabase/migrations/*.sql` — standart PostgreSQL baseline’a konsolide edilecek. Supabase’e özel parçalar:

- `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY` (004, 012) — uygulama katmanında yetkilendirme ile değiştirilebilir
- `CREATE INDEX CONCURRENTLY` (006) — Prisma migrate’de CONCURRENTLY kullanılmaz
- `auth.users` referansları (008) — Auth ayrı kalırsa gerekmez
- `SECURITY DEFINER` fonksiyonlar (014, 016) — `platform_stats` view ile değiştirildi

---

## C. Şu anda kullanılmayan Supabase kodları

| Bileşen | Not |
|---|---|
| Supabase Storage | PDF Faz-1 legacy proxy kullanıyor |
| Supabase Realtime | Yok |
| Edge Functions | Yok |
| `scripts/run-migration-*.ts` | Eski Supabase doğrudan PG scriptleri |
| `scripts/staging/*` | Yeni sunucu staging’e taşınmayacak |

---

## D. Taşınmayı engelleyen kritik bağımlılıklar

| # | Engel | Çözüm |
|---|---|---|
| 1 | **Prisma henüz yoktu** | `prisma/schema.prisma` + baseline migration |
| 2 | **Yerel PostgreSQL/Docker yok** | Kurulum rehberi + `docker-compose.local.yml`; ETL yazma bekler |
| 3 | **Tüm sayfalar doğrudan Supabase client** | `lib/data` abstraction katmanı |
| 4 | **Auth Supabase’de** | Geçici: Auth Supabase, katalog PostgreSQL (hibrit) veya auth devre dışı beta |
| 5 | **`platform_stats` VIEW** | Prisma `$queryRaw` veya materialized refresh job |
| 6 | **`search_vector` GENERATED** | Prisma schema’da desteklenir; arama ILIKE ile devam |
| 7 | **ETL 15+ script Supabase upsert** | Pilot ETL Prisma hedefi önce |

---

## Ortam değişkenleri envanteri

| Değişken | Sınıf | Yeni durum |
|---|---|---|
| `DATABASE_URL` | Hedef PG | **Birincil** |
| `SOURCE_DATABASE_URL` / `SOURCE_MYSQL_URL` | Kaynak MySQL | Salt okunur kaynak |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Auth geçici |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Auth geçici |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | ETL legacy / staging |
| `SUPABASE_DB_URL` | Supabase PG | Kaldırılacak (→ `DATABASE_URL`) |
| `USE_PRISMA` / `DATABASE_PROVIDER` | Uygulama | `postgres` seçimi |

---

## Sonraki kod değişiklik sırası

1. Prisma schema + baseline migration
2. `lib/db` + `lib/data`
3. Sayfa okuma migrasyonu (DATABASE_URL modu)
4. Pilot ETL Prisma hedefi
5. Auth ayrıştırma (opsiyonel Faz-2)
6. Supabase paket kaldırma (onay sonrası)
