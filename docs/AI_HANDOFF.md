# AI Handoff — AcarIndex Web

Son güncelleme: 2026-06-27 (Faz 6C-Beta D2 — deploy)

## Aktif branch

- `faz-6c-beta-d2` / `redesign-v2` (aynı tip: `a7f8c13`)

## Son commit

| Ortam | SHA | Not |
|--------|-----|-----|
| `origin/redesign-v2` | `a7f8c13` | D2 görsel kimlik + ana sayfa polish |
| `origin/faz-6c-beta-d2` | `a7f8c13` | aynı commit |
| Beta sunucu git HEAD | `a7f8c13` | `redesign-v2` checkout, app rebuild |

## Faz 6C-Beta D2 — görsel kimlik

**Durum: PASS** (`FAZ_6C_BETA_D2_OK`) — beta deploy + smoke + D1 regresyon 6/6

### Beta doğrulama (deploy sonrası)

| Test | Sonuç |
|------|--------|
| `/api/health` | ready |
| Beta smoke | `FAZ6B_BETA_SMOKE_OK` |
| D1 Playwright | 6/6 `D1_VISUAL_PLAYWRIGHT_OK` |

### Screenshot (repo)

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

- Beta C 24h soak tamamlanmadı.
- Production deploy yapılmadı.
- Global link rengi (`a:hover` accent) diğer sayfalarda gözden geçirilebilir.
