# Supabase legacy envanter (arşiv öncesi)

PostgreSQL geçişi tamamlanmadan Supabase paketleri ve scriptler **silinmedi**. Production yolundan ayrıldılar; pilot ETL ve restore sonrası arşivlenecek.

## Aktif kalması gereken (geçici)

| Dosya | Amaç |
|--------|------|
| `lib/supabase/server.ts` | Auth callback / geçici oturum |
| `app/auth/callback/route.ts` | OAuth callback |
| `app/auth/signout/route.ts` | Çıkış |
| `app/(site)/login/*` | Giriş — PG auth (`PgLoginForm`) veya legacy Supabase |
| `app/(site)/profile/page.tsx` | PG auth aktifken `/hesabim` yönlendirmesi |
| `app/(site)/hesabim/security` | Parola değişimi (PG auth) |
| `app/auth/callback/route.ts` | OAuth callback — PG giriş akışında kullanılmıyor |

## Legacy ETL / migration (çalıştırma — arşiv hedefi)

| Dosya / klasör | Not |
|-----------------|-----|
| `scripts/staging/*` | Supabase staging seed/snapshot |
| `scripts/etl/04-authors.ts`, `04-authors-pilot.ts` | Eski yazar ETL |
| `scripts/run-migration-013.ts` … `016.ts` | Supabase SQL uygulama |
| `scripts/run-migrations.ts` | Toplu migration runner |
| `lib/etl/run-authors-etl.ts`, `author-*.ts` | Supabase yazar reconcile |
| `supabase/migrations/*` | Eski SQL migration kaynağı |
| `scripts/test-stats.ts` | Supabase platform_stats test |

## Pilot PostgreSQL yolu (aktif — Supabase değil)

| Dosya | Amaç |
|--------|------|
| `scripts/etl-pg/pilot-run.ts` | Pilot ETL yazıcı |
| `scripts/etl-pg/pilot-dry-run.ts` | Pilot dry-run |
| `scripts/source/*` | MariaDB restore / envanter |

## Kaldırma sırası (restore + pilot ETL sonrası)

1. `USE_SUPABASE_DB` override ve staging scriptleri
2. `scripts/run-migration-*.ts` ve `supabase/migrations` (Prisma baseline tek kaynak)
3. Supabase ETL kütüphaneleri (`lib/etl/*` Supabase bağımlı)
4. `@supabase/*` paketleri (auth tamamen kaldırıldığında)

Bkz. [supabase-removal-plan.md](./supabase-removal-plan.md)
