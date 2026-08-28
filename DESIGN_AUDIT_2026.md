# IMC ER — Design Audit (System / Accessibility / Critique)

**Date:** 2026-08-28
**Scope:** `public/index.html`, `public/css/design-system-2026.css`, `public/css/style.css`, `public/js/app.js`, `public/js/components/ui-components.js`, `public/js/i18n.js`
**Method:** Full manual read of every template, stylesheet, and the JS that renders markup; grep-verified claims (usage counts, dead-code checks, keyframe references); WCAG contrast ratios computed programmatically from the actual token hex values, not eyeballed. This is a static-code review — the authenticated, data-populated screens (live patient board, Owner tab with real accounts) sit behind Firebase auth and weren't walked end-to-end in a browser, same limitation as the prior `ACCESSIBILITY_AUDIT.md`.

This builds directly on the existing `ACCESSIBILITY_AUDIT.md` in the repo rather than repeating it. Section 2 below verifies what it fixed is actually still in the code, corrects one figure, and adds gaps it didn't cover. Sections 1 and 3 are new (design system, design critique).

---

## Fixes Applied — 2026-08-28

All 8 items in the combined priority list below were fixed the same day, directly in `public/` (and mirrored into `dist/`, which is what Firebase Hosting actually serves). Verified with `npm run test:unit` (286/286 passing), `npm run test:integration` (65/65 passing), and `node scripts/build-prod.js --check` (dist/public parity confirmed) after the changes.

**One correction made during the fix, not just at audit time:** the recommendation to delete `ui-components.js` was wrong. `grep`ing only `public/` for its usage (as this audit did) missed that `tests/unit/m6-layout-adversarial-stress.test.js` imports it directly and exercises `createTriageBadge`/`createSkeletonLoader` — moving the file broke that test suite immediately. The file is **not** dead by the codebase's own definition of dead; it's untriggered by the production UI but has real test coverage. It was restored to `public/js/components/ui-components.js`, and its two actual bugs — the undefined `criticalPulse` and `pulse` keyframes — were fixed by adding both animations to `style.css` instead of deleting the file. Lesson: "never imported" claims need to be checked against `tests/` too, not just the app's own source tree.

