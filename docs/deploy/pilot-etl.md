# Pilot ETL notları

## Varsayılan runtime

| Ayar | Varsayılan | Override |
|------|------------|----------|
| `ETL_BATCH_SIZE` | 200 | `--batch-size=` veya env |
| `ETL_TRANSACTION_TIMEOUT_MS` | 120000 | env |
| `ETL_TRANSACTION_MAX_WAIT_MS` | 15000 | env |

CLI: `npx tsx scripts/etl-pg/pilot-run.ts --write --article-limit=8000 --batch-size=200`

## Ölçek notu

8.000 makalelik pilot başarısı tam katalog kapasitesini **otomatik kanıtlamaz**.
Tam katalog için batch/timeout sunucu RAM ve disk ile ayarlanmalı; ayrı production gate gerekir.

## Slug çakışması

`lib/etl/article-slug-policy.ts` — düşük `legacy_id` sahibi makale base slug tutar; diğerleri `{slug}-{legacyId}` alır; gerekirse `url_aliases` 301.
