# Commit geçmişi notları

## `2439915` — yanlış commit mesajı

- **Mesaj:** `fix(seed): etl audit constraints and idempotent run statistics`
- **Gerçek içerik:** Türkçe arama düzeltmesi (`expandSearchTerms`) — dosyalar:
  - `lib/data/search.ts`
  - `lib/search/normalize.ts`
  - `tests/search.test.ts`
- **Neden:** Paralel commit sırasında `index.lock`; seed değişiklikleri sonraki `859e293` commit’inde.
- **Politika:** Geçmiş rewrite yapılmadı; içerik bu belgeyle kayıtlı.
