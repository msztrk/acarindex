# AcarIndex Authorization Matrix

**Audit date:** 2026-07-05  
**Repository:** `D:\acarindex-web`, branch `redesign-v2` @ `f3d0965`

This document describes RBAC profiles, dual-read behavior, page/API guards, and beta verification status.

---

## §4 RBAC Architecture

### Global Roles (`lib/auth/roles.ts`)

| Role | Admin panel | Typical use |
|------|:-----------:|-------------|
| USER | ✗ | Registered catalog user |
| EDITOR (legacy global) | ✓ via `legacy_admin_access` | **Deprecated** — causes guard gaps |
| MODERATOR | ✓ | Content moderation |
| ADMIN | ✓ | Full admin except super-admin assignment |
| SUPER_ADMIN | ✓ | All permissions including role assignment |

### Scoped Roles (non-global)

| Role | Panel | Scope |
|------|-------|-------|
| `journal_owner`, `journal_editor` | Editor | `journal_memberships` per journal |
| `institution_manager` | Institution | Institution membership |

### Dual-Read Mode (Active — P2 AUD-010)

`LEGACY_DUAL_READ_ENABLED = true` in `lib/auth/admin-permissions.ts`.

Authorization succeeds if **either**:

1. `admin_permissions` row grants the permission, **or**
2. Legacy `PERMISSION_MATRIX` maps global role → permission via `LEGACY_MATRIX_TO_ADMIN_PERMISSION`.

---

## Admin Permission Names

From `ADMIN_PERMISSIONS`:

`manage_users`, `manage_roles`, `manage_journals`, `manage_institutions`, `manage_articles`, `manage_pdfs`, `review_change_requests`, `review_content_applications`, `view_audit_logs`, `manage_system_settings`, `legacy_admin_access`

Legacy matrix maps `data_quality.read` → `review_change_requests` + `view_audit_logs`; `etl.read` → `manage_system_settings`.

---

## §4 Role Capability Matrix

| Capability | USER | EDITOR (legacy) | MODERATOR | ADMIN | SUPER_ADMIN | journal_editor | institution_mgr |
|------------|:----:|:---------------:|:---------:|:-----:|:-----------:|:--------------:|:---------------:|
| Admin panel layout | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| User management pages | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ |
| Data quality page | ✗ | **✓ fixed** | ✓ | ✓ | ✓ | ✗ | ✗ |
| ETL page | ✗ | **✓ fixed** | ✓ | ✓ | ✓ | ✗ | ✗ |
| Catalog lists (issues/articles) | ✗ | **✓ blocked*** | ✓ | ✓ | ✓ | ✗ | ✗ |
| Content app review | ✗ | ✗* | ✓ | ✓ | ✓ | ✗ | ✗ |
| Change request review | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Journal publish API | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Editor panel | ✗ | ✓** | ✗ | ✗ | ✗ | ✓ | ✗ |
| Institution panel | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Own applications | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Own change requests | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

\* Legacy EDITOR blocked from issues/articles via explicit `manage_journals` / `manage_articles` guards (Jul 2026 audit fix).

---

## Layout Guard

All `/admin/*` pages inherit:

```typescript
// app/admin/layout.tsx
await requireAdminSession()
```

`requireAdminSession` allows any user with admin panel access (including legacy EDITOR with `legacy_admin_access`). **Page-level permission guards are required for sensitive operations.**

---

## Admin Page Guards (19 pages)

### Explicit permission guards ✓

| Page | Guard |
|------|-------|
| `users` | `requireUserManagement()` |
| `audit` | `requireUserManagement()` |
| `journals`, `journals/[id]` | `requireAdminPermissionGuard('manage_journals')` |
| `applications`, `applications/journal/[id]` | `requireAdminPermissionGuard('review_content_applications')` |
| `change-requests` | `requireAdminPermissionGuard('review_change_requests')` |
| `membership-applications` | `requireAdminPermissionGuard('manage_journals')` |

### Layout-only (gaps)

| Page | Risk | Issue |
|------|------|-------|
| `data-quality`, `data-quality/[category]` | Legacy EDITOR can view | AUD-006 P1 |
| `etl` | Legacy EDITOR can view ETL status | AUD-007 P1 |
| `issues`, `articles`, `authors`, `pdfs` | Catalog read without granular permission | Lower — read-only |
| `url-aliases`, `site-content`, `health`, dashboard | Admin read | Lower — operational |

---

## API Authorization Guards

### Public / special

| Route pattern | Guard |
|---------------|-------|
| `/api/health`, `/api/search-suggest`, `/api/features`, `/api/locale/alternate` | None |
| `/api/institutions/search` | **None** (P2) |
| `/api/pdf-proxy/[id]` | Published article + allowlist |
| `/api/auth/*` mutating | CSRF + rate limits |
| `/api/webhooks/resend` | Svix signature |
| `/api/internal/revalidate-i18n` | Bearer secret |

### User session (`getApiActiveUserSession`)

`/api/user/*`, `/api/applications/*`, `/api/change-requests`, `/api/membership-applications`, `/api/editor/journals`, `/api/institution/memberships`

Ownership enforced in handlers (application ID must belong to session user).

### Admin API

| Guard | Routes |
|-------|--------|
| `getApiAdminSession` | `admin/site-content/home-hero`, `admin/users/[userId]/verify-email` |
| `getApiUserManagementSession` | `admin/users/[userId]/roles`, `admin/users/[userId]/status` |
| `getApiAdminPermissionSession('manage_journals')` | `admin/journals/[id]/publish`, `admin/membership-applications` |
| `getApiAdminPermissionSession('review_content_applications')` | `admin/applications/journal/[id]` |
| `getApiAdminPermissionSession('review_change_requests')` | `admin/change-requests` |

**IDOR posture:** User APIs scope by session user ID; admin APIs require permission session. Application attachment download routes verify application ownership.

**CSRF:** Auth mutating endpoints protected; user JSON APIs rely on session cookie + SameSite; admin mutations use session from admin layout context.

---

## Beta Verification (§4 direct URL tests)

| Script | Status this audit |
|--------|-------------------|
| `deploy/scripts/faz6a1-beta-role-tests.sh` | Not re-run (read-only) |
| `deploy/scripts/beta/rbac-beta-smoke.sh` | Not re-run |
| Closure gate regression | **PASS** (Jul 4 22:27) |

**Recommendation:** Re-run RBAC smoke after deploying `f3d0965` and fixing admin page guards.

---

## Related Deliverables

- [Security review](./security-review.md)
- [Functional inventory](./functional-inventory.md)
- [Issue register](./issue-register.csv)
