# Auth mimarisi — PostgreSQL-native (Faz 6A)

## Özet

AcarIndex üyelik ve yönetim paneli **standart PostgreSQL** üzerinde çalışır. Bibliyografik `authors` tablosu ile **birleştirilmez**; uygulama kullanıcıları `users` tablosunda tutulur. `author_claims` gelecekteki yazar sahiplenme için taslak olarak eklendi.

## Geçici Supabase Auth

Mevcut `lib/supabase/*` ve `LoginForm.tsx` (Supabase) **silinmedi**. `USE_PG_AUTH=1` veya `ENABLE_USER_AUTH=1` ile PostgreSQL girişi (`PgLoginForm`) tercih edilir. Tam kaldırma ayrı sprint.

## Oturum

- Rastgele session token → SHA-256 hash `sessions` tablosunda
- Cookie: `acarindex_session` (HttpOnly, Secure prod, SameSite=Lax)
- CSRF: `acarindex_csrf` + `x-csrf-token` header (state-changing istekler)
- Süre: 14 gün (`SESSION_TTL_MS`)

## Parola

- bcrypt (12 rounds)
- Min 12 karakter, büyük/küçük/rakam
- Reset/verify token süreleri: 1 saat / 24 saat — Faz 6C akışları tamamlandı ([lifecycle.md](./lifecycle.md))

## Faz 6C lifecycle flag’leri

| Env | Varsayılan |
|-----|------------|
| `ENABLE_PUBLIC_REGISTRATION` | kapalı |
| `ENABLE_EMAIL_VERIFICATION` | kapalı |
| `ENABLE_PASSWORD_RESET` | kapalı |
| `EMAIL_PROVIDER` | `console` |

Detay: [lifecycle.md](./lifecycle.md)

## Feature flag (6A)

| Env | Varsayılan | Açıklama |
|-----|------------|----------|
| `ENABLE_USER_AUTH` | kapalı | Sunucu auth |
| `NEXT_PUBLIC_ENABLE_USER_AUTH` | kapalı | Client nav |
| `ENABLE_ADMIN_PANEL` | kapalı | `/admin` |
| `NEXT_PUBLIC_ENABLE_ADMIN_PANEL` | kapalı | Admin link |
| `USE_PG_AUTH` | — | PG login formu |

Değer: `1` (string). `false` etkinleştirmez.

## Bootstrap SUPER_ADMIN

```bash
BOOTSTRAP_ADMIN_EMAIL=admin@example.com \
BOOTSTRAP_CONFIRM=1 \
npx tsx scripts/auth/bootstrap-super-admin.ts
```

Yalnızca hiç SUPER_ADMIN yoksa çalışır; parola loglanmaz.

## Deployment sınırı (Faz 6A)

Beta canlı DB’ye migration uygulanmadı. Rehearsal PostgreSQL üzerinde `prisma migrate deploy` ile doğrulanmalı.
