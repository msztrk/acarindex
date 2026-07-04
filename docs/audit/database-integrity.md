# AcarIndex Database Integrity Review

**Audit date:** 2026-07-05  
**Database:** Beta PostgreSQL (`acarindex_pilot` / user `acarindex_pilot`) — read-only queries  
**ORM:** Prisma 6.19 · **49 models** in `prisma/schema.prisma`  
**Helper:** `scripts/audit/beta-db-integrity.sql` (pipe to beta postgres container)

---

## §9 Migration State

| Metric | Value |
|--------|-------|
| Applied migrations | **15** |
| Pending migrations | **0** |
| Latest migration | `20260714100000_notification_outbox_faz_b5` |
| Faz coverage | Through **Faz B5** (notification outbox) |

Recent migrations (beta `_prisma_migrations`):

| Migration | Applied (UTC) |
|-----------|---------------|
| `20260714100000_notification_outbox_faz_b5` | 2026-07-04 19:00:42 |
| `20260713100000_journal_application_faz_b2` | 2026-07-04 15:59:28 |
| `20260712100000_journal_application_faz_b1` | 2026-07-04 15:16:41 |
| `20260711100000_journal_id_sequence` | 2026-07-04 14:14:53 |
| `20260710100000_application_center_faz_a` | 2026-07-04 00:09:45 |

No schema drift detected between local Prisma schema and beta applied migrations.

---

## Catalog Scale (Beta)

| Entity | Count |
|--------|------:|
| Journals | 3,790 |
| Issues | 96,309 |
| Articles | 543,060 |
| Authors | 16,663 |

---

## §9 Journal Publication Status

| Status | Count | Notes |
|--------|------:|-------|
| `published` | **3,054** | Served on public routes |
| `draft` | **736** | E2E/smoke artifacts; slugs assigned |

### Draft Journal Details

- All 736 drafts have non-empty slugs (`draft_with_slug = 736`).
- Public routes **do not serve** drafts — loaders filter `status: 'published'`.
- Cleanup tracked as **AUD-008 (P1)**.

---

## §9 Duplicate Slugs (New Finding)

| Metric | Value |
|--------|------:|
| Slug groups with count > 1 | **49** |

Sample duplicates (published + draft mix possible):

| Slug | Count |
|------|------:|
| `akdeniz-iibf-dergisi` | 3 |
| `acta-oncologica-turcica` | 2 |
| (47 additional groups) | 2 each (typical) |

**Issue:** AUD-009 (P1) — investigate ETL slug assignment; may affect URL routing for affected journals.

---

## Orphan and Referential Checks

| Check | Result |
|-------|--------|
| Orphan application attachments | **0** |
| Draft journals with slug | 736 (expected admin/E2E residue) |
| Public sitemap draft leakage | **None** (published filter enforced) |
| Application FK integrity | **Pass** — attachments reference valid `content_applications` |

---

## Application Center Data

| Table / metric | Count | Distribution |
|----------------|------:|--------------|
| `content_applications` | 4 | 3 `draft`, 1 `revision_requested` |
| By kind | — | All 4 are `new_journal` |
| `journal_applications` | 4 | 1:1 with content apps |
| `application_attachments` | 4 | 3 `pending`, 1 `committed` |
| `notification_outbox` | 8 | All `sent` |

**AUD-028 (P3):** Attachments exist but 3 remain `pending` upload status; with memory storage, blob data is not durable across container restart.

No `announcement` or `data_correction` application rows on beta (kinds supported in code only).

---

## §10 Journal Status Public Visibility Audit

Verified in code (and closure gate journal status audit step):

| Layer | Filter |
|-------|--------|
| `lib/data/journals.ts` | `status: 'published'` |
| `lib/data/catalog.ts` | `status: 'published'` |
| `lib/data/search.ts` | `status: 'published'` |
| `lib/data/stats.ts` | `status: 'published'` |
| `lib/data/platform.ts` | `status: 'published'` |
| Sitemap generators | Published only |
| `/api/search-suggest` | Published only |
| Journal detail page | `getPublishedJournalById` |

### Unfiltered Queries (Expected — Internal)

- Admin `catalog-lists.ts`
- Editor panel loaders
- Admin publish workflow
- Seed and ETL scripts

**Result:** No draft journal public leak detected in code or beta data paths.

---

## Prisma Model Inventory (49 models)

Core catalog: `Category`, `Journal`, `Issue`, `Article`, `Author`, `ArticleAuthor`, `PdfFile`, `Institution`, …

Auth: `User`, `Session`, `AdminPermission`, …

User panel: `ReadingList`, `SavedArticle`, `FollowedJournal`, `FollowedAuthor`, `RecentView`, …

Applications: `ContentApplication`, `JournalApplication`, `ApplicationAttachment`, `NotificationOutbox`, …

Full list: `prisma/schema.prisma`

---

## Legacy Schema Notes

- `types/database.ts` — manual placeholder (**AUD-026, P3**)
- Supabase-era migration comments in baseline SQL (**AUD-025, P3**)

---

## Read-Only Query Reproduction

```powershell
Get-Content D:\acarindex-web\scripts\audit\beta-db-integrity.sql |
  ssh acarindex-beta "docker exec -i acarindex_pilot_pg psql -U acarindex_pilot -d acarindex_pilot"
```

---

## Related Deliverables

- [Current state audit](./current-state-audit.md)
- [Functional inventory](./functional-inventory.md)
- [Issue register](./issue-register.csv)
