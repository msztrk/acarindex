# AcarIndex Recommended Roadmap

**Audit date:** 2026-07-05  
**Based on:** Expanded read-only audit — 28 issues (P0=2, P1=7, P2=10, P3=9)  
**Closure gate:** **`CLOSURE=HAYIR`** (Jul 4 22:27 UTC full run)

---

## §22 Guiding Principle

**Complete Faz B operational closure first.** Do not start Faz C or major feature work until the gate reports `CLOSURE=EVET` and P0/P1 blockers are resolved.

B2 credential setup is the primary external blocker (automated browser setup failed in closure environment).

---

## Phase 0 — Unblock Faz B Closure (1–3 Days)

**Goal:** `CLOSURE=EVET` on beta with all gate steps passing.

| Step | Action | Issues |
|------|--------|--------|
| 1 | Deploy `f3d0965` to beta (`redesign-v2`) | AUD-003 |
| 2 | Configure B2 application storage — `configure-pilot-b2-storage.sh` | AUD-001, AUD-005, AUD-015, AUD-028 |
| 3 | Re-run `deploy/scripts/beta/faz-b-operational-closure-gate.sh` | AUD-002 |
| 4 | Verify gate outputs: | |
| | — 18 storage integration tests PASS | AUD-015 |
| | — Outbox real email PASS | AUD-016 |
| | — E2E journal application + publish PASS | AUD-017 |
| | — i18n validate PASS (already passed Jul 4) | — |
| | — Regression smoke PASS | — |
| | — Final `CLOSURE=EVET` | AUD-002 |

**Exit criteria:** Attachments survive container restart; gate log shows `CLOSURE=EVET`; `Faz C başlatılabilir: EVET`.

**Out of scope:** Faz C features, editor/institution implementation, announcement/data_correction wizards.

---

## Phase 1 — P1 Hardening (3–5 Days)

| Step | Action | Issues |
|------|--------|--------|
| 5 | Add guards: `data-quality/page.tsx`, `etl/page.tsx` | AUD-006, AUD-007 |
| 6 | Disk/backup hygiene — retention on 7.5G backups; monitor 86% volume | AUD-004 |
| 7 | Configure B2 off-site backup | AUD-018 |
| 8 | Clean draft journals — `faz6b2-cleanup-smoke-artifacts.sh` | AUD-008 |
| 9 | Investigate duplicate slug groups (49) — ETL or merge policy | AUD-009 |
| 10 | Rate-limit or auth-gate `/api/institutions/search` | AUD-013 |

**Exit criteria:** All P1 closed or documented exception; disk trending below 80%; admin DQ/ETL require explicit permissions.

---

## Phase 2 — P2 Technical Debt (1–2 Weeks)

| Step | Action | Issues |
|------|--------|--------|
| 11 | Disable `LEGACY_DUAL_READ`; migrate admin routes to `admin_permissions` | AUD-010 |
| 12 | Search performance — profile `/search` (~2.6s beta) | AUD-011 |
| 13 | Track Next.js/postcss patch | AUD-014 |
| 14 | PDF proxy rate limiting | AUD-019 |
| 15 | Establish performance baselines (home warm/cold) | AUD-012 |

**Exit criteria:** Single authorization path; search TTFB < 1s warm on beta; npm audit tracked.

---

## Phase 3 — Product (After `CLOSURE=EVET` Only)

| Step | Action | Issues |
|------|--------|--------|
| 16 | Editor panel direct edit | AUD-021 |
| 17 | Institution panel management | AUD-022 |
| 18 | Announcement + data_correction application flows | AUD-023 |
| 19 | Editor draft journal link UX | AUD-020 |
| 20 | Deprecate global EDITOR role | AUD-024 |
| 21 | PG-native consolidation; reduce Supabase references | AUD-025 |
| 22 | Generate `types/database.ts` from Prisma | AUD-026 |
| 23 | Fix docker compose env-file warnings | AUD-027 |

### Faz C — Do Not Start Now

Infrastructure exists (`playwright.beta-responsive.config.ts`, `faz6c-beta-c-responsive.sh`) but requires:

1. Phase 0 `CLOSURE=EVET`
2. P0/P1 resolved
3. B2 durable storage verified

---

## §22 Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Closure gate | `CLOSURE=HAYIR` | `CLOSURE=EVET` |
| Local SHA | `f3d0965` | Deployed to beta |
| Beta SHA | `95152ba` | `f3d0965` |
| Storage provider | `memory` | `b2` + restart test |
| Application attachments | 4 (3 pending) | Committed + downloadable post-restart |
| Draft journals | 736 | <50 post-cleanup |
| Duplicate slug groups | 49 | 0 for published |
| Admin DQ/ETL guards | Missing | Required permissions |
| Vitest | 517 passed | Maintain/increase |
| npm audit moderate | 2 | 0 or tracked exception |
| Beta disk | 86% | <80% |

---

## Verdict

**P0–P1 first** — not an architectural rewrite. Core catalog, auth, and application code are production-grade; beta operational validation and storage durability are the gating items.

---

## Related Deliverables

- [Issue register](./issue-register.csv)
- [Current state audit](./current-state-audit.md)
- [Operations review](./operations-review.md)
