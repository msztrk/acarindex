# AcarIndex SEO and i18n Review

**Audit date:** 2026-07-05  
**Scope:** Local codebase and beta pilot configuration

---

## Locale Model

| Setting | Value |
|---------|-------|
| Default locale | Turkish (`tr`) |
| Secondary locale | English (`en`) |
| English URL prefix | `/en/` |
| Implementation | `lib/i18n/locale.ts` |

The application uses a path-prefix model for English content while Turkish remains the default without a prefix.

---

## Beta Indexing Controls

Beta external access is protected and excluded from search indexing:

| Control | Mechanism |
|---------|-----------|
| HTTP basic auth | 401 on external access |
| Robots header | `X-Robots-Tag: noindex` on beta responses |
| Non-canonical hosts | Middleware (`proxy.ts`) adds `noindex` for non-canonical hostnames |

**Result:** Beta content is not intended to appear in search engine indexes.

---

## hreflang and Alternate URLs

| Component | Status |
|-----------|--------|
| `/api/locale/alternate` | Functional — returns alternate locale URLs for hreflang |
| Sitemaps | Published entities only |
| JSON-LD | Present on public pages |

hreflang alternates are generated for TR/EN page pairs where translations exist.

---

## Journal Public Query Audit

Script `deploy/scripts/beta/faz-b-journal-status-audit.sh` (referenced in closure gate) verifies published-only filters across:

| File / Route | Filter |
|--------------|--------|
| `lib/data/journals.ts` | `status: 'published'` |
| `lib/data/catalog.ts` | `status: 'published'` |
| `lib/data/search.ts` | `status: 'published'` |
| `lib/data/stats.ts` | `status: 'published'` |
| `lib/data/platform.ts` | `status: 'published'` |
| `lib/data/alternate-url.ts` | `status: 'published'` |
| Sitemap generators | Published only |
| `/api/search-suggest` | Published only |
| Journal detail page | `getPublishedJournalById` |

### Audit Result

**No draft journal public leak detected.** 736 draft journals exist in the database (E2E/smoke artifacts) but all public routes filter correctly.

### Internal Unfiltered Queries (Expected)

- Admin catalog lists
- Editor panel
- Admin publish workflow
- Seed and ETL scripts

### Minor UX Issue (P3)

Editor panel links to `/journals/{slug}` for draft journals. Public page returns 404 (safe) but link is confusing (**AUD-017**).

---

## i18n Validation History

| Event | Timestamp | Result |
|-------|-----------|--------|
| Last `validate-i18n-beta.sh` | **Jul 4, 2026 14:40** | Passed |
| Log location | `/var/log/acarindex-validate-i18n-20260704_143730.*` | |
| Latest Faz B closure attempt | Jul 4, 2026 ~21:37 | **Did not re-run i18n validate** |

**AUD-014 (P2):** Include `validate-i18n-beta.sh` in the next successful closure gate run.

---

## SEO Module Status

From the 25-module matrix:

| Module | Status | Notes |
|--------|--------|-------|
| SEO / sitemaps / JSON-LD | **Functional** | Beta noindex enforced |
| i18n (TR/EN, hreflang) | **Functional** | Last validate Jul 4; pending re-validation post-closure |

---

## Sitemap Coverage

Public sitemaps include:

- Root sitemap index
- Journal sitemaps
- Article sitemaps

All sitemap queries restrict to `status: 'published'`. Draft journals (736) are excluded.

---

## Recommendations

1. Re-run `validate-i18n-beta.sh` as part of completed Faz B closure gate.
2. After production cutover, verify canonical host middleware and remove beta-only noindex where appropriate.
3. Monitor draft journal count; run cleanup script after E2E cycles to keep sitemap generation efficient.

---

## Related Deliverables

- [Database integrity](./database-integrity.md)
- [Functional inventory](./functional-inventory.md)
- [Issue register](./issue-register.csv)
