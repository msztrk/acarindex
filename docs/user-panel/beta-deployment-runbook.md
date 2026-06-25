# Beta pilot — kullanıcı paneli deployment runbook

Bu runbook yalnızca **beta pilot** (`beta.acarindex.com` → `127.0.0.1:3002`, `docker-compose.pilot.yml`, `acarindex_pilot` PostgreSQL) için geçerlidir.

**Production’da çalıştırmayın:** canlı `acarindex.com`, `acarindex_prod_pg`, production MySQL, tam ETL veya Basic Auth kaldırma bu runbook kapsamında değildir.

## Script konumu

Tüm scriptler: `deploy/scripts/beta/`

| Script | Amaç |
|--------|------|
| `lib-pilot-guard.sh` | Pilot-only fail-closed guard (source) |
| `faz6b-beta-user-panel-deploy.sh` | Migration + app rebuild |
| `faz6b-beta-smoke.sh` | Katalog + kullanıcı paneli smoke |
| `faz6b-beta-post-backup.sh` | Post-deploy backup + restore-test |
| `faz6b-beta-restore-test.sh` | Tek backup dosyası restore-test |
| `faz6b2-cleanup-test-users.sh` | `@acarindex-beta.invalid` test kullanıcıları |
| `faz6b2-cleanup-smoke-artifacts.sh` | Smoke katalog/veri temizliği |

Backup script (paylaşılan): `deploy/scripts/faz6a1-beta-backup.sh`

## Ön kontroller

Sunucuda (`/opt/acarindex`, branch `redesign-v2`):

1. `git status` temiz (yalnızca beklenen deploy değişiklikleri)
2. `acarindex_pilot_pg` ve `acarindex_pilot_app` healthy
3. `curl -sf http://127.0.0.1:3002/api/health`
4. `https://beta.acarindex.com` kimlik doğrulamasız → 401
5. Disk alanı kritik değil
6. Hedef DB: `acarindex_pilot` (guard script doğrular)
7. Operasyonel onay kaydı mevcut

```bash
cd /opt/acarindex
git pull origin redesign-v2
docker compose --env-file /etc/acarindex/pilot.env -f docker-compose.pilot.yml ps
```

## Backup (migration öncesi)

```bash
bash deploy/scripts/faz6a1-beta-backup.sh pre_user_panel
```

Doğrula: exit 0, dosya boş değil, SHA-256 kaydı, parola loglanmadı.

## Migration

```bash
bash deploy/scripts/beta/faz6b-beta-user-panel-deploy.sh
```

İçerik: pre-backup → migrate (×2, no-op) → tablo/constraint kontrolü → katalog satır sayıları → app build → yalnızca `app` container yenileme.

Migration service kullanılır; app container içinde kontrolsüz `npx prisma` çalıştırılmaz.

Beklenen migration: `20260626100000_user_panel`

## Build

Deploy script içinde `docker compose build app` ve `--no-deps app` restart. PostgreSQL volume’a dokunulmaz.

## Smoke

Credential dosyası gerekli (parola loglanmaz):

```bash
# /root/.faz6a-admin-credentials — email= ve pass= satırları
bash deploy/scripts/beta/faz6b-beta-smoke.sh
```

Beklenen son satır: `FAZ6B_BETA_SMOKE_OK`

## Post-backup

```bash
bash deploy/scripts/beta/faz6b-beta-post-backup.sh post_user_panel
```

Doğrula: SHA-256, `articles=8000`, user-panel tabloları backup içinde, restore-test `acarindex_restore_test` üzerinde.

## Restore-test (ayrı)

```bash
bash deploy/scripts/beta/faz6b-beta-restore-test.sh /var/backups/acarindex-pilot/pilot_pg_post_user_panel_YYYYMMDD_HHMMSS.dump
```

Çalışan pilot volume’a restore **yapılmaz**.

## Rollback

Migration’ı geri almaya çalışmayın. Çalışan pilot volume’a backup restore etmeyin.

1. User-panel feature flag’lerini kapat (`ENABLE_USER_AUTH=0` vb. — pilot.env)
2. Önceki pilot app image tag’ine dön
3. Yalnızca `acarindex_pilot_app` yenile

Rollback tetikleyicileri: app unhealthy, `/api/health` başarısız, katalogda yaygın 500, auth bozuk, katalog sayıları değişti, ciddi IDOR/CSRF, Basic Auth veya noindex kaybı.

## Basic Auth ve noindex

```bash
curl -sS -o /dev/null -w '%{http_code}' https://beta.acarindex.com/          # 401
curl -sS -I https://beta.acarindex.com/ | grep -i x-robots-tag              # noindex, noarchive
curl -sS https://beta.acarindex.com/robots.txt | head -3                     # Disallow: /
```

## Faz 6B.2 temizlik (deployment sonrası)

```bash
bash deploy/scripts/beta/faz6b2-cleanup-smoke-artifacts.sh
bash deploy/scripts/beta/faz6b2-cleanup-test-users.sh
bash deploy/scripts/beta/faz6b-beta-post-backup.sh faz6b2_closeout
```

## Production’da çalıştırılmaması gerekenler

- `faz6b-beta-user-panel-deploy.sh` production compose üzerinde
- `pg_restore` çalışan pilot volume’a
- Backup dump dosyalarının Git’e eklenmesi
- Basic Auth veya noindex kaldırma
- Herkese açık kayıt / e-posta gönderimi / tam katalog ETL
