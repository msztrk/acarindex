# AcarIndex Current State Audit

**Audit date:** 2026-07-05 (revision)  
**Scope:** Local repository (`D:\acarindex-web`, branch `redesign-v2`) and beta pilot (`acarindex-beta`, `/opt/acarindex`, `/etc/acarindex/pilot.env`)  
**Mode:** Read-only inspection + targeted security fixes (admin guards) + beta operational actions  
**Local HEAD:** `4798bf4` + pending guard/audit commit

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Local HEAD | `4798bf4` — audit docs; guard commit pending push |
| Beta HEAD (pre-deploy) | `95152ba` — **behind** origin `4798bf4` |
| Vitest | 52 files / **517 passed**, 17 skipped |
| npm audit | 2 moderate (postcss XSS via Next.js) |
| Issue register | **P0: 0 · P1: 5 open · P2: 10 · P3: 10** |
| Gate status | **`GATE-001` CLOSURE=HAYIR** (operational, not P0) |
| Beta disk | **69%** (was 86%; cleanup this audit) |

**Verdict:** Resolve **application attachment durability** (B2 pilot bucket OR disable upload) and re-run Faz B gate before new features. **No 1TB PDF migration.**

---

## Attachment Storage Decision

| Layer | Decision |
|-------|----------|
| Application uploads | Private B2 `acarindex-applications-pilot` (preferred) OR disable upload temporarily |
| PG off-site backup | B2 backup scripts — database dumps only |
| 1TB PDF archive | **Deferred** — do not change live PDF URLs |

Beta verification: 4 attachments, all from `msztrk@gmail.com` (E2E/test) → memory storage severity **P1** not P0.

Faz B **not closed** with memory provider + upload enabled.

---

## §1 System Snapshot

| Item | Local | Beta (`acarindex-beta`, `/opt/acarindex`) |
|------|-------|-------------------------------------------|
| Git SHA | `f3d096509805452fe513ddb48adb650087cbbe06` | `95152ba1bce3e6044aa833ac394888b1ec58b151` |
| Branch | `redesign-v2` | `redesign-v2` |
| Working tree | **Clean** | N/A |
| Stack | Next.js **16.2.9**, React 19, Prisma **6.19**, Postgres 16 | `docker-compose.pilot.yml` |
| App container | — | `acarindex_pilot_app` (Up, healthy, `:3002→3000`) |
| Postgres | — | `acarindex_pilot_pg` (`postgres:16-alpine`, healthy) |
| MariaDB (ETL source) | — | `acarindex_pilot_mysql` (`mariadb:10.11`, healthy) |
| Prod containers (same host) | — | `acarindex_prod_app`, `acarindex_prod_pg` (not audited) |
| Disk `/` | — | **69% used** (50G / 75G) — cleaned from 86% |
| Docker volumes | — | `acarindex-pilot_pilot_pg_data`, `acarindex-pilot_pilot_mysql_data` |
| Migrations | 15 (schema) | 15 applied, **0 pending**; latest: `20260714100000_notification_outbox_faz_b5` |
| Backups | — | `/var/backups/acarindex-pilot` ≈ **7.5G** |
| Outbox cron | — | **Installed** (every 5 min) |
| Storage provider | — | `APPLICATION_STORAGE_PROVIDER=memory` |

### Inventory Counts (Local Codebase)

| Asset | Count |
|-------|-------|
| Vitest files | 54 `*.test.ts` (52 run, 1 skipped config) |
| API route files | 57 |
| API HTTP handlers | 86 |
| App Router pages | 60 `page.tsx` |
| Prisma models | 49 |
| Deploy scripts | 87 under `deploy/scripts/` |

---

## SHA Alignment

| Environment | SHA | Status |
|-------------|-----|--------|
| Local | `f3d0965` | Current (hotfixes on closure gate + test ISSN uniqueness) |
| GitHub (`origin/redesign-v2`) | `f3d0965` | Aligned with local |
| Beta pilot | `95152ba` | **1 commit behind** local |

Missing on beta: `f3d0965` — `fix(beta): Faz B closure gate hotfixes and unique test ISSN generation.`

Note: Beta **does** include `95152ba` (container `pg_restore` fix). The prior audit's `dd471eb` lag is resolved; new lag is the post-95152ba hotfix commit.

---

## Faz B Operational Closure (Updated)

Latest complete gate run: `/var/log/acarindex-faz-b-closure-20260704_222004.log` (247 lines, Jul 4 22:27 UTC).

