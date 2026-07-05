# AcarIndex Recommended Roadmap

**Audit date:** 2026-07-05 (revision)  
**Based on:** Reclassified audit — **P0: 0 · P1: 5 open · P2: 10 · P3: 10** + gate-status `GATE-001`  
**Closure gate:** **`CLOSURE=HAYIR`** (gate-status only — not a P0 finding)

---

## §22 Guiding Principle

**Complete Faz B operational closure first**, but distinguish:

1. **Application attachment storage** — private B2 bucket `acarindex-applications-pilot` (small files only)
2. **PG off-site backup** — B2 for database dumps
3. **1TB PDF archive migration** — **DEFERRED**; do not change live PDF URLs

Do not start Faz C until durable attachments (or upload disabled) and gate reports `CLOSURE=EVET`.

---

## Phase 0 — Unblock Faz B Closure (1–3 Days)

**Goal:** `CLOSURE=EVET` on beta with gate steps passing (except deferred PDF archive).

| Step | Action | Issues |
|------|--------|--------|
| 1 | Deploy latest `redesign-v2` to beta (audit + guard commits) | AUD-003 |
| 2 | **Application storage only:** configure B2 via `configure-pilot-b2-storage.sh` OR disable upload | AUD-001, AUD-005, AUD-015, AUD-028 |
| 3 | Configure PG off-site backup via `configure-pilot-b2-backup.sh` | AUD-018 |
| 4 | Re-run `faz-b-operational-closure-gate.sh` | GATE-001 |
| 5 | Verify: storage tests PASS, outbox email PASS, E2E journal flow PASS | AUD-015–017 |

**Exit criteria:** Attachments survive restart OR upload disabled with notice; gate log `CLOSURE=EVET`.

**Out of scope:** 1TB PDF B2 migration, Faz C features, slug auto-fixes.

---

## Phase 1 — P1 Hardening (3–5 Days)

| Step | Action | Issues |
|------|--------|--------|
| 6 | Admin guards (data-quality, ETL, issues, articles) | AUD-006, AUD-007 — **done** |
| 7 | Disk/backup hygiene | AUD-004 — **done** (69%) |
| 8 | Draft journal controlled cleanup (after E2E stable) | AUD-008 |
| 9 | Duplicate slug data quality review (no auto changes) | AUD-009 |
| 10 | Optional: rate limit institutions search | AUD-013 |

---

## Phase 2 — P2 Technical Debt (1–2 Weeks)

| Step | Action | Issues |
|------|--------|--------|
| 11 | Disable `LEGACY_DUAL_READ` | AUD-010 |
| 12 | Search performance | AUD-011 |
| 13 | Track Next.js/postcss patch | AUD-014 |
| 14 | PDF proxy rate limiting | AUD-019 |

---

## Phase 3 — Product (After Gate Criteria Met)

Editor panel, institution panel, announcement/data_correction flows — AUD-020–023.

### Faz C — Do Not Start Now

Requires Phase 0 gate `CLOSURE=EVET` and P1 attachment/backup resolved.

---

## §8 Transition Criteria (Yeni Özelliklere Geçiş)

| Criterion | Required | Current |
|-----------|----------|---------|
| Application attachment durable OR upload disabled | EVET | HAYIR — memory + upload open |
| Admin DQ/ETL/issues/articles explicit guards | EVET | **EVET** (this audit) |
| Beta disk <80% | EVET | **EVET** (69%) |
| Beta deployed to latest SHA | EVET | Pending deploy |
| PG off-site backup configured | EVET | HAYIR |
| Outbox all trigger paths verified | EVET | HAYIR (8 pass / 4 fail) |
| E2E journal application + publish verified | EVET | HAYIR (submit 422) |
| Faz B gate `CLOSURE=EVET` | EVET | HAYIR |
| 1TB PDF B2 migration | **HAYIR — not required** | Deferred |

**Ready for new features: HAYIR** until attachment durability (or upload off) + outbox/E2E + off-site backup.

**Full PDF/B2 migration needed now: HAYIR**

---

## §9 Functional Development Order

1. **Deploy + admin permission guards** (this audit)
2. **Application attachment persistence** — B2 `acarindex-applications-pilot` OR disable upload + pilot notice
3. **PG off-site backup** — separate from PDF archive
4. **Re-run closure gate** — storage, outbox, E2E steps
5. **Controlled draft cleanup** — dry-run doc; test artifacts only after backup
6. **Slug data quality** — analysis only; fix only canonical/sitemap conflicts
7. **Institutions search hardening** — optional rate limit (P3)
8. **Faz C / new product features** — after §8 criteria met
9. **Post-product final audit** — 1TB PDF archive migration evaluation

---

## §22 Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Closure gate | `CLOSURE=HAYIR` | `CLOSURE=EVET` |
| P0 count | 0 | 0 |
| P1 open | 5 | 0 |
| Storage provider | `memory` | `b2` OR upload disabled |
| Beta disk | **69%** | <80% |
| Admin guards | **Fixed** | Required permissions |
| Draft journals | 736 | Controlled cleanup post-E2E |
| Duplicate slug groups | 49 | No route collision (ID-in-URL OK) |

---

## Verdict

**P1 first** — not an architectural rewrite. Attachment storage decision and gate verification are the gating items; PDF archive migration is explicitly out of scope.

---

## Related Deliverables

- [Issue register](./issue-register.csv)
- [Current state audit](./current-state-audit.md)
- [Security review](./security-review.md)
