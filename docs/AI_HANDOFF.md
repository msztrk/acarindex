# AI Handoff — AcarIndex Web

Son güncelleme: 2026-06-27 (Faz 6C-Beta D1)

## Aktif branch

- `faz-6c-beta-d1` (UX: header/footer auth, hero ayarları, arama UI)

## Son tamamlanan işler

### Faz 6C-Beta D1 — Oturum ve ana sayfa UX

- Header/footer oturum durumu: sunucu `getServerSession()` → `initialAuth` prop; giriş yapmış kullanıcıda avatar + açılır menü.
- Ana sayfa hero başlık/alt metin: `site_settings` tablosu + `/admin/site-content`.
- Hero arama: birleşik container, `Ara` butonu + arama ikonu, `items-stretch` / `overflow-hidden`.
- `/hesabim` hizalama: önceki `account-panel-width` + lg grid (Beta C) korunuyor.

### Faz 6C-Beta C (önceki)

- Hesabım layout ortalama, responsive Playwright, beta pilot deploy.

## Migration notları

- `20260627120000_site_settings` — beta/pilot’da `prisma migrate deploy` gerekir (production’a bu görevde uygulanmadı).

## Ortamlar

| Ortam | URL |
|--------|-----|
| Beta pilot | `https://beta.acarindex.com` (Basic Auth) |
| Yerel rehearsal | `http://127.0.0.1:3001` |

## Test komutları

```bash
npm run lint
npm run build
npm test
npm run test:beta-responsive   # beta sunucuda faz6c-beta-c-responsive.sh
```

## Bilinen açık noktalar

- Beta C 24h soak tamamlanmadığında `FAZ_6C_BETA_C_OK` verilmez.
- ETL image rebuild gerekirse `docker compose build etl` (fixture script güncellemeleri).
