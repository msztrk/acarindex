# Kullanıcı paneli — admin gizlilik sınırları (Faz 6B)

## Admin görebilir (operasyonel özet)

- Hesap durumu (`active` / `disabled`)
- Rol listesi
- E-posta doğrulama durumu
- Son giriş zamanı
- **Sayısal özet:** kaydedilen makale, okuma listesi, takip edilen dergi/yazar adetleri

## Admin göremez (bu sprint)

- Okuma listesi içerikleri ve makale sıralaması
- Kaydedilen makalelerin tam listesi (yalnızca sayı)
- Son görüntülenen içerik geçmişi
- Bildirim tercihi detayları (yalnızca kullanıcı `/hesabim/bildirimler`)

## Katalog silme davranışı

Kullanıcı paneli satırları bibliyografik tablolara **CASCADE** ile bağlıdır:

- Makale silinirse: `saved_articles`, `reading_list_items` satırları silinir.
- Dergi silinirse: `followed_journals` satırı silinir.
- Yazar silinirse: `followed_authors` satırı silinir.

Kullanıcı işlemleri katalog kayıtlarını **asla silmez**.

## users ↔ authors ayrımı

`users` (uygulama hesabı) ve `authors` (bibliyografik kayıt) birleştirilmez.
Takip hedefi `authors.id`; uygulama `users.id` üzerinden çalışır.
