# Beta noindex ve güvenlik politikası

`beta.acarindex.com` gerçek kullanıcı trafiği ve indeksleme için **açılmamalı**; sentetik veya gerçek katalog verisiyle bile beta host indekslenmemeli.

## Robots ve meta

| Katman | Politika |
|--------|----------|
| `robots.txt` | `Disallow: /` (tüm beta host) |
| HTTP header | `X-Robots-Tag: noindex, nofollow, noarchive` |
| Sayfa meta | `noindex, nofollow` |
| Canonical | Politika kararı: beta URL canonical **üretilmez**; `NEXT_PUBLIC_CANONICAL_BASE` production www kalır |

Uygulama: `app/robots.ts` ve `proxy.ts` non-canonical host için zaten noindex uygular.

## Sentetik fixture uyarısı

Rehearsal veya sentetik seed kullanıldığında:

- Sayfa footer veya banner: **“Test verisi — gerçek AcarIndex kataloğu değildir”**
- `dev-fixture` slug/source_key ile ayırt edilebilir

## Erişim kısıtlama (önerilen)

- HTTP Basic Auth veya IP allowlist (ofis/VPN)
- HTTPS zorunlu (Let's Encrypt / panel)
- Directory listing kapalı
- `server_tokens off` (Nginx)
- Gereksiz response header’ları azaltılmış

## Ağ

| Port | Durum |
|------|--------|
| 80 / 443 | Nginx → app (127.0.0.1:3000) |
| 5432 PostgreSQL | **İnternete kapalı** |
| SSH | Yalnızca yönetim IP’leri |

## Dosya erişimi

- `.env.production`, backup dump’lar web root dışında
- Nginx ile `.env`, `.dump`, `.sql` istekleri reddedilir

## Gerçek veri kapısı

Sentetik fixture ile başarılı deployment provası, [deferred-data-validation.md](./deferred-data-validation.md) ve [production-gates.md](./production-gates.md) zorunluluklarının yerine **geçmez**.
