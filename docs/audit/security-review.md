# AcarIndex Security Review

**Audit date:** 2026-07-05  
**Scope:** Local repository @ `f3d0965` and beta pilot @ `95152ba` (read-only)  
**Issue counts:** P0: 2 · P1: 7 · P2: 10 · P3: 9 (28 total)

---

## §15 Executive Summary

Strong auth fundamentals: PG-native sessions, CSRF on auth mutations, rate limits, 517 passing tests, correct published-only public filtering. Critical gaps are **operational** (memory storage, incomplete Faz B closure, B2 absent) and **RBAC page guard gaps** on admin ETL/data-quality pages. Several P2 hardening items remain before production.

**Do not start Faz C** until `CLOSURE=EVET` and P0/P1 resolved.

---

## P0 Findings

### AUD-001 — Memory Attachment Storage on Beta

| Field | Detail |
|-------|--------|
| Evidence | `APPLICATION_STORAGE_PROVIDER=memory`; 3 attachments `pending`; `lib/applications/storage/index.ts` Map store |
| Impact | Uploads lost on container restart; storage integration tests fail |
| Recommendation | Configure B2; run `configure-pilot-b2-storage.sh`; verify restart persistence |

### AUD-002 — Faz B Closure CLOSURE=HAYIR

| Field | Detail |
|-------|--------|
| Evidence | Gate log `20260704_222004`; B2 BLOCKED; storage/E2E/email FAIL |
| Impact | Beta not validated for production-like journal application operations |
| Recommendation | Complete B2 setup; re-run full closure gate |

---

## P1 Findings

| ID | Title | Area |
|----|-------|------|
| AUD-003 | Beta 1 commit behind local (`f3d0965`) | Deploy |
| AUD-004 | Disk 86%; backups 7.5G | Infra |
| AUD-005 | B2 credentials absent (app + backup) | Infra |
| AUD-006 | Data quality page lacks permission guard | Security |
| AUD-007 | ETL page lacks permission guard | Security |
| AUD-008 | 736 draft journals (E2E residue) | Data |
| AUD-009 | 49 duplicate journal slug groups | Data |

---

## P2 Findings

| ID | Title | Area |
|----|-------|------|
| AUD-010 | LEGACY_DUAL_READ dual authorization path | Security |
| AUD-011 | Search page ~2.6s on beta | Performance |
| AUD-012 | Home page cold/warm variance | Performance |
| AUD-013 | Unauthenticated `/api/institutions/search` | Security |
| AUD-014 | npm audit 2 moderate (postcss) | Security |
| AUD-015 | Storage integration tests FAIL | Operations |
| AUD-016 | Outbox real email FAIL | Operations |
| AUD-017 | E2E journal flow FAIL | Operations |
| AUD-018 | B2 off-site backup BLOCKED | Operations |
| AUD-019 | PDF proxy no rate limit | Security |

---

## P3 Findings

AUD-020 through AUD-028 — see [issue register](./issue-register.csv).

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
| CSRF — user JSON APIs | Partial | Cookie SameSite; no explicit CSRF token on all user POSTs |
| Admin page authorization | **Gap** | DQ/ETL pages (P1) |
| Public data leak (drafts) | ✓ None | Published filters |
| Beta HTTP basic auth | ✓ | External access gated |
| Beta noindex | ✓ | `X-Robots-Tag: noindex` |
| Webhook signature (Resend) | ✓ When configured | Svix verification |
| Internal revalidate bearer | ✓ | `REVALIDATE_SECRET` |
| Secrets in git | ✓ Clean | See secret scan below |
| npm vulnerabilities | 2 moderate | postcss via Next |

---

## IDOR Analysis

| Surface | Mitigation |
|---------|------------|
| `/api/applications/[id]/*` | Session user must own application |
| `/api/applications/[id]/attachments/[attachmentId]/download` | Ownership + upload status check |
| `/api/user/reading-lists/[listId]` | List owned by session user |
| `/api/admin/*` | Admin permission session |
| `/api/pdf-proxy/[id]` | Published article only; no user-specific data |
| `/api/institutions/search` | **No auth** — returns institution metadata (enumeration) |

---

## CSRF Analysis

| Endpoint class | Protection |
|----------------|------------|
| `/api/auth/login`, register, reset, verify | CSRF token required |
| `/api/user/*` POST/PATCH/DELETE | Session cookie; relies on SameSite=Lax/Strict |
| `/api/applications/*` mutations | Session + ownership |
| `/api/admin/*` mutations | Admin session |

Recommendation: Document SameSite policy; consider CSRF tokens for sensitive user mutations if cross-site risk increases.

---

## Secret Scan

**Command:** `npm run source:audit-secrets`

| Location | Pattern | Risk |
|----------|---------|------|
| `.env.example` | postgresql_url_with_password | Low (placeholder) |
| `staging.env.example` | postgresql_url_with_password | Low |
| `tests/database-url.test.ts` | Masked fixtures | None |

5 hits, 3 locations, 0 git history commits with secrets. **No secret values printed.**

---

## npm Audit (§15)

```
2 moderate — postcss GHSA-qx2v-qp2m-jg93 via next@16.2.9
CVSS 6.1 — XSS via unescaped </style> in CSS stringify
```

Track Next.js releases; do not force major downgrade.

---

## Admin Authorization Gaps

| Page | Explicit guard | Issue |
|------|:--------------:|-------|
| users, audit, journals, applications, change-requests, membership-applications | ✓ | — |
| data-quality, etl | ✗ | P1 AUD-006, AUD-007 |
| issues, articles, authors, pdfs, health, site-content | ✗ layout | Lower severity read-only |

---

## Related Deliverables

- [Authorization matrix](./authorization-matrix.md)
- [Issue register](./issue-register.csv)
- [Operations review](./operations-review.md)
