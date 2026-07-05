# AcarIndex Security Review

**Audit date:** 2026-07-05 (revision)  
**Scope:** Local repository @ `4798bf4` + guard commit; beta pilot @ pre-deploy `95152ba`  
**Issue counts:** **P0: 0 · P1: 5 open (2 closed) · P2: 10 · P3: 10** (28 technical + 1 gate-status)  
**Gate status:** `GATE-001` — **`CLOSURE=HAYIR`** (operational outcome, not P0 root cause)

---

## §15 Executive Summary

Strong auth fundamentals: PG-native sessions, CSRF on auth mutations, rate limits, 517 passing tests, correct published-only public filtering. **P0 reclassification:** memory storage downgraded to **P1** after beta verification showed all 4 attachments are E2E/test artifacts (`msztrk@gmail.com`); `CLOSURE=HAYIR` moved to **gate-status** record `GATE-001`.

**Admin permission guards implemented** for data-quality, ETL, issues, and articles pages — legacy global EDITOR blocked from DQ/ETL; issues/articles require explicit `manage_journals` / `manage_articles`.

**Do not start Faz C** until application attachment durability (or upload disabled) and gate steps pass. **Do not start 1TB PDF/B2 migration** — separate from application attachment bucket.

---

## P0 Findings

**None** after reclassification. Memory storage is P1 on beta (test uploads only). Production is out of scope.

---

## P1 Findings

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| AUD-001 | Memory attachment storage on beta | open | P1 — test/E2E uploads only; still blocks Faz B |
| AUD-003 | Beta deploy lag | open | Deploy pending this audit commit |
| AUD-004 | Disk >80% | **closed** | 86% → **69%** after `pilot-disk-cleanup.sh` |
| AUD-005 | B2 creds absent (app storage) | open | `acarindex-applications-pilot` only |
| AUD-006 | Data quality guard gap | **closed** | `requirePermission('data_quality.read')` |
| AUD-007 | ETL guard gap | **closed** | `requirePermission('etl.read')` |
| AUD-008 | 736 draft journals | open | E2E residue; read-only analysis done |
| AUD-018 | Off-site PG backup BLOCKED | open | Separate from PDF archive |

---

## P2 Findings

| ID | Title | Area |
|----|-------|------|
| AUD-009 | 49 duplicate journal slug groups | Data — **downgraded** (ID-in-URL routing) |
| AUD-010 | LEGACY_DUAL_READ dual authorization path | Security |
| AUD-011 | Search page ~2.6s on beta | Performance |
| AUD-012 | Home page cold/warm variance | Performance |
| AUD-014 | npm audit 2 moderate (postcss) | Security |
| AUD-015 | Storage integration tests FAIL | Operations |
| AUD-016 | Outbox real email partial FAIL | Operations |
| AUD-017 | E2E journal flow FAIL | Operations |
| AUD-019 | PDF proxy no rate limit | Security |

---

## P3 Findings

AUD-013 (institutions search — **downgraded** from P2; public catalog names only), AUD-020 through AUD-028 — see [issue register](./issue-register.csv).

---

## Gate Status (Separate from P0)

| ID | Status | Meaning |
|----|--------|---------|
| GATE-001 | `CLOSURE=HAYIR` | Faz B operational closure gate failed storage/E2E/outbox/B2 steps; **aggregate outcome** of AUD-001, AUD-005, AUD-015–018 |

Faz B is **not closed** with `memory` provider + uploads enabled.

---

## Attachment Storage Decision

| Layer | Scope | Decision |
|-------|-------|----------|
| Application files | Journal application uploads (~MB) | **Preferred:** private B2 bucket `acarindex-applications-pilot` |
| PG off-site backup | Database dumps | Separate B2 backup config — NOT PDF archive |
| 1TB PDF archive | Catalog PDFs on live URLs | **Deferred** to post-product final audit — do NOT migrate now |

**Temporary without B2 keys:** disable upload via feature flag OR docker persistent volume provider; verify no data loss on restart; optional pilot UI notice.

---

## §15 Security Control Matrix

| Control | Status | Notes |
|---------|--------|-------|
| PG-native auth | ✓ Active | No Supabase runtime dependency for sessions |
| CSRF (auth mutations) | ✓ | Tested in `auth-logout-csrf.test.ts` |
| Rate limits (auth) | ✓ | `auth-security.test.ts` |
| Session fixation / lifecycle | ✓ | `auth-lifecycle.test.ts` |
| IDOR — user APIs | ✓ | Owner scoping in application routes |
| IDOR — admin APIs | ✓ | Permission session required |
| Admin page authorization | **Fixed** | DQ/ETL/issues/articles explicit guards |
| Public data leak (drafts) | ✓ None | Published filters |
| Beta HTTP basic auth | ✓ | External access gated |
| Institutions search | Public | id + nameTr/nameEn only; min 2 chars; limit 10 |

---

## Admin Authorization (Fixed)

| Page | Guard | Permission |
|------|-------|------------|
| data-quality (+ detail) | `requirePermission('data_quality.read')` | review_change_requests OR view_audit_logs |
| etl | `requirePermission('etl.read')` | manage_system_settings |
| issues | `requireAdminPermissionGuard('manage_journals')` | explicit DB permission |
| articles | `requireAdminPermissionGuard('manage_articles')` | explicit DB permission |
| journals, applications, change-requests | ✓ (prior) | — |

Legacy global **EDITOR** blocked from DQ/ETL; issues/articles require explicit permissions (not `legacy_admin_access` alone).

---

## Institution Search Assessment

`GET /api/institutions/search` — returns `{ id, nameTr, nameEn }` only; min query length 2; limit 10; no auth; no rate limit.

**Severity: P3** — public catalog institution names (same as browse data). Recommend rate limit + min length if staying public.

---

## Related Deliverables

- [Authorization matrix](./authorization-matrix.md)
- [Issue register](./issue-register.csv)
- [Operations review](./operations-review.md)
- [Recommended roadmap](./recommended-roadmap.md)