| # | Item | Status |
|---|---|---|
| 1 | Filter cards (LOS/waitlist/room) keyboard-inoperable | ✅ Fixed — `role="button" tabindex="0"` added to all 10 static tiles + dynamically-rendered room cards, plus a delegated `keydown` handler (Enter/Space → click). Bonus: the admissions-dropdown header had the identical bug and got the same fix, plus `aria-expanded` sync. |
| 2 | Two live "outline" button treatments | ✅ Fixed — all 7 `.btn-secondary-outline` call sites migrated to `.btn-outline`; the now-unused `.btn-secondary-outline` CSS rule removed. |
| 3 | No `<main>`/skip-link landmark structure | ✅ Fixed — `<main id="main-content">` now wraps auth/access-gate/app sections; a `.skip-link` (hidden until focus) is the first focusable element in `<body>`. |
| 4 | Theme-toggle button has no accessible name | ✅ Fixed — `aria-label="Toggle theme"` added, and kept in sync with state ("Switch to dark/light mode") in `initTheme()`. |
| 5 | Heading hierarchy inverted | ✅ Fixed — "Length of Stay"/"Waitlists"/"ER Rooms" promoted to real `<h2>`; all 16 metric-card/stat-tile/room-card labels demoted from `<h3>` to a non-heading `.metric-card-label` span, with matching CSS (including the LOS on-color-text selectors) updated to target the new class instead of `h3`. |
| 6 | `ui-components.js` dead/buggy | ⚠️ **Revised, not deleted** — see correction above. Kept in place; its two undefined-keyframe bugs fixed instead. |
| 7 | Dead button variants + `stitch-*` naming | ✅ Fixed — `.btn-primary`, `.btn-success`, `.btn-warning` removed from `style.css` (confirmed zero usages first); all 35 `stitch-*` occurrences across `style.css` and `index.html` renamed to `dashboard-*`. |
| 8 | `text-muted` fails contrast on `--surface` | ✅ Fixed — light-theme `--secondary` darkened from `#6b6a63` to `#606059` (one lightness step, matching the prior audit's approach for role badges), recomputed at 5.06:1 against `--surface` — comfortably clears 4.5:1, and improves the already-passing card/page cases further. |

Also fixed along the way: `class="visually-hidden"` on the search-results live region referenced a CSS class that **was never defined anywhere** — the announcer wasn't actually hidden, it just happened not to be visually obvious. A proper `.visually-hidden` utility (standard clip-based sr-only pattern) was added and is now what backs both that live region and the new skip link's hidden-until-focus state.

---

## 1. Design System Audit

### Summary
**Files reviewed:** 4 (2 stylesheets, 2 JS component sources) | **Issues found:** 9 | **Score: 58/100**

The token layer itself (`design-system-2026.css`) is well-built — fluid type/spacing scales, a real semantic color system, light/dark parity. The problem is everything downstream of it: the component layer never finished a migration the codebase's own comments admit happened, so two generations of the same components coexist, one of them entirely dead.

### Naming Consistency

| Issue | Components | Recommendation |
|---|---|---|
| Two unrelated naming conventions for the same dashboard | `.stitch-kpi-layout`, `.stitch-workspace-layout`, `.stitch-analytics-layout`, `.stitch-command-banner`, `.stitch-console-badge` (10 rules, `style.css:999-1269`) vs. everything else (`card-`, `btn-`, `user-`, `sentinel-`) | `stitch-` is a leftover from whatever tool/mockup these layout blocks were pulled from. Rename to match the rest of the system (e.g. `dashboard-kpi-layout`) so a new contributor isn't left wondering what "stitch" refers to. |
| Two "primary" button systems | `.btn-primary` (gradient, `style.css:204`) vs. `.btn-primary-filled` (flat, `!important`-heavy, `style.css:1338`) | Only `.btn-primary-filled` is actually used anywhere in the markup — `.btn-primary` is dead (see Token Coverage). Delete the loser, keep one name. |
| Two "outline" button systems, both actually shipping | `.btn-outline` (`style.css:258`, tint background) vs. `.btn-secondary-outline` (`style.css:1345`, transparent + `!important`) — **both are live**, used side-by-side across the app (room/dept picker buttons use `.btn-outline`; login/signup/logout use `.btn-secondary-outline`) | This one isn't dead code, it's two visually different "outline button" treatments shipping in the same product. Users will see the login screen's outline buttons render slightly differently from the room-picker's. Pick one, migrate the other's call sites. |
| Dead variant classes | `.btn-success`, `.btn-warning` (`style.css:236-241`) — zero usages found in `index.html` or `app.js` | Same story as `.btn-primary`: remove, or wire them up if a use case is coming. |

### Token Coverage

| Category | Defined | Hardcoded values found |
|---|---|---|
| Colors | Full semantic scale in `design-system-2026.css` (primary/secondary/error/warning/success/CTA/LOS ramp/role colors, light+dark) | 0 stray hex colors in the CSS itself — genuinely clean. The leak is entirely in markup: **142 inline `style="..."` attributes** (78 in `index.html`, 64 in `app.js` template strings) bypass the token system with ad-hoc padding/margin/color values, e.g. `margin:0 0 5px` vs `margin:0 0 15px` vs `margin-top:0` on near-identical `<h2>` headers that should be one class. |
| Spacing | `--space-1` through `--space-10` (fluid `clamp()` scale) | Widely ignored in the inline styles above — pixel literals like `padding: 14px`, `margin-bottom: 16px`, `gap: 12px` appear throughout `index.html` and `ui-components.js` instead of the space tokens that already exist for exactly this. |
| Typography | `--font-3xs` → `--font-3xl` fluid scale | `ui-components.js` hardcodes `font-size: 12px`, `14px` etc. in every function (`createTriageBadge`, `createStatusBadge`, `createActionButton`...) instead of the scale — moot for that file specifically since it turns out to be dead code (below), but it's the pattern to not repeat. |

### Component Completeness

| Component | States | Variants | Docs | Score | Note |
|---|---|---|---|---|---|
| Buttons | ✅ hover/active/disabled via CSS | ⚠️ split across two generations, see above | ❌ none | 5/10 | Functionally fine, structurally confused |
| Modals | ✅ focus trap, Escape, `role="dialog"` (per `ACCESSIBILITY_AUDIT.md`, verified in section 2) | N/A | ❌ | 8/10 | Best-executed component in the app |
| `ui-components.js` "shared" library | ⚠️ | ✅ badges/buttons/skeletons/flowsheet/patient-card variants defined | ❌ | **0/10 — entirely dead** | See finding below |
| Metric/filter cards (LOS, waitlist, room) | ❌ no focus/active-via-keyboard state | ✅ one shape, reused consistently | ❌ | 4/10 | Consistent visually, not operable by keyboard (detailed in §2) |

### Dead code found — correction, see "Fixes Applied" above

`public/js/components/ui-components.js` (155 lines, exports `createTriageBadge`, `createStatusBadge`, `createSkeletonLoader`, `createActionButton`, `createMiniButton`, `createFlowsheetWrapper`, `createPatientCardShell`, and a `window.SharedUI` global) **is never imported by any production code** — verified with a recursive grep across `public/` for `ui-components`, zero matches outside the file itself. The app implements its own, different triage-badge and filter logic directly in `app.js` (data-attribute driven, per the existing accessibility audit's praise of that approach).

**This audit's original claim that the file was safe to delete was wrong** — the grep above only covered `public/`, and `tests/unit/m6-layout-adversarial-stress.test.js` imports the file directly and exercises `createTriageBadge`/`createSkeletonLoader`. It has real test coverage even though production doesn't use it. It's not harmless, though: it shipped two real bugs — `createTriageBadge`'s critical-alert badge referenced `animation: criticalPulse` and `createSkeletonLoader` referenced `animation: pulse`, and **neither keyframe was defined anywhere** in either stylesheet. Both are now fixed by adding the missing `@keyframes` to `style.css` rather than removing the file.

### Priority Actions
1. ✅ ~~Delete `ui-components.js`~~ — **revised**: don't delete it, it has real test coverage (`tests/unit/m6-layout-adversarial-stress.test.js`). Its two undefined-keyframe bugs are fixed. Whether to actually wire it into `app.js` as the real component layer, versus leaving it as tested-but-unused, is a product decision beyond this audit's scope.
2. ✅ **Collapsed the two outline-button systems** onto `.btn-outline`.
3. ✅ **Deleted the dead variants** (`.btn-primary`, `.btn-success`, `.btn-warning`) and renamed `stitch-*` → `dashboard-*`.

---

## 2. Accessibility Audit (WCAG 2.1 AA)
**Standard:** WCAG 2.1 AA | **Builds on:** `ACCESSIBILITY_AUDIT.md` (already in repo)

### Summary
**New/unaddressed issues found:** 4 | **Critical:** 1 | **Major:** 2 | **Minor:** 1
Plus: 1 correction to a figure in the prior audit, and confirmation that its main fixes are actually present in the code today.

### Verification of the prior audit's fixes
Spot-checked against current code rather than taken on faith:
- Modal `role="dialog"` / `aria-modal="true"` / `aria-labelledby` — present on all four modals (`index.html:279,321,330,340`). ✅
- Sentinel banner `role="alert" aria-live="assertive"` — present (`index.html:75`). ✅
- Search-results live region `#search-results-announcer` with `aria-live="polite"` — present (`index.html:171`). ✅
- No `<main>` / skip-link / landmark roles — **still absent**, confirmed still open exactly as the prior audit flagged it (grep for `<main`, `role="main"`, `skip-link` across `index.html` returns nothing).

### Correction: `text-muted` contrast
The prior audit called light-theme `text-muted` "roughly 4.3:1... under the 4.5:1 line" without specifying against what background. Recomputing the actual WCAG relative-luminance ratio for `--secondary: #6b6a63` (the token behind `text-muted`) against every background it actually sits on:

| Background | Token | Ratio | AA (4.5:1)? |
|---|---|---|---|
| `--card-bg` (~white, 85% opacity) | `#FFFFFF` effective | 5.43:1 | ✅ Pass |
| `--background` (page) | `#faf9f5` | 5.15:1 | ✅ Pass |
| `--surface` (`#e8e6dc`) | `#e8e6dc` | **4.34:1** | ❌ Fail |

So it's not a blanket failure — `text-muted` passes comfortably on cards and the page background, and only fails on the specific `--surface` tone. `--surface` is used for the tab bar and a few panel backgrounds, so this is a narrower, more actionable fix than "the whole app's secondary text is too light": darken `--secondary` by one step for light theme, or avoid pairing `text-muted` directly on `--surface`.

### Findings

#### Perceivable
| # | Issue | WCAG | Severity | Recommendation |
|---|---|---|---|---|
| 1 | `text-muted` on `--surface` backgrounds is 4.34:1, under 4.5:1 (see table above) | 1.4.3 Contrast | 🟢 Minor | Darken light-theme `--secondary` one step, verified against `--surface` specifically |

#### Operable
| # | Issue | WCAG | Severity | Recommendation |
|---|---|---|---|---|
| 1 | Every filter control on the Live Board — the 6 length-of-stay tiles, 4 waitlist tiles, and every room card — is a plain `<div>` wired only via `.onclick` (`app.js:899,910,1323`; markup at `index.html:126-141`). No `tabindex`, no `role="button"`, no `keydown` handler anywhere in the codebase for these elements. | 2.1.1 Keyboard | 🔴 Critical | A keyboard-only user cannot filter the patient board by room, wait time, or waitlist at all — the single most-used interaction on the main screen after registering a patient. Either render these as real `<button>` elements, or add `tabindex="0"`, `role="button"`, and an Enter/Space `keydown` handler to each. |
| 2 | The theme-toggle button (`index.html:96`, `id="btn-theme-toggle"`) has no text content and no `aria-label` — just the emoji `🌓`. Confirmed no `aria-label` is ever set on it anywhere in `app.js`. | 4.1.2 Name, Role, Value | 🟡 Major | A screen reader announces this control by whatever name its Unicode codepoint carries (something like "last quarter moon"), not "toggle theme" or "switch to dark mode." Add `aria-label="Toggle theme"` (updated to reflect current state, same pattern already used correctly on the sentinel banner's jump/mute buttons). |

#### Understandable
*(no new findings beyond what the prior audit already covered — form labels are present and correctly associated throughout)*

#### Robust
| # | Issue | WCAG | Severity | Recommendation |
|---|---|---|---|---|
| 1 | No `<main>` landmark or skip-to-content link (carried over from prior audit, still open) | 1.3.1 / 2.4.1 | 🟡 Major | Wrap `#auth-section`/`#access-gate`/`#app-section` content in `<main>`, add a skip link before the nav bar. This is the one item the prior audit explicitly deferred as "touches top-level page structure" — still worth doing since it's a ~15-line change. |

### Color Contrast Check (new/corrected pairs only — full triage/LOS/role tables already in `ACCESSIBILITY_AUDIT.md`)
| Element | Foreground | Background | Ratio | Required | Pass? |
|---|---|---|---|---|---|
| `text-muted` on card | `#6b6a63` | `#FFFFFF` (card-bg) | 5.43:1 | 4.5:1 | ✅ |
| `text-muted` on page | `#6b6a63` | `#faf9f5` | 5.15:1 | 4.5:1 | ✅ |
| `text-muted` on surface | `#6b6a63` | `#e8e6dc` | 4.34:1 | 4.5:1 | ❌ |

### Keyboard Navigation
| Element | Tab Order | Enter/Space | Escape |
|---|---|---|---|
| Modals (register/room/dept/discharge) | Trapped correctly (verified in prior audit) | Opens/submits via native form controls | Closes, returns focus |
| LOS / waitlist / room filter cards | **Not in tab order at all** | **Not activatable** | N/A |
| Theme/lang toggle buttons | ✅ native `<button>`, reachable | ✅ | N/A |

### Priority Fixes
1. **Make the filter cards keyboard-operable** — blocks a core workflow entirely for keyboard users, not a polish item.
2. **Add `aria-label` to the theme-toggle button** — small fix, currently an unnamed control.
3. **Add `<main>` + skip link** — carried over from the prior audit, still the right call.

---

## 3. Design Critique

### Overall Impression
This is a dense, data-heavy clinical dashboard that mostly earns its density — the triage color language, escalating LOS ramp, and role-based badges give a nurse scanning the board real signal, not just decoration. The biggest gap isn't visual, it's structural: the app was clearly assembled in at least two passes (the `stitch-*` layout blocks, the two button generations, the orphaned component library) and that seams show up as small inconsistencies a user will feel even if they can't name them.

### Usability
| Finding | Severity | Recommendation |
|---|---|---|
| Filter cards are mouse/touch-only (see Accessibility §2) | 🔴 Critical | Same fix — real buttons or `role="button"` + keydown |
| "Register Patient" (the app's single most common action) lives in a top command banner, separate from and visually distinct from the KPI/filter grid below it — good hierarchy, this is called out as a positive below | — | Keep as-is |
| The Owner tab's pending-user count uses a `.badge-pulse` on the tab itself (`index.html:98`) but the Live Board tab has no equivalent indicator for anything urgent (e.g. an ESI-1 patient) unless the sentinel banner happens to be showing | 🟡 Moderate | If the sentinel banner can be dismissed/muted, consider a persistent (non-intrusive) badge on the Live Board tab itself so a critical count is visible even from the Owner tab |
| Two visually different "outline" buttons appear in the same flows a user moves through (auth screen vs. registration modal) | 🟡 Moderate | Same fix as design-system §1 — user-visible, not just code hygiene |

### Visual Hierarchy
- **What draws the eye first:** the orange "Register Patient" hero CTA in the command banner — correct, that's the primary action on this screen.
- **Reading flow:** top-down works well — command banner → KPI/waitlist tiles → room grid + patient list → analytics/discharged. Matches how a shift actually unfolds (register → triage → discharge).
- **Emphasis:** the `<h3>` used for every metric-card label (">4 Hrs", "Wait ICU", "Total Visits") sits at the same visual weight as a true section heading would, while the actual section headers ("Length of Stay", "Waitlists", "ER Rooms") are styled `<div class="section-title">` — non-heading elements. So the heading hierarchy is inverted from what it looks like: real headings (h1→h3, skipping h2 entirely) are assigned to individual stat labels, while the things that read visually as section headers aren't headings at all. This matters for more than semantics — a screen-reader user navigating by heading list gets a wall of "> 4 Hrs, > 6 Hrs, Wait ICU, Wait CCU..." with no "Length of Stay" or "Waitlists" to orient by.

### Consistency
| Element | Issue | Recommendation |
|---|---|---|
| `<h2>` section/modal titles | Same visual role, hand-styled inline every time: `style="color:var(--primary);margin:0 0 5px"`, `style="color:var(--primary);margin-top:0"`, `style="color:var(--primary); margin: 0 0 16px 0; font-size: 1.25rem;"` — three different spacing values for what should be one heading style (`index.html:44,192,239,257,280`) | One `.section-heading`/`.modal-title` class, one spacing value |
| Buttons | Two outline generations, two dead "primary" generations (design-system §1) | Consolidate |
| Section headings vs. metric labels | Heading levels assigned backwards, see above | Swap: real `<h2>` on "Length of Stay"/"Waitlists"/"ER Rooms", demote metric-card labels to a styled `<span>`/`<p>` or `<h4>` inside the card |

### Accessibility
Full detail in §2 above. Headline: contrast is in good shape (one narrow `--surface` exception), the modal system is genuinely well done, and the filter-card keyboard gap is the one issue serious enough to call a usability problem and not just an a11y checkbox.

### What Works Well
- The LOS escalation ramp and role-color system are the strongest part of the app — driven by data attributes, not duplicated per component, and (per the prior audit) already contrast-corrected end to end.
- Modal dialogs: focus trap, `Escape`, labeled, focus-return on close — better accessibility engineering than most production apps ship.
- Information architecture / reading order on the Live Board matches the real clinical workflow.
- Bilingual support (`lang`+`dir` both updated on toggle, RTL-aware name field, Cairo font for Arabic) is handled with real care, not bolted on.

### Priority Recommendations
1. **Fix the filter cards' keyboard access** — the single change that turns a real usability/accessibility gap into a non-issue, and it's the same fix in both the accessibility and usability sections above.
2. **Finish the button-system migration** — collapse `.btn-outline`/`.btn-secondary-outline` into one, delete the dead `.btn-primary`/`.btn-success`/`.btn-warning`. Low effort, removes a visible inconsistency and a maintenance trap.
3. **Fix the inverted heading hierarchy** — promote "Length of Stay"/"Waitlists"/"ER Rooms" to real `<h2>`s, demote the per-tile labels off the heading tree. Helps sighted scanning and screen-reader navigation at once.

---

## Combined Priority List (all three audits, ranked)
1. ✅ ~~🔴 Filter cards (LOS/waitlist/room) are keyboard-inoperable — blocks a core workflow for keyboard users.~~ **Fixed.**
2. ✅ ~~🟡 Two live "outline" button treatments in the same app — user-visible inconsistency.~~ **Fixed.**
3. ✅ ~~🟡 No `<main>`/skip-link landmark structure — carried over from the prior audit, still open.~~ **Fixed.**
4. ✅ ~~🟡 Theme-toggle button has no accessible name.~~ **Fixed.**
5. ✅ ~~🟡 Heading hierarchy inverted (stat labels are headings, real section titles aren't).~~ **Fixed.**
6. ⚠️ ~~🟢 Delete or fix `ui-components.js` (dead, and buggy if it were ever wired in).~~ **Revised, not dead — kept in place, undefined keyframes fixed. See "Fixes Applied" above.**
7. ✅ ~~🟢 Delete dead button variants (`.btn-primary`, `.btn-success`, `.btn-warning`) and rename `stitch-*` classes.~~ **Fixed.**
8. ✅ ~~🟢 `text-muted` marginally fails contrast specifically on `--surface` backgrounds (4.34:1) — narrow fix, not app-wide.~~ **Fixed.**