| Step | Result |
|------|--------|
| Pre-check | OK |
| Pre-work backup | OK |
| B2 application storage | **BLOCKED** |
| Storage tests (18) | **FAIL** |
| Outbox real email | **FAIL** |
| E2E journal + publish | **FAIL** |
| Journal status audit | See log |
| Off-site B2 backup | **BLOCKED** |
| i18n validate | **PASS** (re-run in this attempt) |
| Regression (beta) | **PASS** |
| Final verdict | **`CLOSURE=HAYIR`**, Faz C başlatılabilir: **HAYIR** |

Blocker note in log: B2 browser setup blocked by unavailable Cursor IDE Browser MCP during credential setup workflow.

---

## Critical Risks (Reclassified)

| Risk | Severity | Status | Evidence |
|------|----------|--------|----------|
| `APPLICATION_STORAGE_PROVIDER=memory` on beta | **P1** | open | Test/E2E attachments only; still blocks Faz B |
| Faz B closure `CLOSURE=HAYIR` | **gate-status** | open | GATE-001 — outcome of storage/E2E/outbox gaps |
| Disk usage high | P1 | **closed** | 86% → 69% via pilot-disk-cleanup |
| Beta deploy lag | P1 | open | Pending deploy of audit + guards |
| B2 app storage credentials absent | P1 | open | Application bucket only |
| Admin DQ/ETL guard gaps | P1 | **closed** | Guards added this audit |
| 736 draft journals (E2E residue) | P1 | open | Read-only SQL analysis complete |
| Duplicate journal slugs | **P2** | open | ID-in-URL routing prevents collision |
| PG off-site backup | P2 | open | Separate from PDF archive |

---

## Secret Scan Summary

**Command:** `npm run source:audit-secrets` (working-tree scan via `scripts/audit-secrets.ts`).

| Finding | Severity | Notes |
|---------|----------|-------|
| `.env.example` | Low | Example Supabase URL pattern (masked) |
| `staging.env.example` | Low | Example Supabase URL pattern |
| `tests/database-url.test.ts` | None | Masked test fixtures |

**Results:** 5 pattern hits, 3 unique locations, 0 history commits with live secrets. No live credentials in tracked source. `.env.local` exists locally (gitignored) — never commit.

---

## Test Suite

| Metric | Value |
|--------|-------|
| Test files | 54 `*.test.ts` under `tests/` |
| Vitest result | **517 passed**, 17 skipped, 52 files run |
| Playwright (responsive) | `playwright.beta-responsive.config.ts` — excluded from Vitest; not run this audit |
| Coverage areas | RBAC, auth security, journal applications (Faz B1–B5), i18n, SEO URLs, PDF proxy, notification outbox, search, ETL guards |

---

## npm Audit

| Severity | Count | Detail |
|----------|-------|--------|
| Moderate | 2 | postcss XSS (GHSA-qx2v-qp2m-jg93) via `next@16.2.9` |

No `--force` fix applied during audit.

---

## Performance (Beta curl, localhost:3002)

| Route | HTTP | Response time |
|-------|------|---------------|
| `/api/health` | 200 | 0.008 s |
| `/journals` | 200 | 0.060 s |
| `/` (home) | 200 | **0.519 s** (warm; improved vs prior 2s cold run) |
| `/search?q=test` | 200 | **2.615 s** (P2 — search SSR/query cost) |

---

## §25 Closure Summary Statistics

| Category | Count / Value |
|----------|---------------|
| Audit sections covered | 25 / 25 |
| Deliverable files | 10 (+ `scripts/audit/beta-db-integrity.sql`, enhanced `collect-routes.ts`) |
| P0 | 0 |
| P1 | 5 open (2 closed) |
| P2 | 10 |
| P3 | 10 |
| Gate status | GATE-001 **HAYIR** |
| Recommended path | **P0–P1 first** (not architectural rewrite) |
| Blockers | B2 credentials, memory storage, closure gate failures (storage/E2E/email) |

---

## Related Deliverables

- [Functional inventory](./functional-inventory.md)
- [Authorization matrix](./authorization-matrix.md)
- [Database integrity](./database-integrity.md)
- [Security review](./security-review.md)
- [SEO/i18n review](./seo-i18n-review.md)
- [Mobile/a11y review](./mobile-accessibility-review.md)
- [Operations review](./operations-review.md)
- [Issue register](./issue-register.csv)
- [Recommended roadmap](./recommended-roadmap.md)
- [Route inventory TSV](./route-inventory.tsv) (generated via `collect-routes.ts`)
