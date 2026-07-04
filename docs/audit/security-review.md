# AcarIndex Security Review

**Audit date:** 2026-07-05  
**Scope:** Local repository and beta pilot (read-only)  
**Issue counts:** P0: 2 · P1: 6 · P2: 9 · P3: 7 (24 total)

---

## Executive Summary

The codebase demonstrates strong auth fundamentals (PG-native sessions, CSRF, rate limits, 517 passing tests) and correct published-only public data filtering. Critical security gaps are operational rather than application-logic defects: in-memory attachment storage on beta, incomplete Faz B closure, missing admin page guards for sensitive operations pages, and several P2 hardening items before production.

**Do not start Faz C** until P0/P1 items and operational closure are resolved.

---

## P0 Findings (Critical)

### AUD-001 — Memory Attachment Storage on Beta

| Field | Detail |
|-------|--------|
| Area | Storage |
| Evidence | Container env `APPLICATION_STORAGE_PROVIDER=memory`; `/etc/acarindex/pilot.env`; `B2_APPLICATION_KEYS=0` in closure pre-check |
| Impact | Application attachments stored in process-local memory; **lost on container restart** |
| Recommendation | Configure B2 credentials; run `configure-pilot-b2-storage.sh`; re-run storage tests |

Implementation: `lib/applications/storage/index.ts` uses a `Map`-backed store when B2 is not configured.

### AUD-002 — Faz B Operational Closure Incomplete

| Field | Detail |
|-------|--------|
| Area | Operations |
| Evidence | 86-line gate log at `/var/log/acarindex-faz-b-closure-20260704_213743.log`; no `CLOSURE=EVET` |
| Impact | Storage, outbox email, E2E, and i18n validation steps never completed in latest closure attempt |
| Recommendation | Deploy `95152ba`; re-run `faz-b-operational-closure-gate.sh` to completion |

---

## P1 Findings (High)

### AUD-003 — Beta Deploy Lag

Beta SHA `dd471eb` is **1 commit behind** GitHub/local `95152ba`. The missing commit fixes host `pg_restore` failure in the closure gate script.

### AUD-004 — Disk Pressure

Beta root volume at **80–82%** utilization with ~3GB pilot backups on the same disk.

### AUD-005 — B2 Credentials Absent

No Backblaze B2 keys for application storage or off-site backup (`B2_BLOCKED` in closure gate step 8).

### AUD-006 — Data Quality Page Guard Gap

`app/admin/data-quality/page.tsx` lacks `requirePermission` — reachable by legacy `EDITOR` role via layout-only `requireAdminSession`.

### AUD-007 — ETL Page Guard Gap

`app/admin/etl/page.tsx` lacks `requirePermission('etl.read')` — same layout-only guard issue.

### AUD-008 — Draft Journal Residue

736 draft journals in pilot DB from E2E/smoke runs. Not a public leak (code filters correctly) but increases noise and storage.

---

## P2 Findings (Medium)

### AUD-009 — LEGACY_DUAL_READ Authorization

Two authorization code paths active in `lib/auth/admin-permissions.ts`. Increases risk of permission drift between DB permissions and legacy matrix.

### AUD-010 — Home Page Performance

~2.034 s TTFB on beta home (`curl` to localhost:3002). Not a direct security issue but affects availability under load.

### AUD-011 — Unauthenticated Institution Search

`GET /api/institutions/search` (`app/api/institutions/search/route.ts`) requires no session. Enables institution enumeration.

**Recommendation:** Require authenticated session or apply rate limiting.

### AUD-012 — npm Audit (2 Moderate)

postcss XSS advisory (GHSA-qx2v-qp2m-jg93) via `next@16.2.9`. Track Next.js patch releases.

### AUD-013 — Closure Gate pg_restore Failure

Host-side `pg_restore: command not found` aborted closure at step 2. **Fixed in `95152ba`** — deploy and re-run.

### AUD-014 — i18n Validate Not in Latest Closure

Last successful `validate-i18n-beta.sh`: Jul 4 14:40. Not re-run during aborted closure attempt.

### AUD-015 — PDF Proxy Rate Limit

`app/api/pdf-proxy/[id]/route.ts` implements domain allowlist and published-article checks. Comments note rate limiting is deferred.

**Recommendation:** Add edge or application rate limit before production exposure.

### AUD-016 — B2 Off-Site Backup Blocked

Closure gate step 8 blocked — `B2_BACKUP_KEY_ID` not configured.

---

## P3 Findings (Low)

| ID | Title | Area |
|----|-------|------|
| AUD-017 | Editor links to public page for draft journals | UX |
| AUD-018 | Editor panel direct edit placeholder | Product |
| AUD-019 | Institution panel management placeholder | Product |
| AUD-020 | Deprecated global EDITOR role confusion | Tech debt |
| AUD-021 | Supabase/ETL legacy references | Tech debt |
| AUD-022 | `types/database.ts` manual placeholder | Tech debt |
| AUD-023 | Docker Compose POSTGRES_USER warnings | Infra |
| AUD-024 | 0 application_attachments despite 12 submitted apps | Data |

---

## Secret Scan

**Command:** `npm run source:audit-secrets` (working-tree)

| File | Pattern | Risk |
|------|---------|------|
| `staging.env.example` | Example Supabase URL | Low (placeholder) |
| `tests/database-url.test.ts` | Masked test fixtures | None |

No live credentials in tracked source. `.env.local` (gitignored) exists locally — not scanned; must not be committed.

---

## Authentication and Session Security (Positive Findings)

| Control | Status |
|---------|--------|
| PG-native auth (no Supabase runtime dependency) | Active |
| CSRF on mutating auth endpoints | Active |
| Rate limits on auth flows | Tested |
| Resend webhook Svix signature | When enabled |
| Internal revalidate bearer secret | `REVALIDATE_SECRET` required |
| Public draft journal leak | **Not present** — published filters enforced |

---

## Admin Authorization Gaps Summary

| Page | Guard present | Issue |
|------|:-------------:|-------|
| users, audit, journals, applications, change-requests, membership-applications | ✓ | — |
| data-quality, etl | ✗ | P1 — AUD-006, AUD-007 |
| issues, articles, authors, pdfs, url-aliases, site-content, health, dashboard | ✗ (layout only) | Lower severity catalog read |

See [authorization matrix](./authorization-matrix.md) for full role table.

---

## npm Audit Detail

```
2 moderate severity vulnerabilities
postcss <=8.4.30 (GHSA-qx2v-qp2m-jg93) — XSS via next@16.2.9 dependency chain
```

No forced upgrade applied during audit.

---

## Related Deliverables

- [Authorization matrix](./authorization-matrix.md)
- [Issue register](./issue-register.csv)
- [Recommended roadmap](./recommended-roadmap.md)
- [Operations review](./operations-review.md)
