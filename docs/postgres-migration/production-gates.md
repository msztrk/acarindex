# Production ve beta geçiş kapıları

Sentetik fixture ile başarılı **yerel rehearsal** bu listedeki zorunlulukların yerine geçmez.

## Beta gerçek kullanıcı testi / canlıya açılmadan önce zorunlu

- [ ] Docker veri diski uygun konumda (C: taşması riski giderildi)
- [ ] MariaDB dump restore (salt okunur kaynak)
- [ ] Tam kaynak envanteri (`source:inventory`, `source:profile-authors`)
- [ ] 8.000 makalelik gerçek ETL pilotu
- [ ] Pilot idempotency (ikinci `--write`)
- [ ] Kaynak-hedef sayı karşılaştırması
- [ ] Gerçek PDF proxy ve legacy dosya erişimi
- [ ] `url_aliases` ve legacy redirect doğrulaması
- [ ] Dolu gerçek veriyle Supabase-off public rota turu
- [ ] Tam katalog ölçek planı (sitemap, performans)

## Faz 4 rehearsal ile doğrulanan (sentetik)

- Production Docker image build
- Migration deploy + idempotent tekrar
- Container healthcheck `/api/health`
- Backup + ayrı DB restore provası
- Restart dayanıklılığı (volume korunur)
- Beta noindex politikası taslağı

Bkz. [deferred-data-validation.md](./deferred-data-validation.md)
