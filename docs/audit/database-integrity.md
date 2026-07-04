# AcarIndex Database Integrity Review

**Audit date:** 2026-07-05  
**Database:** Beta PostgreSQL (read-only queries via `acarindex-beta`)  
**ORM:** Prisma 6.19

This document summarizes catalog scale, journal publication status, orphan checks, application data, and migration state observed during the read-only audit.

---

## Migration State

| Metric | Value |
|--------|-------|
| Applied migrations | 15 |
| Pending migrations | **0** |
| Latest migration | `20260714100000_notification_outbox_faz_b5` |
| Faz coverage | Through **Faz B5** (notification outbox) |

All Prisma migrations are current on beta pilot. No schema drift was detected during the audit window.

---

## Journal Publication Status

| Status | Count | Notes |
|--------|-------|-------|
| `published` | **3,054** | Served on public routes |
| `draft` | **736** | Admin/E2E smoke artifacts; not in public sitemap |

### Draft Journal Details

- All 736 draft journals have slugs assigned.
- Drafts are **not exposed** on public routes — loaders in `lib/data/journals.ts`, search, sitemaps, and stats all filter `status: 'published'`.
- Residual drafts are tracked as **AUD-008 (P1)** — run `faz6b2-cleanup-smoke-artifacts.sh` after E2E cycles.

---

## Catalog Scale (Beta)

Counts from closure backup pre-check:

| Entity | Approximate count |
|--------|-------------------|
| Journals | ~3,790 |
| Issues | ~96,309 |
| Articles | ~543,060 |

These figures include both published and draft journals. Public-facing aggregates use published filters only.

---

## Orphan and Referential Checks

| Check | Result |
|-------|--------|
| Orphan application attachments | **0** |
| Draft journals with slug | 736 (expected admin/E2E residue) |
| Public sitemap draft leakage | **None** (published filter enforced) |

No orphan attachment rows were found. The zero attachment count aligns with memory storage provider behavior (see application center section below).

---

## Application Center Data

| Table | Row count | Status distribution |
|-------|-----------|---------------------|
| `content_applications` | 12 | All `submitted` |
| `application_attachments` | **0** | Expected with `APPLICATION_STORAGE_PROVIDER=memory` and container restarts |

**AUD-024 (P3):** Zero attachments despite 12 submitted applications is consistent with in-memory storage being wiped on restart. Re-verify after B2 storage is configured.

---

## Public Query Audit (Journal Status)

Script `faz-b-journal-status-audit.sh` verifies published-only filters in:

- `lib/data/journals.ts`
- `lib/data/catalog.ts`
- `lib/data/search.ts`
- `lib/data/stats.ts`
- `lib/data/platform.ts`
- `lib/data/alternate-url.ts`
- Sitemap generators
- `/api/search-suggest`

**Result:** All public-facing data loaders use `status: 'published'`.

### Unfiltered Queries (Expected — Internal Only)

- Admin `catalog-lists.ts`
- Editor panel loaders
- Admin publish workflow
- Seed and ETL scripts

### Minor UX Concern

Editor panel links to `/journals/{slug}` for draft journals. The public page correctly returns 404, but the link is confusing (**AUD-017, P3**).

---

## Legacy Schema Notes

- `types/database.ts` is a manual placeholder pending full ETL consolidation (**AUD-022, P3**).
- Supabase-era references remain in ETL scripts and type definitions (**AUD-021, P3**).

---

## Related Deliverables

- [Current state audit](./current-state-audit.md)
- [Functional inventory](./functional-inventory.md)
- [Security review](./security-review.md)
- [Issue register](./issue-register.csv)
