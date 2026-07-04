# AcarIndex Mobile and Accessibility Review

**Audit date:** 2026-07-05  
**Scope:** Code review + Playwright config inspection  
**Depth:** **Limited** — not a full WCAG audit or manual screen-reader pass

---

## §17 Audit Scope and Limitations

Not performed this audit:

- Full WCAG 2.x conformance testing
- axe/Lighthouse scans across all pages
- Manual screen reader testing (NVDA, VoiceOver)
- Comprehensive color contrast analysis
- Keyboard-only walkthrough of all admin flows
- Playwright responsive suite execution (Faz C blocked)

Findings reflect **code patterns** and **existing test infrastructure**.

---

## Focus Visibility (Code Review)

`app/globals.css` — global `:focus-visible`:

```css
:focus-visible {
  @apply outline-2 outline-offset-2 outline-ring rounded-sm;
}
```

Component-level `focus-visible:ring-*` utilities on:

- Home components (`HomeMainSection`, `FeaturedJournalsList`, `HomeStatsCards`, …)
- Auth forms (`PgLoginForm`, `RegisterForm`, `ResetPasswordForm`, …)
- User panel (`HesabimNav`)
- Layout (`BrandWordmark`, `SiteFooter`)
- Search and catalog pages

**Assessment:** Keyboard focus styling intentionally implemented on key public/auth surfaces. Admin panel not exhaustively reviewed.

---

## ARIA and Semantics

- Semantic HTML and selective `aria-*` in navigation/forms
- No centralized ARIA inventory
- **Gap:** No systematic audit of landmarks, `aria-live`, form labels across 25 modules

---

## Responsive Layout

| Pattern | Location | Notes |
|---------|----------|-------|
| `.content-width` | `globals.css` | `clamp(1rem, 2.5vw, 3rem)` padding |
| `.auth-page-card` | `globals.css` | Responsive padding, `min-w-0` |
| Form inputs | Search filters | `min-h-[36px]` |
| Auth card | Login/register | `p-6 sm:p-8` |

### Safe Area

**No `env(safe-area-inset-*)`** found in `globals.css` or quick repo scan. Fixed headers/footers may overlap notched devices.

### Touch Targets

No formal 44×44 px audit. Interactive elements use padding/rounded areas in user panel and auth flows.

---

## §17 Playwright Responsive Config

File: `playwright.beta-responsive.config.ts`

| Setting | Value |
|---------|-------|
| Test file | `tests/beta-responsive-auth.spec.ts` |
| Base URL | `http://127.0.0.1:3002` (beta localhost) |
| Timeout | 60 s |
| Reporter | list + JSON → `test-results/beta-responsive-report.json` |

Orchestration: `deploy/scripts/beta/faz6c-beta-c-responsive.sh` (fixture seed, Playwright, cleanup).

**Status:** Infrastructure exists; **not run** this audit. Faz C blocked until `CLOSURE=EVET`.

Vitest excludes Playwright spec via `vitest.config.ts`.

---

## Mobile-Relevant Module Notes

| Module | Mobile consideration |
|--------|---------------------|
| Public catalog | Responsive grids; `min-w-0` overflow handling |
| Search | Full-width filters; performance concern on mobile (2.6s beta) |
| Application wizard | Multi-step forms — needs touch/a11y pass when B2 live |
| Admin panel | Desktop-oriented sidebar layout |
| Editor/institution placeholders | N/A until implemented |

---

## Recommendations

### Before Production

1. Run axe-core or Lighthouse on top 10 public pages + admin dashboard.
2. Keyboard navigation test: auth, search, journal detail, application wizard.
3. Add `safe-area-inset` for fixed chrome on mobile.
4. Execute Faz C responsive Playwright suite post-closure.

### Post-Closure (P3)

- Review editor/institution panels when built.
- Test attachment upload UI with screen readers after B2 storage live.

---

## Related Deliverables

- [Functional inventory](./functional-inventory.md)
- [Recommended roadmap](./recommended-roadmap.md)
