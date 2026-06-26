# AI Handoff — AcarIndex Web

Son güncelleme: 2026-06-27 (Faz 6C-Beta D1 — KESİN KAPANIŞ)

## Aktif branch

- `redesign-v2` (D1 merge tamamlandı; beta bu branch’ten deploy)

## Son commit

| Ortam | SHA | Branch |
|--------|-----|--------|
| `origin/redesign-v2` | `576457f` | `fix(responsive): prevent mobile header overflow and add D1 acceptance suite` |
| Beta sunucu git HEAD | `576457f` | `redesign-v2` |
| Önceki D1 feature commit | `c3b4e91` | header/footer auth, hero CMS, search bar |

## Faz 6C-Beta D1 — kesin kapanış

**Durum: PASS** (`FAZ_6C_BETA_D1_FINAL_OK`)

### Tamamlanan işler

1. **Oturum UX (`c3b4e91`)** — Header/footer `initialAuth`; hero `site_settings`; arama UI düzeltmesi.
2. **Mobil overflow fix (`576457f`)** — Menü butonu `shrink-0`; compact misafir auth yatay düzen.
3. **Kabul altyapısı** — `tests/beta-d1-visual-acceptance.spec.ts`, `playwright.beta-d1.config.ts`, `deploy/scripts/beta/faz6c-beta-d1-visual.sh`.

### Migration

- `20260627120000_site_settings` — beta pilot’ta uygulandı (destructive tekrar çalıştırılmadı).

### Beta test sonuçları (temiz `576457f` deploy sonrası)

| Test | Sonuç |
|------|--------|
| `npm test` (yerel) | 335 passed, 10 skipped |
| `npm run lint` | 0 error |
| `npm run build` | PASS |
| Beta smoke | `FAZ6B_BETA_SMOKE_OK` |
| D1 Playwright | 6/6 — `D1_VISUAL_PLAYWRIGHT_OK` |
| Beta C responsive | 9/9 — `RESPONSIVE_PLAYWRIGHT_OK` |
| 375px overflow | `scrollWidth === viewport` |

### Screenshot dizini (beta)

`/var/log/acarindex-d1-visual-acceptance/` — 8 dosya (önceki kabul çalışmasından; temiz deploy sonrası testler PASS).

### Ortamlar

| Ortam | URL |
|--------|-----|
| Beta pilot | `https://beta.acarindex.com` (Basic Auth, noindex) |
| Yerel rehearsal | `http://127.0.0.1:3001` |

### Test komutları

```bash
npm run lint && npm run build && npm test
# Beta sunucuda:
bash deploy/scripts/beta/faz6c-beta-d1-visual.sh
bash deploy/scripts/beta/faz6c-beta-c-responsive.sh
bash deploy/scripts/beta/faz6b-beta-smoke.sh
```

## Açık riskler / sonraki adımlar

- **Beta C 24h soak** tamamlanmadığında faz C için tam `FAZ_6C_BETA_C_OK` verilmez (D1 kapsamı dışı).
- **Production deploy** yapılmadı; `redesign-v2` production’a merge/deploy ayrı faz.
- Beta admin şifresi smoke/Playwright öncesi `/root/.faz6a-admin-credentials` ile senkron olmalı (`deploy/scripts/faz6a-beta-fix-creds.sh` gerekirse).
- ETL image güncellemesi fixture script değişikliklerinde `docker compose build etl`.

## Önerilen sonraki faz

- Production öncesi: `redesign-v2` → staging/production branch stratejisi, migration planı (`site_settings`), pilot→prod deploy runbook.
- İsteğe bağlı: Beta C 24h soak tamamlama, popüler arama / i18n (D1 kapsamı dışı).
