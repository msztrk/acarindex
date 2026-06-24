# Beta pilot — Faz 6B user panel migration planı (uygulama bu sprintte YAPILMAZ)

## Ön koşullar

- Faz 6B.1 commit’leri `origin/redesign-v2` üzerinde push edilmiş
- Rehearsal PostgreSQL’de migration ve kabul testleri yeşil
- Açık operasyonel onay (bu doküman onay değildir)

## 1. Migration öncesi backup (pilot PostgreSQL)

```bash
# Pilot sunucuda — örnek
docker compose --env-file /etc/acarindex/pilot.env -f docker-compose.pilot.yml \
  exec -T postgres pg_dump -U acarindex_pilot -Fc -f /tmp/pilot_pre_faz6b.dump acarindex_pilot
docker cp acarindex_pilot_pg:/tmp/pilot_pre_faz6b.dump ./pilot_pre_faz6b_YYYYMMDD.dump
sha256sum ./pilot_pre_faz6b_YYYYMMDD.dump
```

- Backup dosyası Git’e eklenmez
- SHA-256 hash operasyon loguna yazılır

## 2. Migration uygulama

```bash
docker compose --env-file /etc/acarindex/pilot.env -f docker-compose.pilot.yml \
  run --rm migrate npx prisma migrate deploy
```

- İkinci kez çalıştır: no pending migrations (no-op)

Beklenen migration: `20260626100000_user_panel`

Yeni tablolar: `saved_articles`, `reading_lists`, `reading_list_items`, `followed_journals`, `followed_authors`, `notification_preferences`, `recent_views`

## 3. Pilot app image rebuild

```bash
docker compose --env-file /etc/acarindex/pilot.env -f docker-compose.pilot.yml build app
```

- Yalnızca `app` container yenilenir; postgres volume’a dokunulmaz

## 4. Koruma kontrolleri

- Basic Auth aktif kalır
- `robots.txt` Disallow: /
- `ENABLE_USER_AUTH` / panel flag’leri planlanan değerde (beta pilot politikasına göre)

## 5. Smoke testleri (migration sonrası)

**Kullanıcı paneli**

- Giriş / logout
- Makale kaydet / kaldır
- Okuma listesi CRUD + sıralama
- Dergi / canonical yazar takibi
- Provisional yazar reddi
- `/hesabim` özet sayıları
- Bildirim tercihleri kaydı (gönderim yok)

**Public katalog / PDF regresyon**

- Ana sayfa, arama, dergi listesi
- Makale detay, PDF endpoint
- Sitemap / robots

## 6. Migration sonrası backup

```bash
# pilot_post_faz6b.dump + SHA-256
```

## 7. Rollback (gerekirse)

1. Eski app image tag’ine dön (`docker compose up -d app` önceki image ile)
2. User panel feature flag’lerini kapat (`ENABLE_USER_AUTH=0` vb.)
3. **Volume restore yapma** — çalışan postgres volume’u doğrudan geri yükleme riskli
4. Migration geri alma (down) bu planda yok; user panel tabloları boş kalabilir, app eski kodla çalışır

## 8. Beta deployment hazırlık kararı

| Kriter | Gerekli |
|--------|---------|
| Rehearsal migration yeşil | Evet |
| Rehearsal kabul testi yeşil | Evet |
| IDOR / CSRF / pasif kullanıcı testleri | Evet |
| Commit + push redesign-v2 | Evet |
| Operasyonel onay | Evet (ayrı) |

Beta migration **bu sprintte uygulanmaz**; yukarıdaki plan onay sonrası uygulanır.
