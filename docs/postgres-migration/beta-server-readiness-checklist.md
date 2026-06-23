# Beta sunucu uygunluk kontrol listesi

Sunucuya bağlanmadan önce kullanıcıdan toplanacak bilgiler. **Secret veya özel anahtar raporlanmaz.**

## Sunucu kaynakları

- [ ] İşletim sistemi ve sürümü (ör. Ubuntu 22.04 / Debian 12)
- [ ] CPU çekirdek sayısı
- [ ] RAM (GB)
- [ ] Toplam disk ve boş alan (özellikle Docker veri diski)
- [ ] Docker ve Docker Compose sürümleri destekleniyor mu?

## Erişim

- [ ] SSH erişimi (host, port)
- [ ] SSH kullanıcısı ve sudo yetkisi
- [ ] Deployment kullanıcısı (non-root container uyumu)

## Web katmanı

- [ ] Nginx veya Apache mevcut mu?
- [ ] 80 ve 443 portları kullanılabilir mi?
- [ ] Mevcut `acarindex.com` aynı sunucuda mı?
- [ ] Firewall kuralları (ufw / cloud security group)

## DNS ve SSL

- [ ] `beta.acarindex.com` A/AAAA kaydı hedefi
- [ ] SSL yöntemi (Certbot, panel, wildcard)
- [ ] Production DNS değişikliği bu sprintte **yapılmayacak**

## Veri ve yedekleme

- [ ] Docker veri diski konumu (`docker_data.vhdx` veya `/var/lib/docker`)
- [ ] PostgreSQL backup hedef dizini (ör. `/var/backups/acarindex`)
- [ ] PDF / legacy dosya kökü (şimdilik `LEGACY_FILE_BASE_URL`)

## Ortam dosyaları (sunucuda oluşturulacak, Git dışında)

- [ ] `.env.production` şablondan (`deploy/.env.production.example`)
- [ ] `POSTGRES_PASSWORD`, `DATABASE_URL` app kullanıcısı
- [ ] Supabase katalog env **tanımsız** (`USE_SUPABASE_DB=0`)

## Ön koşul kapıları

Beta gerçek veri öncesi: [production-gates.md](./production-gates.md)
