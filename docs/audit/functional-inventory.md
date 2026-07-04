# AcarIndex Functional Inventory

**Audit date:** 2026-07-05  
**Repository:** `D:\acarindex-web`, branch `redesign-v2` @ `f3d0965`  
**Beta:** `acarindex-beta`, `/opt/acarindex` @ `95152ba`

This document inventories routes, APIs, the 25-module status matrix, application center, admin/editor/institution panels, and gaps observed during the read-only audit.

---

## §3 Route / API Inventory

**Generated:** `npx tsx scripts/audit/collect-routes.ts` → [route-inventory.tsv](./route-inventory.tsv)

| Category | API files | Page routes |
|----------|-----------|-------------|
| Public | 12 | 18 |
| Auth (user session) | 28 | 22 |
| Editor | 1 | 3 |
| Institution | 1 | 3 |
| Admin | 8 | 19 |
| Internal | 1 | 0 |
| Legacy | 0 | 2 (`/profile`, `/applications`) |
| **Total** | **57 files / 86 handlers** | **60 pages** |

### Public APIs (no session)

| Route | Methods | CSRF | PII | Notes |
|-------|---------|------|-----|-------|
| `/api/health` | GET | — | No | DB readiness |
| `/api/search-suggest` | GET | — | No | Published-only |
| `/api/pdf-proxy/[id]` | GET | — | No | Allowlist; published PDF only; no rate limit (P2) |
| `/api/features` | GET | — | No | Feature flags |
| `/api/locale/alternate` | GET | — | No | hreflang helper |
| `/api/institutions/search` | GET | — | Low | **Unauthenticated** — enumeration risk (P2) |
| `/api/auth/*` (login, register, etc.) | POST | **Yes** | Credentials | Rate-limited |
| `/api/auth/csrf` | GET | — | No | Token issuance |
| `/api/auth/logout` | POST | Session | No | |
| `/api/webhooks/resend` | POST | Svix sig | Email meta | When enabled |
| `/api/internal/revalidate-i18n` | POST | Bearer | No | `REVALIDATE_SECRET` |

### Auth APIs (user session + ownership)

All `/api/user/*`, `/api/applications/*` (owner-scoped), `/api/change-requests`, `/api/membership-applications`, `/api/editor/journals`, `/api/institution/memberships` — guarded by `getApiActiveUserSession` with resource ownership checks in route handlers.

### Admin APIs

| Guard | Routes |
|-------|--------|
| `getApiAdminSession` | `site-content/home-hero`, `users/[userId]/verify-email` |
| `getApiUserManagementSession` | `users/[userId]/roles`, `users/[userId]/status` |
| `getApiAdminPermissionSession('manage_journals')` | `journals/[id]/publish`, `membership-applications` |
| `getApiAdminPermissionSession('review_content_applications')` | `admin/applications/journal/[id]` |
| `getApiAdminPermissionSession('review_change_requests')` | `admin/change-requests` |

**Gap:** Most admin catalog list pages have no corresponding write APIs in-app (read-only admin UI); publish workflow uses permission-guarded API.

---

## §2 — 25-Module Status Matrix

