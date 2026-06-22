# AcarIndex — production deployment checklist

## Ön koşullar

- [ ] Sunucuda Docker ve Docker Compose
- [ ] `beta.acarindex.com` DNS A kaydı sunucuya
- [ ] SSL (Certbot veya panel)
- [ ] `.env.production` (şablondan; gerçek değerler sunucuda)
- [ ] Kaynak MySQL yedeği restore (salt okunur ETL reader)
- [ ] Pilot ETL dry-run ve idempotency testi tamam

## Kurulum

1. `git clone` ve `redesign-v2` branch
2. `cp .env.production.example .env.production` ve düzenle
3. `docker compose -f docker-compose.production.yml up -d`
4. `docker compose exec app npx prisma migrate deploy`
5. Pilot ETL → tam ETL (PostgreSQL hedef)
6. Nginx reverse proxy + SSL
7. Healthcheck: `/` HTTP 200

## Doğrulama

- [ ] Ana sayfa, arama, dergi, makale, PDF proxy
- [ ] Sitemap ve robots.txt
- [ ] `robots: noindex` beta host'ta
- [ ] Yedek script cron

## Rollback

Bkz. `deploy/rollback-checklist.md`
