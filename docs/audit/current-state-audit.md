# AcarIndex Current State Audit

**Audit date:** 2026-07-05  
**Scope:** Local repository (`D:\acarindex-web`, branch `redesign-v2`) and beta pilot (`acarindex-beta`, `/opt/acarindex`)  
**Mode:** Read-only inspection — no production changes, migrations, or data modifications

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Local / GitHub HEAD | `95152ba` — clean working tree, aligned with `origin/redesign-v2` |
| Beta HEAD | `dd471eb` — **1 commit behind** local |
| Vitest | 52 files / **517 passed**, 17 skipped |
| npm audit | 2 moderate (postcss XSS via Next.js) |
| Issue register | **P0: 2 · P1: 6 · P2: 9 · P3: 7** (24 total) |

**Primary recommendation:** Resolve P0/P1 findings and complete Faz B operational closure before starting new feature work or Faz C. Memory attachment storage and an incomplete closure gate block production-like beta operations.

---

## System Snapshot

| Item | Local | Beta (`acarindex-beta`, `/opt/acarindex`) |
|------|-------|-------------------------------------------|
| Git SHA | `95152ba1bce3e6044aa833ac394888b1ec58b151` | `dd471ebebe7b4d48a0de0966a93c9c78bec9238a` |
| Branch | `redesign-v2` | `redesign-v2` |
| Working tree | **Clean** | N/A |
| Stack | Next.js **16.2.9**, React 19, Prisma **6.19**, Postgres 16 | `docker-compose.pilot.yml` |
| App container | — | `acarindex-web:pilot` (Up, healthy, `:3002→3000`) |
| Postgres | — | `postgres:16-alpine` (healthy) |
| MariaDB (ETL source) | — | `mariadb:10.11` (healthy) |
| Disk `/` | — | **80–82% used** (57–59G / 75G) |
| Migrations | — | 15 applied, **no pending**; latest: `20260714100000_notification_outbox_faz_b5` |
| Backups | — | `/var/backups/acarindex-pilot` ≈ **3.0G** (2×1.5G milestone dumps) |
| Outbox cron | — | **Installed** (every 5 min) |

---

## SHA Alignment

| Environment | SHA | Status |
|-------------|-----|--------|
| Local | `95152ba` | Current |
| GitHub (`origin/redesign-v2`) | `95152ba` | Aligned with local |
| Beta pilot | `dd471eb` | **1 commit behind** local |

The missing commit (`95152ba`) fixes `deploy/scripts/beta/faz-b-operational-closure-gate.sh` to invoke `pg_restore` inside the Postgres container instead of relying on a host binary.

Beta closure log (`/var/log/acarindex-faz-b-closure-20260704_213743.log`, 86 lines) **aborted at step 2** with `pg_restore: command not found` on the host. The gate never reached steps 3–12 or emitted `CLOSURE=EVET`.

---

## Critical Risks (Confirmed)

| Risk | Severity | Status | Evidence |
|------|----------|--------|----------|
| `APPLICATION_STORAGE_PROVIDER=memory` on beta | P0 | **TRUE** | Container env: `memory`; `/etc/acarindex/pilot.env` sets provider; `B2_APPLICATION_KEYS=0` in closure pre-check |
| Faz B operational closure incomplete | P0 | **TRUE** | Gate log truncated; no final report; default script vars `CLOSURE=HAYIR`, `RESULT_*=FAIL` |
| Disk usage high | P1 | **TRUE** | 80–82% on `/`; ~3GB pilot backups on same volume |
| Beta deploy lag | P1 | **TRUE** | `dd471eb` vs `95152ba` |
| B2 credentials absent | P1 | **TRUE** | No application or backup B2 keys configured |
| Git dirty local tree | — | **FALSE** | `git status --short` empty |
| Draft journal public leak | — | **FALSE (code)** | Public loaders filter `status: 'published'`; 736 draft journals exist in DB (E2E/smoke artifacts) but public routes filter correctly |

---

## Secret Scan Summary

Command: `npm run source:audit-secrets` (working-tree scan via `scripts/audit-secrets.ts`).

| Finding | Severity | Notes |
|---------|----------|-------|
| `staging.env.example` | Low | Example Supabase URL pattern only |
| `tests/database-url.test.ts` | None | Masked test fixtures |

No live credentials found in tracked source. `.env.local` exists locally (gitignored) and was not scanned — ensure it is never committed.

---

## Test Suite

| Metric | Value |
|--------|-------|
| Test files | 54 `*.test.ts` under `tests/` |
| Vitest result | **517 passed**, 17 skipped, 52 files run |
| Coverage areas | RBAC, auth security, journal applications (Faz B1–B5), i18n, SEO URLs, PDF proxy, notification outbox |

---

## npm Audit

| Severity | Count | Detail |
|----------|-------|--------|
| Moderate | 2 | postcss XSS (GHSA-qx2v-qp2m-jg93) via `next@16.2.9` |

No `--force` fix was applied during the audit.

---

## Performance (Beta curl, localhost:3002)

| Route | Response time |
|-------|---------------|
| `/api/health` | 0.005 s |
| `/journals` | 0.087 s |
| `/` (home) | **2.034 s** (P2 — cold SSR / catalog load) |

---

## Related Deliverables

- [Functional inventory](./functional-inventory.md)
- [Authorization matrix](./authorization-matrix.md)
- [Database integrity](./database-integrity.md)
- [Security review](./security-review.md)
- [Issue register](./issue-register.csv)
- [Recommended roadmap](./recommended-roadmap.md)