| # | Module | Status | Key routes/pages | Key APIs | Prisma models | Auth guard | Tests | Beta status | Gaps / risks |
|---|--------|--------|------------------|----------|---------------|------------|-------|-------------|--------------|
| 1 | Public journal catalog | **Functional** | `/journals`, `/journals/[...]` | — | `Journal`, `Category` | Public | `archive.test`, `urls.test` | Live 3054 published | 736 draft residue (P1) |
| 2 | Journal detail / archive / issues | **Functional** | `/journals/[...journalPath]` | — | `Journal`, `Issue` | Public published filter | `archive.test` | Live | Duplicate slugs (P1) |
| 3 | Article detail | **Functional** | `/[journalSlug]/[articleSlugAndId]` | — | `Article`, `PdfFile` | Public published | `content-availability.test` | Live 543K articles | — |
| 4 | Author pages | **Functional** | `/authors/[slugAndId]` | — | `Author`, `ArticleAuthor` | Public | `author.test` | Live 16.6K authors | — |
| 5 | Search | **Functional** | `/search` | `/api/search-suggest` | — | Public | `search.test` | **Slow ~2.6s** (P2) | Query performance |
| 6 | Search suggest API | **Functional** | — | GET suggest | — | Public | `search.test` | Live | Published-only OK |
| 7 | Statistics | **Functional** | `/istatistikler` | — | Aggregates | Public | `data-query.test` | Live | — |
| 8 | PDF proxy | **Functional** | `/pdfs/[id]` | `/api/pdf-proxy/[id]` | `PdfFile` | Public allowlist | `pdf-proxy.test` | Live | No rate limit (P2) |
| 9 | SEO / sitemaps / JSON-LD | **Functional** | sitemap routes | — | — | Public published | `jsonld.test`, `seo-url-contracts.test` | Beta noindex | Production canonical TBD |
| 10 | i18n TR/EN hreflang | **Functional** | `/en/*` prefix | `/api/locale/alternate` | — | Middleware | `i18n-*.test`, `validate-i18n-metrics.test` | Validate PASS in closure | Re-run after deploy |
| 11 | User auth lifecycle | **Functional** | login, register, verify, reset | `/api/auth/*` | `User`, `Session` | CSRF + rate limit | `auth-*.test` (10+ files) | Live PG-native | — |
| 12 | User panel (hesabim) | **Functional** | `/hesabim/*` | `/api/user/overview`, profile | `UserProfile` | Session | `user-panel.test` | Live | — |
| 13 | Reading lists | **Functional** | `/hesabim/listeler` | `/api/user/reading-lists` | `ReadingList` | Session owner | `user-panel.test` | Live | — |
| 14 | Saved articles | **Functional** | `/hesabim/kaydedilen` | `/api/user/saved-articles` | `SavedArticle` | Session owner | `user-panel.test` | Live | — |
| 15 | Follows (journals/authors) | **Functional** | takip pages | `/api/user/follows/*` | `FollowedJournal`, `FollowedAuthor` | Session | `interest-personalization.test` | Live | — |
| 16 | Recent views | **Functional** | `/hesabim/son-goruntulenen` | `/api/user/recent-views` | `RecentView` | Session published-only | `user-panel.test` | Live | — |
| 17 | Notifications / outbox | **Partial** | `/hesabim/bildirimler` | outbox processor cron | `NotificationOutbox`, prefs | Session | `notification-outbox.test` | Cron OK; **real email FAIL** in closure | Resend verification pending |
| 18 | Content applications (Faz A) | **Partial** | `/hesabim/basvurular/yeni` | `/api/applications` | `ContentApplication`, revisions | Session owner | `applications-faz-a.test` | 4 apps (3 draft, 1 revision) | **announcement/data_correction unbuilt** (P3) |
| 19 | Journal applications (Faz B1–B5) | **Partial (code OK)** | wizard pages | `/api/applications/journal/*` | `JournalApplication`, attachments | Session + admin review | `journal-application-faz-b*.test` | **Storage memory P0**; E2E FAIL | B2 blocked |
| 20 | Membership applications | **Functional** | kurum basvuru | `/api/membership-applications` | `MembershipApplication` | Session + admin | RBAC tests | Live | — |
| 21 | Change requests | **Functional** | admin change-requests | `/api/change-requests` | `ChangeRequest` | Session + admin permission | `rbac-authorization.test` | Live | — |
| 22 | Editor panel | **Partial** | `/editor`, `/editor/[journalId]` | `/api/editor/journals` | `JournalMembership` | Journal scope | `rbac-phase3-panels.test` | Auth OK | **Direct edit placeholder** (P3) |
| 23 | Institution panel | **Partial** | `/kurum`, `/kurum/[id]` | `/api/institution/memberships` | Institution models | Membership scope | `rbac-phase3-panels.test` | Auth OK | **Management placeholder** (P3) |
| 24 | Admin catalog | **Functional** | journals, issues, articles, authors, pdfs | publish API | Catalog models | Mixed page guards | `page-loaders-mock.test` | Live read lists | Some pages layout-only guard |
| 25 | Admin operations | **Partial** | ETL, DQ, audit, health, site-content | admin APIs | ETL metadata | **DQ/ETL guard gap P1** | `etl-guard.test` | Live | ETL/DQ reachable by legacy EDITOR |

---

## §5 Application Center (Başvuru Merkezi)

### Prisma Models

- `ContentApplication`, `ApplicationRevision`, `ApplicationEvent`, `ApplicationReview`
- `ApplicationAttachment`, `ApplicationPrivateContact`
- `JournalApplication`, `JournalApplicationSubjectArea`, `ApplicationDeclarationAcceptance`
- `NotificationOutbox`

### Beta Database Counts (read-only, 2026-07-05)

| Table / metric | Count | Notes |
|----------------|-------|-------|
| `content_applications` | 4 | 3 `draft`, 1 `revision_requested`; all `new_journal` kind |
| `journal_applications` | 4 | Linked to content applications |
| `application_attachments` | 4 | 3 `pending`, 1 `committed` |
| Orphan attachments | 0 | FK integrity OK |
| `notification_outbox` | 8 sent | Cron processing active |

### Unbuilt Application Types (P3 — AUD-023)

API and UI accept `announcement` and `data_correction` kinds (`lib/applications/types.ts`, `/hesabim/basvurular/yeni`) but:

- No dedicated multi-step wizard (unlike journal application Faz B)
- No admin review workflow pages specific to duyuru / veri düzeltme
- Generic draft editor uses Faz A placeholder contact fields

### Storage (P0 — AUD-001)

