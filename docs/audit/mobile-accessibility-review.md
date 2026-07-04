# AcarIndex Mobile and Accessibility Review

**Audit date:** 2026-07-05  
**Scope:** Codebase inspection and existing test configuration  
**Depth:** **Limited** — this was not a comprehensive WCAG audit or manual screen-reader pass

---

## Audit Scope and Limitations

The read-only audit did **not** include:

- Full WCAG 2.x conformance testing
- Automated axe/Lighthouse accessibility scans across all pages
- Manual screen reader testing (NVDA, VoiceOver, TalkBack)
- Color contrast analysis across all theme variants
- Keyboard-only navigation walkthrough of all admin flows

Findings below reflect **code-level patterns** and **existing test infrastructure** observed during the audit.

---

## Global CSS — Focus Visibility

`app/globals.css` defines a global `:focus-visible` rule:

```css
:focus-visible {
  @apply outline-2 outline-offset-2 outline-ring rounded-sm;
}
```

This provides a consistent keyboard focus indicator at the base layer. Many components additionally apply Tailwind `focus-visible:ring-*` utilities for enhanced focus rings on interactive elements.

### Component-Level Focus Patterns

Widespread use of `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` across:

- Home page components (`HomeMainSection`, `FeaturedJournalsList`, `HomeStatsCards`, `TopicAreasList`, `SearchScopeLinks`)
- Auth forms (`PgLoginForm`, `RegisterForm`, `ResetPasswordForm`, `VerifyEmailPanel`)
- User panel navigation (`HesabimNav`)
- Layout (`BrandWordmark`, `SiteFooter`)
- Search and catalog pages

**Assessment:** Keyboard focus styling is intentionally implemented in key user-facing surfaces. Admin panel focus patterns were not exhaustively audited.

---

## ARIA Attributes

ARIA usage is distributed across components rather than centralized in `globals.css`. The audit noted semantic HTML and selective `aria-*` attributes in navigation and form components but did not produce a complete ARIA inventory.

**Gap:** No systematic audit of `aria-label`, `aria-labelledby`, `aria-live`, or landmark roles across all 25 modules.

---

## Safe Area / Mobile Viewport

The audit report referenced safe-area considerations for mobile layouts. **No `env(safe-area-inset-*)` usage was found** in `globals.css` or a quick repository scan during deliverable authoring.

Responsive layout utilities exist:

- `.content-width` with `clamp(1rem, 2.5vw, 3rem)` horizontal padding
- `.auth-page-card` with `min-w-0` and responsive padding
- Catalog list items with `min-w-0` overflow handling

These support mobile reflow but do not explicitly handle notched device safe areas.

---

## Responsive Design Testing

### Playwright Beta-Responsive Configuration

File: `playwright.beta-responsive.config.ts`

| Setting | Value |
|---------|-------|
| Test file | `tests/beta-responsive-auth.spec.ts` |
| Default base URL | `http://127.0.0.1:3002` |
| Timeout | 60 s |
| Reporter | list + JSON (`test-results/beta-responsive-report.json`) |

### Deployment Script

`deploy/scripts/beta/faz6c-beta-c-responsive.sh` orchestrates responsive testing on beta, including:

- Fixture seeding via `scripts/test/beta-responsive-fixtures.ts`
- Playwright run with `playwright.beta-responsive.config.ts`
- Cleanup via `scripts/test/beta-responsive-cleanup.ts`

**Note:** Faz C responsive testing infrastructure exists but **Faz C must not start** until Faz B closure completes with `CLOSURE=EVET`.

### Vitest Exclusion

`vitest.config.ts` excludes `tests/beta-responsive-auth.spec.ts` from the Vitest suite (Playwright-managed).

---

## Touch Targets and Mobile UX (Observed)

| Pattern | Observation |
|---------|-------------|
| Form inputs | `min-h-[36px]` on search filters |
| Auth card | Responsive padding `p-6 sm:p-8` |
| Navigation | Rounded interactive areas with adequate padding in user panel |

No formal minimum 44×44 px touch target audit was performed.

---

## Recommendations

### Before Production

1. Run automated accessibility scan (axe-core or Lighthouse) on top 10 public pages and admin dashboard.
2. Manual keyboard navigation test for auth, search, journal detail, and application wizard flows.
3. Add `safe-area-inset` padding for fixed headers/footers if targeting notched mobile devices.
4. Complete Faz C responsive Playwright suite only after operational closure.

### Post-Closure (P3 / Product)

- Editor and institution panel placeholders will need accessibility review when implemented.
- Application wizard attachment upload UI should be tested with screen readers after B2 storage is live.

---

## Related Deliverables

- [Functional inventory](./functional-inventory.md)
- [Recommended roadmap](./recommended-roadmap.md)
