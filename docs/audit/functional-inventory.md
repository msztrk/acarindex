# AcarIndex Functional Inventory

**Audit date:** 2026-07-05  
**Repository:** `D:\acarindex-web`, branch `redesign-v2`  
**Beta:** `acarindex-beta`, `/opt/acarindex`

This document inventories public and authenticated routes, API handlers, the 25-module status matrix, and panel-level functionality observed during the read-only audit.

---

## Route / API Inventory (65 Handlers)

The application exposes **65 route handlers** across `app/api/**/route.ts` files (some files export multiple HTTP methods). Handlers are grouped by authentication requirement.

### Public (No Session Required)

| Route | Method(s) | Notes |
|-------|-----------|-------|
| `/api/health` | GET | Database readiness probe |
| `/api/search-suggest` | GET | Published-only filters |
| `/api/pdf-proxy/[id]` | GET | Domain allowlist; published article PDF only |
| `/api/features` | GET | UI feature flags |
| `/api/locale/alternate` | GET | hreflang alternate URL helper |
| `/api/institutions/search` | GET | **Unauthenticated** institution search (P2 — enumeration risk) |
| `/sitemap*.xml`, article/journal sitemaps | GET | Published entities only |
| `/api/auth/login` | POST | CSRF-protected |
| `/api/auth/register` | POST | CSRF-protected |
| `/api/auth/forgot-password` | POST | CSRF-protected |
| `/api/auth/reset-password` | POST | CSRF-protected |
| `/api/auth/verify-email` | POST | CSRF-protected |
| `/api/auth/csrf` | GET | CSRF token issuance |
| `/api/auth/logout` | POST | Session termination |
| `/api/webhooks/resend` | POST | Svix signature verification when enabled |
| `/api/internal/revalidate-i18n` | POST | Bearer `REVALIDATE_SECRET` |

### Authenticated User (`getApiActiveUserSession`)

All routes under:

- `/api/user/*` — profile, overview, reading lists, saved articles, follows, recent views, notification preferences, article/journal state
- `/api/applications/*` — content and journal application lifecycle, attachments, submit, precheck
- `/api/change-requests` — user change request submission
- `/api/membership-applications` — institution membership applications
- `/api/editor/journals` — editor-scoped journal list
- `/api/institution/memberships` — institution manager memberships

### Admin API Guards

| Guard function | Routes |
|----------------|--------|
| `getApiAdminSession` | `site-content/home-hero`, `users/[id]/verify-email` |
| `getApiUserManagementSession` | `users/[id]/roles`, `users/[id]/status` |
| `getApiAdminPermissionSession('manage_journals')` | `journals/[id]/publish`, `membership-applications` |
| `getApiAdminPermissionSession('review_content_applications')` | `admin/applications/journal/[id]` |
| `getApiAdminPermissionSession('review_change_requests')` | `admin/change-requests` |

---

## 25-Module Status Matrix

| # | Module | Status | Notes |
|---|--------|--------|-------|
| 1 | Public journal catalog | **Functional** | Published filter, pagination |
| 2 | Journal detail / archive / issues | **Functional** | `getPublishedJournalById`, issue guards |
| 3 | Article detail | **Functional** | Published filter |
| 4 | Author pages | **Functional** | Published articles only |
| 5 | Search | **Functional** | Tests + published filters |
| 6 | Search suggest API | **Functional** | Published journals/articles |
| 7 | Statistics | **Functional** | Published aggregates |
| 8 | PDF proxy | **Functional** | Allowlist + tests; no app-level rate limit (P2) |
| 9 | SEO / sitemaps / JSON-LD | **Functional** | Beta `X-Robots-Tag: noindex` |
| 10 | i18n (TR/EN, hreflang) | **Functional** | Last beta validate Jul 4 14:40; not re-run in failed closure |
| 11 | User auth lifecycle | **Functional** | PG-native, CSRF, rate limits, 517 tests |
| 12 | User panel (hesabim) | **Functional** | Overview, profile, security |
| 13 | Reading lists | **Functional** | API + pages |
| 14 | Saved articles | **Functional** | |
| 15 | Follows (journals/authors) | **Functional** | |
| 16 | Recent views | **Functional** | Published entities only |
| 17 | Notifications / outbox | **Partial** | Cron installed; real email gate not completed on beta |
| 18 | Content applications (Faz A) | **Functional** | Prisma models + API; draft editor has Faz A placeholder fields |
| 19 | Journal applications (Faz B1–B5) | **Functional (code)** | Wizard, precheck, approve, publish; **beta storage not durable** |
| 20 | Membership applications | **Functional** | User + admin flows, tests |
| 21 | Change requests | **Functional** | Critical-type enforcement, admin review |
| 22 | Editor panel | **Partial** | Auth OK; **"Düşük riskli düzenleme (yakında)"** placeholder |
| 23 | Institution panel | **Partial** | **"Kurum yönetimi (yakında)"** placeholder |
| 24 | Admin catalog (journals/issues/articles/authors/pdfs) | **Functional** | List pages; journals/issues have mixed page guards |
| 25 | Admin operations (ETL, DQ, audit, health, site content) | **Partial** | **ETL & data-quality pages lack permission guards** (P1) |

---

## Application Center (Başvuru Merkezi)

### Prisma Models

- `ContentApplication`
- `JournalApplication`
- `ApplicationRevision`
- `ApplicationAttachment`
- `ApplicationReview`
- `NotificationOutbox` (Faz B5 migration applied)

### Beta Database Counts

| Table | Count | Notes |
|-------|-------|-------|
| `content_applications` | 12 | All `submitted` |
| `application_attachments` | **0** | Consistent with memory provider + container restarts |

### Storage Implementation

`lib/applications/storage/index.ts` defaults to in-memory storage unless `APPLICATION_STORAGE_PROVIDER=b2` and B2 credentials are configured. The memory store is a process-local `Map` — **attachments are lost on container restart (P0)**.

### Tests

All pass locally:

- `applications-faz-a.test.ts`
- `journal-application-faz-b1` through `b5.test.ts`

---

## Admin Panel

**Navigation:** 16 items in `AdminSidebar.tsx`.

| Area | Status |
|------|--------|
| Journal / issue / article / author / PDF lists | Functional (read/list) |
| Content application review workflow | Functional |
| Site content (home hero) | Editable |
| ETL / data-quality | Read-only lists; **missing page-level permission guards** |
| User management, audit, health | Functional with appropriate guards on key pages |

---

## Editor Panel

| Feature | Status |
|---------|--------|
| Authentication / journal scoping | Functional |
| Journal list and navigation | Functional |
| Direct in-panel editing | **Placeholder** — "Düşük riskli düzenleme (yakında)" |
| Link to public journal page for drafts | Works but returns 404 on public site (P3 UX) |

---

## Institution Panel

| Feature | Status |
|---------|--------|
| Authentication / membership scoping | Functional |
| Institution detail view | Functional |
| Institution management actions | **Placeholder** — "Kurum yönetimi (yakında)" |

---

## Placeholders and Deferred Features

| Location | Description |
|----------|-------------|
| `ApplicationDraftEditor` | Faz A placeholder contact fields |
| Editor journal page | Direct edit "yakında" |
| Institution detail page | Management "yakında" |

---

## Related Deliverables

- [Authorization matrix](./authorization-matrix.md)
- [Database integrity](./database-integrity.md)
- [Security review](./security-review.md)
