# AcarIndex SEO and i18n Review

**Audit date:** 2026-07-05  
**Scope:** Local codebase @ `f3d0965` and beta pilot configuration

---

## §11 Locale Model

| Setting | Value |
|---------|-------|
| Default locale | Turkish (`tr`) |
| Secondary locale | English (`en`) |
| English URL prefix | `/en/` |
| Implementation | `lib/i18n/locale.ts`, middleware in `proxy.ts` |

Path-prefix model: Turkish unprefixed; English under `/en/`.

---

## Beta Indexing Controls

| Control | Mechanism |
|---------|-----------|
| HTTP basic auth | 401 on external beta URL |
| Robots header | `X-Robots-Tag: noindex` on beta responses |
| Non-canonical hosts | Middleware adds `noindex` |

Beta content is intentionally excluded from search indexes.

---

## §11 hreflang and Alternate URLs

| Component | Status |
|-----------|--------|
| `/api/locale/alternate` | Functional — alternate locale URLs |
| Sitemaps | Published entities only |
| JSON-LD | Public pages (`jsonld.test.ts`, `issue-jsonld.test.ts`) |
| Slug policy | TR/EN slugs (`i18n-slugs.test.ts`, `article-slug-policy.test.ts`) |

---

## §10 Journal Public Visibility (SEO-related)

All public SEO surfaces filter `status: 'published'`:

- Sitemap index and entity sitemaps
- JSON-LD on journal/article pages
- hreflang alternates via `lib/data/alternate-url.ts`
- Search and stats aggregations

736 draft journals excluded from sitemaps. **No draft leak.**

---

## §11 i18n Validation

| Event | Timestamp | Result |
|-------|-----------|--------|
| Last standalone validate | Jul 4, 2026 ~14:40 | Passed |
| Closure gate re-run | Jul 4, 2026 **22:24 UTC** | **PASS** |
| Log | `/var/log/acarindex-validate-i18n-20260704_222428.json` | 0 mismatches reported |

Metrics from closure run (excerpt):

- `hreflang_head_sitemap_mismatch`: 0
- `empty_en_sitemap_pages`: 0
- `has_en_content_flag_drift`: 0

**Local validation:** `npm run validate:i18n-urls` not run against beta DB this audit (beta script used in closure). Safe to re-run via `deploy/scripts/beta/validate-i18n-beta.sh` after next deploy.

**Tests:** `validate-i18n-metrics.test.ts`, `i18n-content-hardening.test.ts`, `seo-url-contracts.test.ts` — all pass locally (517 suite).

---

## Sitemap Coverage

| Sitemap | Content filter |
|---------|----------------|
| Root index | Points to entity sitemaps |
| Journal sitemaps | `status: 'published'` |
| Article sitemaps | Published articles only |

Duplicate slugs (49 groups, AUD-009) may affect canonical URL uniqueness for affected journals — SEO risk if both duplicates are published.

---

## §11 Module Status (from 25-module matrix)

| Module | Status | Notes |
|--------|--------|-------|
| SEO / sitemaps / JSON-LD | **Functional** | Beta noindex |
| i18n TR/EN hreflang | **Functional** | Validated in latest closure attempt |

---

## Recommendations

1. Re-run `validate-i18n-beta.sh` after deploying `f3d0965` to beta.
2. Resolve duplicate slug groups before production cutover (canonical URL integrity).
3. After production: remove beta noindex; verify canonical host middleware on production domain.
4. Run `validate:i18n-urls` locally against staging/rehearsal before cutover.

---

## Related Deliverables

- [Database integrity](./database-integrity.md)
- [Functional inventory](./functional-inventory.md)
- [Issue register](./issue-register.csv)
