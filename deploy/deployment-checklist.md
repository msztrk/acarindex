# AcarIndex — production deployment checklist



## Ön koşullar



- [ ] Sunucuda Docker ve Docker Compose

- [ ] `beta.acarindex.com` DNS A kaydı sunucuya (deploy öncesi onay)

- [ ] SSL (Certbot veya panel)

- [ ] `.env.production` sunucuda (Git dışında; şablon: `deploy/.env.production.example`)

- [ ] Ertelenen veri doğrulaması tamam: MariaDB restore, pilot ETL, idempotency ([deferred-data-validation.md](../docs/postgres-migration/deferred-data-validation.md))

- [ ] Kaynak MySQL yedeği restore (salt okunur ETL reader)



## Ortam ayrımı



| Ortam | `NEXT_PUBLIC_SITE_URL` | Robots | Katalog DB |

|--------|-------------------------|--------|------------|

| Beta | `https://beta.acarindex.com` | disallow all | PostgreSQL (hedef) |

| Production | `https://www.acarindex.com` | allow + sitemap | PostgreSQL |



Secret'lar (`DATABASE_URL`, `POSTGRES_PASSWORD`, Supabase keys) **yalnızca sunucu env** — commit edilmez.



## Yerel rehearsal (Faz 4)

Sentetik veriyle production-benzeri prova — beta deploy değil:

```powershell
npm run rehearsal:all
# veya adım adım: rehearsal:build, migrate, seed, up, smoke, backup
```

- Compose: `docker-compose.rehearsal.yml`, proje `acarindex-rehearsal`
- App: `http://127.0.0.1:3001` — `acarindex_dev` volume’una dokunmaz
- Kök `.env` ile karışmayı önlemek için postgres kimlik bilgileri compose içinde sabit
- Bkz. [production-gates.md](../docs/postgres-migration/production-gates.md)

## Kurulum



1. `git clone` ve hedef branch

2. `cp deploy/.env.production.example .env.production` ve düzenle

3. `docker compose -f docker-compose.production.yml up -d --build`

4. Migration (aşağıdaki politika)

5. ETL (pilot → tam) — PostgreSQL hedef

6. Nginx reverse proxy + SSL (`deploy/nginx/beta.acarindex.com.conf.example`)

7. Healthcheck: `GET /api/health` → `{"status":"ready"}`



## Migration politikası



**Önerilen:** Deploy sırasında **manuel** `prisma migrate deploy` (bakım penceresi, rollback kontrolü).



```bash

docker compose -f docker-compose.production.yml exec app npx prisma migrate deploy

```



**Otomatik migration** (container start hook) yalnızca tek instance ve snapshot yedek sonrası değerlendirilir; varsayılan **kapalı**.



## Readiness ve healthcheck



| Endpoint | Amaç |

|----------|------|

| `GET /api/health` | PostgreSQL `SELECT 1` + `DATABASE_URL` yapılandırması |

| Docker `HEALTHCHECK` | `/api/health` (503 = not_ready) |

| Postgres `pg_isready` | Volume servisi |



## Yedekleme



- **Volume:** `pg_data` düzenli snapshot (hypervisor veya `docker run --rm -v pg_data`)

- **Günlük PostgreSQL:** `deploy/scripts/backup-db.sh` cron (ör. 02:00)

- Restore: `deploy/scripts/restore-db.sh`



## Operasyon



- [ ] `restart: unless-stopped` (app + postgres)

- [ ] Log rotation: Docker `json-file` max-size/max-file veya host logrotate

- [ ] Beta host `robots: disallow` doğrulandı

- [ ] Rollback planı: `deploy/rollback-checklist.md`



## Doğrulama



- [ ] Ana sayfa, arama, dergi, makale, PDF proxy

- [ ] Sitemap ve robots.txt (canonical host)

- [ ] Boş/hata durumları (DB kesintisi simülasyonu)



## Rollback



Bkz. `deploy/rollback-checklist.md`


