# Resend transactional e-posta (Faz 6C-Beta B)

Beta gönderici önerisi:

- Domain: `notify.acarindex.com`
- From: `AcarIndex <no-reply@notify.acarindex.com>`
- Reply-To: destek adresi (ör. `destek@acarindex.com`)

## Runtime environment (Git dışı — `/etc/acarindex/pilot.env`)

```bash
EMAIL_PROVIDER=resend
RESEND_API_KEY=<Resend dashboard — Git'e yazmayın>
EMAIL_FROM=AcarIndex <no-reply@notify.acarindex.com>
EMAIL_REPLY_TO=destek@acarindex.com
APP_PUBLIC_URL=https://beta.acarindex.com
NEXT_PUBLIC_SITE_URL=https://beta.acarindex.com

# Aşamalı flag (deploy script yönetir)
ENABLE_PUBLIC_REGISTRATION=0
ENABLE_EMAIL_VERIFICATION=0   # doğrulama kabul sonrası 1
ENABLE_PASSWORD_RESET=0     # reset kabul sonrası 1

# Ops onay (domain DNS doğrulandıktan sonra)
ACAR_RESEND_DOMAIN_VERIFIED=1
ACAR_BETA_MAIL_TEST_EMAIL=<kontrollü test alıcısı>
```

## DNS kayıtları (Resend dashboard — otomatik değiştirilmez)

Resend’de `notify.acarindex.com` ekledikten sonra panelde gösterilen kayıtları DNS sağlayıcısına ekleyin:

| Tür | Amaç |
|-----|------|
| TXT / CNAME | Domain verification |
| TXT | SPF (`send` subdomain) |
| CNAME | DKIM (genelde `resend._domainkey`) |
| CNAME | Return-path / bounce (gerekirse) |

**DMARC:** Mevcut `acarindex.com` DMARC politikasını bu sprintte değiştirmeyin. `notify.acarindex.com` alt alanı için Resend önerilerini uygulayın.

Domain **verified** olmadan `ENABLE_EMAIL_VERIFICATION` açmayın.

## Webhook (opsiyonel)

`RESEND_WEBHOOK_SECRET` tanımlı değilse `POST /api/webhooks/resend` → 404 (fail-closed).

## Bağlantı güvenliği

Auth e-posta URL’leri yalnızca `APP_PUBLIC_URL` origin kullanır (`https://beta.acarindex.com`). Host header veya `http://127.0.0.1` e-postaya girmez.

Beta linkleri Basic Auth arkasındadır; test kullanıcısı önce Basic Auth geçer.
