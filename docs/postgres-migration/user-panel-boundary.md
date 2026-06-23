# Kullanıcı paneli mimari sınırı

Bu sprintte kullanıcı paneli, üyelik, giriş, favoriler, bildirimler ve yazar profili sahiplenme **geliştirilmedi**.

## İlke

- **Katalog okuma** (dergi, makale, yazar, arama, PDF viewer) PostgreSQL `articles`, `journals`, `authors` vb. tablolarından yapılır.
- **Kullanıcı hesabı ve tercihler** ileride katalog tablolarından **bağımsız** şema ve servislerle kurulacak.
- Geçici Supabase Auth yalnızca feature flag ile sınırlı; katalog `DATABASE_URL` (Prisma) ile okunur.

## Yapılmayacak (bu faz)

- Favori makale / dergi
- Bildirimler
- Yazar profili sahiplenme
- Üyelik abonelik modeli

## İleride

- `user_accounts`, `user_preferences` vb. ayrı migration seti
- Katalog FK zorunluluğu yok; yalnızca public ID referansları
