# PostgreSQL geçişi **Faz 3** kapsamında yerel MariaDB restore ve gerçek pilot ETL aşamaları **disk ve Docker konumu** nedeniyle ertelendi. Bu belge, tamamlanmadan production-ready kabul edilmeyecek doğrulamaları ve devam komutlarını kaydeder.

**İlgili:** [Supabase legacy envanter](./supabase-legacy-inventory.md) · [Kullanıcı paneli sınırı](./user-panel-boundary.md)

## Erteleme nedeni

| Koşul | Durum (son kontrol) |
|--------|---------------------|
| Docker WSL disk image | `C:\Users\hp\AppData\Local\Docker\wsl\disk\docker_data.vhdx` (C: üzerinde) |
| C: boş alan | ~1,7 GB (**≥8 GB gerekli**) |
| D: boş alan | ~61 GB (yeterli) |

Restore sırasında WSL `docker_data.vhdx` genişleyeceği için veri fiilen **C:** diskinde tutulur. Talimat: disk image C: üzerindeyse restore başlatılmaz.

## Yapılmayan doğrulamalar

Aşağıdakiler **yapılmadı** ve Faz 3 tamamlanmış sayılmaz:

- [ ] MariaDB dump restore (`npm run source:restore`)
- [ ] Salt okunur ETL kullanıcı (`npm run local:create-etl-reader`)
- [ ] Tam kaynak envanteri (`npm run source:inventory`, `source:profile-authors`)
- [ ] Pilot dry-run (`npm run etl:pilot-dry-run`)
- [ ] 8.000 makalelik pilot PostgreSQL yazma (`npm run etl:pilot-run -- --write`)
- [ ] İdempotency testi (ikinci `--write` çalıştırma)
- [ ] Dolu veriyle Supabase-off public rota turu
- [ ] Kaynak-hedef sayı karşılaştırması (gerçek veri)
- [ ] Tam sitemap performansı (gerçek kayıt sayıları)

**Bu doğrulamalar tamamlanmadan PostgreSQL geçişi production-ready kabul edilmeyecek.**

## Korunan durum

- Prisma baseline migration yerel `acarindex_dev` üzerinde uygulandı (Faz 3 öncesi).
- Docker named volume'lar (`acarindex_pg_data`, `acarindex_mysql_source_data`) **silinmedi**.
- Dump dosyası: `D:\acarindex\acarinde_yeniacarindex.sql` (dokunulmadı).

## Daha sonra devam — kesin sıra

Ön koşullar (her restore öncesi):

1. Docker disk image **D:** (veya ≥40 GB boş disk) üzerinde; `docker_data.vhdx` C: altında **olmamalı**.
2. C: ≥8 GB boş alan.
3. D: (veya Docker veri diski) ≥40 GB boş alan.

Komut sırası:

```bash
# 1. Servisleri başlat
docker compose --env-file .env.local -f docker-compose.local.yml --profile source up -d

# 2. Servis sağlığı
docker compose --env-file .env.local -f docker-compose.local.yml ps

# 3. Restore (yalnızca 127.0.0.1:3307)
npm run source:restore

# 4. Salt okunur kaynak kullanıcı
npm run local:create-etl-reader

# 5. Tam envanter
npm run source:inventory
npm run source:profile-authors

# 6. Pilot dry-run
npm run etl:pilot-dry-run -- --mysql-only --article-limit=8000
npm run etl:pilot-dry-run -- --article-limit=8000

# 7. Pilot yazma (hedef: 127.0.0.1:5432 / acarindex_dev)
npm run etl:pilot-run -- --write --article-limit=8000

# 8. İdempotency
npm run etl:pilot-run -- --write --article-limit=8000

# 9. Supabase-off runtime (USE_SUPABASE_DB=0, auth flag kapalı)
npm run dev
# Rota turu: /, /search, /journals, makale/dergi/yazar detay, PDF, istatistikler, sitemap, robots, 404

# 10. Kalite
npx prisma validate && npx tsc --noEmit && npx vitest run && npm run lint && npm run build
```

Servisleri güvenli durdurma (volume korunur):

```bash
docker compose --env-file .env.local -f docker-compose.local.yml --profile source stop
```

**Kullanmayın:** `docker compose down -v`, volume silme, dump taşıma/silme.

## İlgili belgeler

- [Yerel kurulum](./local-setup.md)
- [Bağımlılık raporu](./dependency-report.md)
- [Supabase kaldırma planı](./supabase-removal-plan.md)
- Faz 2 / Faz 3 sohbet raporları: branch `redesign-v2`, commit `e381845` … `a3f6700`

## Bu sprintte yapılan alternatif işler

Restore gerektirmeyen: UI boş/hata durumları, data layer sözleşmeleri, development seed altyapısı (çalıştırılmadan), mock testler, SEO/URL testleri, deployment dokümantasyonu güçlendirme.
