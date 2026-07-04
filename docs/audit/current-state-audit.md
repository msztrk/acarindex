# AcarIndex Current State Audit

**Audit date:** 2026-07-05  
**Scope:** Local repository (`D:\acarindex-web`, branch `redesign-v2`) and beta pilot (`acarindex-beta`, `/opt/acarindex`, `/etc/acarindex/pilot.env`)  
**Mode:** Read-only inspection — no production changes, migrations, or data modifications  
**Prior baseline:** `docs/audit/` @ `c968070` + hotfixes `f3d0965`

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Local HEAD | `f3d0965` — clean working tree, aligned with `origin/redesign-v2` |
| Beta HEAD | `95152ba` — **1 commit behind** local (`f3d0965` hotfixes not deployed) |
| Vitest | 52 files / **517 passed**, 17 skipped |
| npm audit | 2 moderate (postcss XSS via Next.js) |
| Issue register | **P0: 2 · P1: 7 · P2: 10 · P3: 9** (28 total) |
| Faz B closure gate | **`CLOSURE=HAYIR`** (Jul 4 22:27 UTC — full 12-step run) |

**Verdict:** **P0–P1 first** — resolve memory attachment storage, B2 configuration, and incomplete Faz B closure before Faz C or new feature work. Architecture is sound; blockers are operational and RBAC hardening.

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
| Disk `/` | — | **86% used** (62G / 75G) |
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

## Critical Risks (Confirmed)

| Risk | Severity | Status | Evidence |
|------|----------|--------|----------|
| `APPLICATION_STORAGE_PROVIDER=memory` on beta | P0 | **TRUE** | Container env; 3 attachments `pending`, non-durable across restart |
| Faz B operational closure incomplete | P0 | **TRUE** | Gate report `CLOSURE=HAYIR`; B2/storage/E2E/email failures |
| Disk usage high | P1 | **TRUE** | 86% on `/`; backups grew to **7.5G** |
| Beta deploy lag | P1 | **TRUE** | `95152ba` vs `f3d0965` |
| B2 credentials absent | P1 | **TRUE** | Storage + off-site backup BLOCKED in closure |
| Admin DQ/ETL page guard gaps | P1 | **TRUE** | Layout-only `requireAdminSession` |
| 736 draft journals (E2E residue) | P1 | **TRUE** | Beta SQL; public routes filter correctly |
| Duplicate journal slugs | P2 | **TRUE** | 49 slug groups with count > 1 |
| Draft journal public leak | — | **FALSE (code)** | Public loaders filter `status: 'published'` |
| Git dirty local tree | — | **FALSE** | `git status --short` empty |

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
| P0 | 2 |
| P1 | 7 |
| P2 | 10 |
| P3 | 9 |
| Beta closure gate | **HAYIR** |
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
