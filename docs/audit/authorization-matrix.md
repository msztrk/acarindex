# AcarIndex Authorization Matrix

**Audit date:** 2026-07-05  
**Repository:** `D:\acarindex-web`, branch `redesign-v2`

This document describes the role-based access control (RBAC) model, dual-read authorization behavior, role capability matrix, and identified page guard gaps.

---

## RBAC Architecture

### Dual-Read Mode (Active)

`LEGACY_DUAL_READ_ENABLED = true` in `lib/auth/admin-permissions.ts`.

Authorization checks succeed if **either**:

1. The user's `admin_permissions` row grants the required permission, **or**
2. The legacy `PERMISSION_MATRIX` maps the user's global role to the permission.

This dual path increases maintenance risk and is tracked as **AUD-009 (P2)**.

### Permission Sources

| Source | Location | Status |
|--------|----------|--------|
| Database permissions | `admin_permissions` table | Primary target model |
| Legacy role matrix | `PERMISSION_MATRIX` in `lib/auth/admin-permissions.ts` | Deprecated path, still active |
| Journal memberships | `journal_memberships` | Editor panel scoping |
| Institution memberships | Institution manager roles | Institution panel scoping |

---

## Role Capability Matrix

| Role | Admin panel | User mgmt | Data quality | ETL | Content apps | Change requests |
|------|:-----------:|:---------:|:------------:|:---:|:------------:|:---------------:|
| USER | ✗ | ✗ | ✗ | ✗ | ✗ (own apps only) | ✗ |
| EDITOR (legacy global) | ✓ | ✗ | **✓ page gap** | **✓ page gap** | ✗ API | ✗ |
| MODERATOR | ✓ | ✗ | ✓ | ✓ | via permission | ✓ |
| ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| SUPER_ADMIN | ✓ | ✓ (+ assign SA) | ✓ | ✓ | ✓ | ✓ |
| journal_owner / journal_editor | Editor panel only | — | — | — | — | own CRs |
| institution_manager | Institution panel | — | — | — | — | — |

**Legend:** ✓ = intended access; ✗ = denied; **page gap** = page reachable via layout-only guard without explicit permission check.

---

## API Authorization Guards

### Public / Unauthenticated

See [functional inventory](./functional-inventory.md) — includes `/api/institutions/search` (P2).

### User Session (`getApiActiveUserSession`)

All `/api/user/*`, `/api/applications/*`, `/api/change-requests`, `/api/membership-applications`, `/api/editor/journals`, `/api/institution/memberships`.

### Admin Session Variants

| Guard | Purpose | Example routes |
|-------|---------|----------------|
| `getApiAdminSession` | General admin | Site content, verify-email |
| `getApiUserManagementSession` | User administration | Roles, status |
| `getApiAdminPermissionSession('manage_journals')` | Journal operations | Publish, membership applications |
| `getApiAdminPermissionSession('review_content_applications')` | Application review | Journal application admin |
| `getApiAdminPermissionSession('review_change_requests')` | Change request review | Admin change requests |

---

## Admin Page Guards

### Pages With Explicit Permission Guards

These pages call `requireAdminPermissionGuard`, `requireUserManagement`, or `requirePermission`:

- `users`
- `audit`
- `journals`
- `applications`
- `change-requests`
- `membership-applications`

### Pages With Layout-Only Guard (Gaps)

These pages rely on `requireAdminSession` at the layout level **without** page-specific permission checks:

| Page | Risk | Issue ID |
|------|------|----------|
| `data-quality` | EDITOR role can view via layout guard | AUD-006 |
| `etl` | EDITOR role can view via layout guard | AUD-007 |
| `issues` | Catalog read without granular permission | — |
| `articles` | Catalog read without granular permission | — |
| `authors` | Catalog read without granular permission | — |
| `pdfs` | Catalog read without granular permission | — |
| `url-aliases` | Admin read without granular permission | — |
| `site-content` | Admin read without granular permission | — |
| `health` | Admin read without granular permission | — |
| Dashboard (index) | Admin read without granular permission | — |

**Impact:** A user with the legacy global `EDITOR` role can access admin layout-protected pages including data-quality and ETL, which should require explicit permissions such as `data_quality.read` and `etl.read`.

### Recommended Fixes

1. Add `requirePermission('data_quality.read')` or `requireAdminPermissionGuard` to `app/admin/data-quality/page.tsx`.
2. Add `requirePermission('etl.read')` to `app/admin/etl/page.tsx`.
3. Audit remaining catalog/operations pages for consistent permission enforcement.

---

## Beta Verification Scripts

Smoke and role tests exist for beta validation:

- `deploy/scripts/faz6a1-beta-role-tests.sh`
- `deploy/scripts/rbac-beta-smoke.sh`

These were not re-run to completion during the aborted Faz B closure gate.

---

## Deprecated Role Notes

The global `EDITOR` role in `lib/auth/roles.ts` overlaps with journal-scoped memberships and causes authorization confusion (**AUD-020, P3**). Long-term direction: migrate to `journal_memberships` only and disable `LEGACY_DUAL_READ`.

---

## Related Deliverables

- [Security review](./security-review.md)
- [Functional inventory](./functional-inventory.md)
- [Issue register](./issue-register.csv)
