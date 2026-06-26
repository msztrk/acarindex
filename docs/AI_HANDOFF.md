# AI Handoff — AcarIndex Web

Son güncelleme: 2026-06-27 (Faz 6C-Beta D2 — görsel kimlik / ana sayfa polish)

## Aktif branch

- `redesign-v2` (D1 merge + D2 UI polish yerelde)

## Son commit (D1 kapanış)

| Ortam | SHA | Not |
|--------|-----|-----|
| `origin/redesign-v2` | `8e8196b` | D1 docs handoff |
| D1 uygulama kodu | `576457f` | overflow fix + kabul suite |

## Faz 6C-Beta D2 — görsel kimlik (devam ediyor)

**Durum:** Yerel polish tamamlandı; beta deploy bu görevde yapılmadı.

### Yapılanlar

- D2 renk token sistemi (`globals.css`: brand-primary, accent, surface, vb.)
- `BrandWordmark` — monogram + tipografik wordmark
- Header/footer polish (sticky, shadow, nav active)
- Hero gradient, istatistik kartları, arama kapsamı linkleri
- Popüler aramalar / öne çıkan dergiler / konu alanları kartları
- Makale listesi hover ve PDF badge rafine
- `tests/d2-visual-screenshots.spec.ts` + `playwright.d2-visual.config.ts`

### Screenshot dizini (yerel)

`docs/screenshots/faz6c-d2/`

### Test komutları

```bash
npm run lint && npm run build && npm test
npx playwright test --config=playwright.d2-visual.config.ts
```

## Faz 6C-Beta D1 — kesin kapanış

**PASS** (`FAZ_6C_BETA_D1_FINAL_OK`)

## Ortamlar

| Ortam | URL |
|--------|-----|
| Beta pilot | `https://beta.acarindex.com` (Basic Auth) |
| Yerel | `http://127.0.0.1:3000` |

## Açık riskler

- D2 değişiklikleri henüz `origin`’e push / beta deploy edilmedi.
- Beta C 24h soak tamamlanmadı.
- Production deploy yapılmadı.
