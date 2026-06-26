# AI Handoff — AcarIndex Web

Son güncelleme: 2026-06-26 (Faz 6C-Beta D3 — görsel denetim hazır)

## Aktif branch

- `faz-6c-beta-d3` (D3 çalışma branch'i; `redesign-v2` merge bekliyor — manuel onay sonrası)
- `redesign-v2` (D2.1 merged)
- D2 feature branchleri korunuyor: `faz-6c-beta-d2`, `faz-6c-beta-d2-final`

## Son commit

| Ortam | SHA | Not |
|--------|-----|-----|
| `origin/faz-6c-beta-d3` | `8b1bba5` | D3 suite + deploy script |
| D3 kod | `588ac9c` | Ortak görsel sistem + sayfa düzeltmeleri |
| `origin/redesign-v2` | `365f4f7` | D2.1 docs-only follow-up |
| D2.1 kod | `70f66db` | Ana sayfa D2.1 final |
| Beta sunucu (önceki) | `70f66db` | D3 deploy sonrası `faz-6c-beta-d3` SHA ile güncellenmeli |

## Faz 6C-Beta D3 — site geneli görsel denetim

**Durum: teknik hazır** (`FAZ_6C_BETA_D3_VISUAL_REVIEW_READY` — beta deploy + D3 Playwright sonrası doğrulanmalı)

- Branch tabanı: Strategy A — `origin/redesign-v2` (D2.1 merged)
- `redesign-v2` ile otomatik merge yapılmadı
- Production deploy yapılmadı

### Ortak düzeltmeler

- `AuthPageShell`, `SitePageHeader`, `CatalogPdfLink`
- `globals.css`: `catalog-list`, `catalog-pdf-badge`, `auth-page-*`, `catalog-empty-panel`
- Auth formları (login/register/forgot/reset) D2.1 token + wordmark
- Arama: SitePageHeader, catalog list, PDF badge, boş/sıfır sonuç paneli
- PDF viewer: mobil `100dvh` yükseklik, boş durum paneli
- Hesabım: serif başlık, nav aktif durumu teal vurgu

### Test / deploy

| Öğe | Yol |
|-----|-----|
| D3 Playwright | `tests/beta-d3-visual-acceptance.spec.ts` |
| Config | `playwright.beta-d3.config.ts` |
| Beta visual script | `deploy/scripts/beta/faz6c-beta-d3-visual.sh` |
| Beta deploy script | `deploy/scripts/beta/faz6c-beta-d3-deploy.sh` |
| Galeri | `docs/visual-audit/d3/index.html` |
| Screenshot dizini (beta) | `/var/log/acarindex-d3-visual-review/` |

### Yerel doğrulama

| Test | Sonuç |
|------|--------|
| `npm test` | 335 passed, 10 skipped |
| `npm run lint` | 0 error |
| `npm run build` | OK |

### Sonraki adım

1. Beta: `git fetch && git checkout faz-6c-beta-d3 && git reset --hard origin/faz-6c-beta-d3`
2. `bash deploy/scripts/beta/faz6c-beta-d3-deploy.sh`
3. Smoke, D1, D2.1, D3, Beta C responsive
4. Manuel görsel onay → `redesign-v2` merge (fast-forward veya PR)

## Faz 6C-Beta D2.1 — final görsel kabul

**Durum: PASS** (`FAZ_6C_BETA_D2_1_FINAL_OK`)

- Manuel görsel kabul: PASS
- Merge: `faz-6c-beta-d2-final` → `redesign-v2`, fast-forward only
- Production deploy yapılmadı
- Migration çalıştırılmadı
- Volume silinmedi; `down -v` / prune kullanılmadı

### Görsel kimlik kararı

- D2.1, D2 yönünü korur: akademik, kurumsal, modern, içerik odaklı ana sayfa.
- Raster/eski düşük çözünürlüklü logo kullanılmaz.
- Header ve footer için tipografik `AcarIndex` wordmark kullanılır.
- Merkezi lacivert + teal token sistemi korunur; altın yalnızca sınırlı vurgu token'ı olarak kalır.
- Mobil rafinasyon: hero yüksekliği, stats yüzeyi, popüler aramalar chip'leri, makale listesi dış kart ağırlığı ve footer yüksekliği sıkılaştırıldı.

### Beta doğrulama (temiz `redesign-v2` deploy sonrası)

| Test | Sonuç |
|------|--------|
| `/api/health` | ready, database ok |
| App container | healthy |
| PostgreSQL container | healthy |
| MariaDB kaynak container | healthy |
| Beta smoke | `FAZ6B_BETA_SMOKE_OK` |
| D1 Playwright | 6/6 `D1_VISUAL_PLAYWRIGHT_OK` |
| D2.1 Playwright | 4/4 `D2_VISUAL_PLAYWRIGHT_OK` |
| Beta C responsive | 9/9 `RESPONSIVE_PLAYWRIGHT_OK` |
| Yerel `npm test` | 335 passed, 10 skipped |
| Yerel `npm run lint` | 0 error, mevcut 19 warning |
| Yerel `npm run build` | OK |

### Screenshot (beta)

`/var/log/acarindex-d2-1-visual-shots/`

Önemli dosyalar:

- `d2-1-home-mobile-fullpage-375.png`
- `d2-1-header-mobile-375.png`
- `d2-1-hero-mobile-375.png`
- `d2-1-article-list-mobile-375.png`
- `d2-1-footer-mobile-375.png`
- `d2-1-home-desktop-1366.png`
- `d2-1-home-fullpage-desktop-1366.png`
- `d2-1-hero-desktop-1366.png`
- `d2-1-right-rail-desktop-1366.png`
- `d2-1-mobile-metrics.json`

### Kalan küçük not

- Mobil arama placeholder metni çok dar ekranda kısalabiliyor; blokör değildir.

### Sonraki önerilen faz

- Faz 6C-Beta E: onaylı görsel kimliği bozmadan içerik sayfaları ve arama sonuçları için aynı token/spacing disiplinini kontrollü uygulamak.

## Faz 6C-Beta D2 — görsel kimlik

**Durum: superseded by D2.1** — ilk D2 beta deploy + smoke + D1 regresyon 6/6

### Beta doğrulama (deploy sonrası)

| Test | Sonuç |
|------|--------|
| `/api/health` | ready |
| Beta smoke | `FAZ6B_BETA_SMOKE_OK` |
| D1 Playwright | 6/6 `D1_VISUAL_PLAYWRIGHT_OK` |

### Screenshot (repo)

`/var/log/acarindex-d2-visual-shots/`

### Test komutları

```bash
npm run lint && npm run build && npm test
npx playwright test --config=playwright.beta-d2.config.ts
```

## Faz 6C-Beta D1 — kesin kapanış

**PASS** (`FAZ_6C_BETA_D1_FINAL_OK`)

## Ortamlar

| Ortam | URL |
|--------|-----|
| Beta pilot | `https://beta.acarindex.com` (Basic Auth) |
| Yerel | `http://127.0.0.1:3000` |

## Açık riskler

- Beta C 24h soak tamamlanmadı.
- Production deploy yapılmadı.
- Global link rengi (`a:hover` accent) diğer sayfalarda gözden geçirilebilir.
- D2.1 feature branchleri bilinçli olarak silinmedi; ayrı temizlik göreviyle ele alınacak.
