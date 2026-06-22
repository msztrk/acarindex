# Supabase kaldırma planı (onay sonrası)

**Durum:** Yerel PostgreSQL doğrulaması tamamlanmadan silme yapılmayacak.

## Kaldırılabilir npm paketleri (tam geçiş sonrası)

| Paket | Etki |
|---|---|
| `@supabase/supabase-js` | ETL legacy scriptleri; `scripts/etl/db.ts` |
| `@supabase/ssr` | Auth + `lib/supabase/server.ts` |

Auth PostgreSQL'e taşınmadan `@supabase/ssr` kaldırılamaz.

## Kaldırılabilir dosyalar (katalog okuma tamamlandıktan sonra)

- `lib/supabase/server.ts` (Auth ayrıldıktan sonra)
- `scripts/staging/*` (eski Supabase staging)
- `scripts/run-migration-*.ts` (Supabase direct PG)
- `types/database.ts` (Prisma tipleri ile değiştir)

## Korunacak (geçici)

- Auth route'ları (`app/auth/*`, login form)
- `SUPABASE_URL` / anon key (yalnızca Auth)

## Onay gerektiren adımlar

1. Tüm sayfa okumaları Prisma
2. ETL hedefi %100 Prisma
3. Auth alternatifi (NextAuth, Lucia, vb.)
4. `npm uninstall @supabase/supabase-js @supabase/ssr`
