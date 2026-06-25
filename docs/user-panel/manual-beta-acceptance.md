# Beta — manuel kabul kontrol listesi

Beta (`https://beta.acarindex.com`) Basic Auth arkasında tarayıcı ile doğrulama. Otomatik smoke’un tamamlayıcısıdır.

## Görünüm genişlikleri

Her rotasyonu şu genişliklerde kontrol edin:

- 375 px (mobil)
- 768 px (tablet)
- 1366 px (masaüstü)

## Rotasyon

- `/hesabim`
- `/hesabim/kaydedilen`
- `/hesabim/listeler`
- Liste detay sayfası (düzenleyici açık)
- `/hesabim/takip-dergiler`
- `/hesabim/takip-yazarlar`
- `/hesabim/son-goruntulenen`
- `/hesabim/bildirimler`
- `/hesabim/security`
- Gerçek makale sayfası
- Gerçek dergi sayfası
- Canonical yazar sayfası
- Provisional yazar sayfası

## Kontroller

- Yatay taşma yok
- Uzun makale başlığı düzgün kırılıyor
- Modal (liste oluşturma vb.) düzgün açılıyor/kapanıyor
- Klavye odağı görünür ve mantıklı sırada
- Dokunma/hedef boyutları yeterli (mobil)
- Boş durumlar anlaşılır
- Hata mesajları okunabilir, stack trace yok
- Optimistic UI hata durumunda geri alınıyor
- Logout sonrası `/hesabim` ve `/admin` korunuyor

## Kayıt

Her genişlik için PASS / FAIL notu; FAIL ise ekran görüntüsü ve URL.
