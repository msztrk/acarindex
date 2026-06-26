# AI Handoff — AcarIndex Web

Son güncelleme: 2026-06-26 (Faz 6C-Beta D2.1 — final kabul)

## Aktif branch

- `redesign-v2`
- D2 feature branchleri korunuyor: `faz-6c-beta-d2`, `faz-6c-beta-d2-final`

## Son commit

| Ortam | SHA | Not |
|--------|-----|-----|
| `origin/redesign-v2` | `70f66db` | D2.1 kod merge; bu doküman commit'i sonrası yalnızca docs SHA ilerler |
| `origin/faz-6c-beta-d2-final` | `70f66db` | D2.1 final feature branch |
| Beta sunucu git HEAD | `70f66db` | temiz `redesign-v2` checkout, app rebuild |

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
