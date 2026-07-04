# AcarIndex Recommended Roadmap

**Audit date:** 2026-07-05  
**Based on:** Read-only audit findings (24 issues: P0=2, P1=6, P2=9, P3=7)

---

## Guiding Principle

**Complete Faz B operational closure first.** Do not start Faz C or major new feature development until the closure gate reports `CLOSURE=EVET` and P0/P1 security and storage blockers are resolved.

Current closure status: **`CLOSURE=HAYIR`** — gate aborted at step 2 on Jul 4, 2026.

---

## Phase 0 — Unblock Faz B Closure (1–2 Days)

**Goal:** Achieve `CLOSURE=EVET` on beta pilot with all gate steps passing.

| Step | Action | Issues addressed |
|------|--------|------------------|
| 1 | Deploy `95152ba` to beta pilot (`redesign-v2`) | AUD-003, AUD-013 |
| 2 | Configure B2 application storage — run `configure-pilot-b2-storage.sh` after Backblaze credential setup | AUD-001, AUD-005, AUD-024 |
| 3 | Re-run `deploy/scripts/beta/faz-b-operational-closure-gate.sh` to completion | AUD-002 |
| 4 | Verify closure gate outputs: | |
| | — Storage integration tests (18 tests) | AUD-001 |
| | — Outbox email delivery | AUD-002 |
| | — E2E journal application flow | AUD-002 |
| | — `validate-i18n-beta.sh` | AUD-014 |
| | — Regression smoke | AUD-002 |
| | — Final report with `CLOSURE=EVET` | AUD-002 |

**Exit criteria:** Closure gate log shows all 12 steps passed; `CLOSURE=EVET`; attachments persist across container restart.

**Explicitly out of scope:** Faz C features, editor/institution panel implementation.

---

## Phase 1 — P1 Hardening (3–5 Days)

**Goal:** Close high-priority security, infrastructure, and data hygiene gaps.

| Step | Action | Issues addressed |
|------|--------|------------------|
| 5 | Add page guards to `app/admin/data-quality/page.tsx` | AUD-006 |
| 6 | Add page guards to `app/admin/etl/page.tsx` | AUD-007 |
| 7 | Disk and backup hygiene — run retention, monitor volume, configure B2 off-site backup | AUD-004, AUD-016 |
| 8 | Clean draft journal smoke artifacts — `faz6b2-cleanup-smoke-artifacts.sh` | AUD-008 |
| 9 | Rate-limit or auth-gate `/api/institutions/search` | AUD-011 |

**Exit criteria:** All P1 issues closed or accepted with documented exception; disk below 75%; admin sensitive pages require explicit permissions.

---

## Phase 2 — P2 Technical Debt (1–2 Weeks)

**Goal:** Reduce authorization complexity, improve performance, and close medium-severity security gaps.

| Step | Action | Issues addressed |
|------|--------|------------------|
| 10 | Migrate all admin routes to `admin_permissions`; disable `LEGACY_DUAL_READ` | AUD-009 |
| 11 | Performance pass on home page SSR (~2s TTFB on beta) | AUD-010 |
| 12 | Track and apply Next.js/postcss security patch | AUD-012 |
| 13 | Add rate limiting to PDF proxy route | AUD-015 |

**Exit criteria:** Single authorization path active; home TTFB under 1s on warm beta; npm audit clean or accepted with documented risk.

---

## Phase 3 — Product (After Closure `EVET` Only)

**Goal:** Deliver deferred product features and address P3 items.

| Step | Action | Issues addressed |
|------|--------|------------------|
| 14 | Editor panel direct edit (replace "yakında" placeholder) | AUD-018 |
| 15 | Institution panel management (replace "yakında" placeholder) | AUD-019 |
| 16 | Fix editor draft journal public link UX | AUD-017 |
| 17 | Deprecate global EDITOR role; document migration to journal_memberships | AUD-020 |
| 18 | Continue PG-native consolidation; remove Supabase legacy references | AUD-021 |
| 19 | Generate `types/database.ts` from Prisma when schema stable | AUD-022 |
| 20 | Fix docker compose env-file warnings | AUD-023 |

### Faz C — Do Not Start Now

Faz C (responsive testing suite, extended editor features) infrastructure exists (`playwright.beta-responsive.config.ts`, `faz6c-beta-c-responsive.sh`) but **must not begin** until:

1. Phase 0 closure gate passes with `CLOSURE=EVET`
2. P0 and P1 issues are resolved
3. B2 durable storage is verified on beta

---

## Issue Priority Summary

| Priority | Count | Phase |
|----------|-------|-------|
| P0 | 2 | Phase 0 (blockers) |
| P1 | 6 | Phase 0–1 |
| P2 | 9 | Phase 1–2 |
| P3 | 7 | Phase 3 |

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Closure gate | `CLOSURE=HAYIR` | `CLOSURE=EVET` |
| Beta SHA | `dd471eb` | `95152ba` or later |
| Storage provider | `memory` | `b2` with verified persistence |
| Application attachments | 0 rows | >0 after test upload + restart |
| Draft journals | 736 | <50 post-cleanup |
| Admin page guard gaps | 2 critical (DQ, ETL) | 0 |
| Vitest | 517 passed | Maintain or increase |
| npm audit moderate | 2 | 0 or tracked exception |

---

## Related Deliverables

- [Issue register](./issue-register.csv)
- [Security review](./security-review.md)
- [Operations review](./operations-review.md)
- [Current state audit](./current-state-audit.md)
