# Hesap yaşam döngüsü (Faz 6C)

## Kapsam

- E-posta doğrulama (hash token, tek kullanım, süre sınırı)
- Parola sıfırlama (enumeration-safe, session iptali)
- Aktif oturum listesi ve sonlandırma
- Kullanım şartları / gizlilik onayı (sürümlü, placeholder metin)
- Hesap pasifleştirme ve silme talebi (grace period, fiziksel silme yok)
- Herkese açık kayıt (feature flag arkasında, varsayılan kapalı)

## Feature flag’ler

| Env | Varsayılan | Açıklama |
|-----|------------|----------|
| `ENABLE_PUBLIC_REGISTRATION` | kapalı | `/register` ve kayıt API |
| `ENABLE_EMAIL_VERIFICATION` | kapalı | Doğrulama e-postası ve token akışı |
| `ENABLE_PASSWORD_RESET` | kapalı | Şifremi unuttum akışı |
| `EMAIL_PROVIDER` | `console` | `console` = dosya/konsol sink (prod dışı etiket) |
| `ENABLE_CAPTCHA` | kapalı | CAPTCHA adapter noktası (noop varsayılan) |

Değer: `1` etkinleştirir. Beta’da varsayılan kapalı tutulur.

## E-posta katmanı

- Arayüz: `sendVerificationEmail`, `sendPasswordResetEmail`, `sendSecurityNotification`
- Secret’lar yalnızca runtime env (`EMAIL_PROVIDER`, provider-specific keys)
- Development/rehearsal: `console` provider — gerçek gönderim yok
- Provider hatası kullanıcıya detay sızdırmaz

## Token kuralları

- Ham token DB’de tutulmaz; SHA-256 hash
- `verification_tokens` ve `password_reset_tokens` — expiry + used_at
- Rate limit: `abuse_events` tablosu (IP/e-posta/token hash)

## Rotalar

| Sayfa | API |
|-------|-----|
| `/register` | `POST /api/auth/register` |
| `/verify-email` | `POST /api/auth/verify-email` (CSRF yok — token yetkisi) |
| `/verify-email/request` | `POST /api/auth/resend-verification` |
| `/forgot-password` | `POST /api/auth/forgot-password` |
| `/reset-password` | `POST /api/auth/reset-password` |
| `/hesabim/security` | `GET/DELETE /api/auth/sessions`, hesap lifecycle `POST /api/auth/account` |

## Hukuki belgeler

- `legal_documents` — tür, sürüm, yayın tarihi, içerik hash (placeholder)
- `user_legal_acceptances` — kullanıcı kabul kaydı
- Gerçek metinler kullanıcı tarafından sağlanacak; repo’da yalnızca altyapı

## Hesap silme

- `account_deletion_requests` — `scheduled`, grace `DELETION_GRACE_DAYS` (14)
- Talep sonrası oturumlar iptal
- Grace içinde iptal (parola gerekmez)
- Bibliyografik `authors` ve katalog verisi etkilenmez
- Fiziksel anonimleştirme ayrı operasyon

## Admin

- Görünür: doğrulama durumu, hesap durumu, son giriş, aktif oturum sayısı, şart/gizlilik sürümleri, silme talebi
- Görünmez: hash, token, tam IP, özel liste içeriği
- SUPER_ADMIN: manuel e-posta doğrulama (`POST /api/admin/users/:id/verify-email`) + audit

## Supabase legacy kaldırma planı

1. `USE_PG_AUTH=1` tüm ortamlarda doğrulandıktan sonra
2. `LoginForm.tsx` (Supabase), `/auth/callback`, `lib/supabase/auth` import taraması
3. Paket kaldırma yalnızca sıfır import kanıtı sonrası, ayrı commit
4. Katalog okuma ve canlı davranış regression testi

Bu sprintte paket kaldırılmadı.

## Beta migration

Faz 6C migration (`20260627100000_auth_lifecycle`) rehearsal’da doğrulanmalı. Beta’ya uygulama **açık onay** gerektirir.