`lib/applications/storage/index.ts` — memory `Map` when `APPLICATION_STORAGE_PROVIDER≠b2`. Beta container env: **`memory`**. Attachments non-durable across restart; 3 uploads still `pending`.

### Tests (all pass locally)

`applications-faz-a.test.ts`, `journal-application-faz-b1` through `b5.test.ts`

---

## §6 Admin Panel

**Navigation:** 16 items in `AdminSidebar.tsx` · **19 page routes**

| Page | Permission guard | Status |
|------|------------------|--------|
| Dashboard (`/admin`) | Layout only | Functional overview |
| users | `requireUserManagement` | Functional |
| audit | `requireUserManagement` | Functional |
| journals, journals/[id] | `requireAdminPermissionGuard('manage_journals')` | Functional |
| applications, journal/[id] | `requireAdminPermissionGuard('review_content_applications')` | Functional workflow |
| change-requests | `requireAdminPermissionGuard('review_change_requests')` | Functional |
| membership-applications | `requireAdminPermissionGuard('manage_journals')` | Functional |
| issues, articles, authors, pdfs | Layout only | Read-only lists |
| url-aliases, site-content, health | Layout only | Functional |
| **data-quality**, **data-quality/[category]** | **Layout only — P1 gap** | Read lists |
| **etl** | **Layout only — P1 gap** | Read-only ETL status |

---

## §7 Editor Panel vs Change Policy

| Feature | Status | Notes |
|---------|--------|-------|
| Authentication / journal scoping | Functional | `journal_memberships` |
| Journal list | Functional | `/editor`, API `/api/editor/journals` |
| Direct in-panel editing | **Placeholder** | "Düşük riskli düzenleme (yakında)" |
| Change requests | Functional | Users submit via `/api/change-requests`; admin reviews |
| Link to public journal for drafts | Works but 404 public | P3 UX (AUD-020) |

Change policy: low-risk direct edit deferred; high-risk changes go through change request workflow (implemented).

---

## §8 Institution Panel

| Feature | Status |
|---------|--------|
| Authentication / membership scoping | Functional |
| Institution list and detail | Functional |
| Membership applications | Functional (user + admin) |
| Institution management actions | **Placeholder** — "Kurum yönetimi (yakında)" |

---

## §12 Search Audit

| Check | Result |
|-------|--------|
| Published-only filter in search data layer | **Pass** — `lib/data/search.ts` |
| Search suggest API | Published-only |
| Beta `/search?q=test` latency | **2.615 s** — P2 (AUD-011) |
| Tests | `search.test.ts` passes locally |

---

## §13 File / PDF / Upload

| Component | Status | Risk |
|-----------|--------|------|
| PDF proxy | Functional | No rate limit (P2) |
| Application attachments | **Memory storage on beta** | **P0** — non-durable |
| PDF catalog admin | Read-only list | — |
| Upload flow code | Functional in tests | Blocked on beta by storage provider |

---

## §14 Notifications / Outbox

| Item | Status |
|------|--------|
| `NotificationOutbox` model + migration | Applied on beta |
| Cron every 5 min | Installed |
| Outbox rows | 8 `sent` on beta |
| Real email verification | **FAIL** in closure gate (AUD-016) |
| User notification prefs | Functional (`productAnnouncements`, etc.) |

---

## §18 UI Consistency / Terminology

| Area | Observation |
|------|-------------|
| TR primary UI | Consistent across public and panels |
| EN routes | `/en/` prefix; hreflang pairs |
| Admin vs user terminology | "Başvuru" vs "Application" aligned in TR |
| Placeholder copy | "yakında" used consistently in editor/institution panels |
| Legacy routes | `/profile`, `/applications` redirect patterns exist |

---

## §19 Test Coverage Inventory

| Metric | Value |
|--------|-------|
| Vitest files | 54 |
| Tests run | 517 passed, 17 skipped |
| Playwright responsive | 1 spec (`beta-responsive-auth.spec.ts`) — not executed this audit |
| Faz B application tests | 6 dedicated files (A + B1–B5) |
| RBAC / auth tests | 8+ files |
| External HTTP tests | `tests/external/urls-http.test.ts` (separate config) |

---

## §21 Legacy / Tech Debt (grep summary)

| Pattern | Approx. hits | Notes |
|---------|--------------|-------|
| Supabase references | 50+ files | ETL scripts, legacy types, package deps — runtime auth is PG-native |
| `LEGACY_DUAL_READ` | Active | P2 authorization debt |
| Global `EDITOR` role | Deprecated | Overlaps journal memberships |
| `types/database.ts` | Manual placeholder | P3 |
| `/auth/callback`, `/auth/signout` | Legacy Supabase routes | Still present |

---

## Related Deliverables

- [Authorization matrix](./authorization-matrix.md)
- [Database integrity](./database-integrity.md)
- [Security review](./security-review.md)
- [Route inventory TSV](./route-inventory.tsv)
