# Veri kalite listesi (pilot)

UI katmanında gizlenmeyen, ETL veya veri düzeltmesi gerektiren kayıtlar.

| Sorun | Örnek | Alan | Öncelik |
|-------|--------|------|---------|
| Dergi adı encoding / typo | `lnternational Journal of Geography...` (I eksik) | `journals.title_tr` | Orta |
| Makale başlıkları ALL CAPS | Pilot makale listesi | `articles.title_tr` | Düşük (görüntüleme) |
| Yazar adı büyük harf | `İsmail ŞENTÜRK` | `authors.name` | Düşük |
