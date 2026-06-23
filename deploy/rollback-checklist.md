# Rollback checklist (simülasyon — DNS/sunucu değişikliği bu sprintte yapılmaz)

## Uygulama image geri alma

1. Önceki image tag'ini kaydet: `APP_IMAGE_TAG=previous` veya `docker tag acarindex-web:previous acarindex-web:latest`
2. `docker compose -f docker-compose.production.yml pull` (registry kullanılıyorsa)
3. `docker compose -f docker-compose.production.yml up -d app`
4. `GET /api/health` → `status: ready` doğrula

## Migration sonrası uygulama rollback riski

- Prisma migration **geri alınamaz** otomatik olarak; down migration yoksa DB snapshot gerekir
- Uygulama eski image'a dönse bile yeni şema ile uyumsuzluk riski — **migration öncesi PG snapshot zorunlu**
- Rollback sırası: (1) app eski image, (2) gerekirse DB snapshot restore, (3) healthcheck

## Veritabanı geri yükleme

1. Bakım modu / trafiği kes (Nginx maintenance veya app stop)
2. `deploy/scripts/backup-db.sh` ile en son dump'ı doğrula
3. `deploy/scripts/restore-db.sh /path/to/dump.dump` (sunucuda `DATABASE_URL` hedef)
4. `npx prisma migrate deploy` — şema uyumu kontrol
5. App başlat, smoke test

## Nginx upstream

1. `upstream acarindex_app` → eski container portuna yönlendir (genelde aynı 127.0.0.1:3000)
2. `nginx -t && systemctl reload nginx`
3. Beta host noindex politikası korunur ([beta-security-policy.md](../docs/postgres-migration/beta-security-policy.md))

## Healthcheck başarısızlığı

1. `docker compose logs app --tail 200`
2. `docker compose exec postgres pg_isready`
3. `DATABASE_URL` ve migration durumu
4. Gerekirse app restart; devam ederse image rollback + DB snapshot değerlendir

## DNS geri dönüş (yalnızca DNS değiştirildiyse)

1. `beta.acarindex.com` A kaydını önceki hedefe al
2. TTL propagasyonu bekle
3. Eski stack healthcheck

## ETL partial run

- Hedef PostgreSQL snapshot'tan restore
- Kaynak MySQL'e **yazılmadığını** doğrula
- ETL run log (`etl_runs`) incele
