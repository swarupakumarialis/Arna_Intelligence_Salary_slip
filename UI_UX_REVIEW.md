# ARNA Salary Suite — UI/UX Review

**Reviewer perspective:** Senior Product Designer
**Method:** Static review of the live component code, computed style values, color tokens, and DOM/ARIA structure across [App.tsx](src/App.tsx), [SalarySlipForm.tsx](src/components/SalarySlipForm.tsx), [SalarySlipPreview.tsx](src/components/SalarySlipPreview.tsx), and [index.css](src/index.css). No code was modified to produce this review. Scores are grounded in specific values found in the source (spacing, color hex codes, font sizes, markup structure) rather than general impression.

**Overall score: 7.4 / 10** — A visually polished, professional-feeling tool with a genuinely strong PDF/preview output. The main gaps are underneath the surface: an informal spacing/type scale, several real accessibility omissions, and a few UI capabilities that exist in code but aren't exposed to the user.

---

## Scorecard

| Area | Score |
|---|---|
| Layout | 8.5 / 10 |
| Spacing | 6.5 / 10 |
| Typography | 6.5 / 10 |
| Branding | 8.0 / 10 |
| Alignment | 8.0 / 10 |
| Component Consistency | 6.0 / 10 |
| Forms | 7.5 / 10 |
| Buttons | 7.0 / 10 |
| PDF Preview | 9.0 / 10 |
| Export Workflow | 7.5 / 10 |
| Color Palette | 8.0 / 10 |
| Accessibility | 5.0 / 10 |
| Professional Appearance | 8.5 / 10 |

---

## Layout — 8.5/10

The two-column "form left, sticky preview right" pattern ([App.tsx](src/App.tsx)) is the correct choice for this product — it's the same mental model as Canva, DocuSign template builders, and every serious document generator. The preview is `position: sticky` above 1100px so the user never loses sight of the output while editing, and the grid collapses to a single column below that breakpoint with sensible padding reductions at 640px too.

**What's working:** the breakpoint logic in `.main-grid` is deliberate, not accidental — three distinct states (desktop split, tablet stacked, mobile compact) are handled explicitly in `index.css`.

**What holds it back from a 9–10:** the max content width (`1280px`) is comfortable on a laptop but the two-column split still forces a fairly narrow form column on 13" screens once the preview panel claims its half — worth validating on real 1366×768 hardware, which is still common in office/HR environments.

## Spacing — 6.5/10

There's a real design-token system in `index.css` for **color**, but not for **spacing**. Padding and gap values are chosen ad hoc, inline, per element: `7px`, `9px`, `10px`, `11px`, `13px`, `14px`, `16px`, `18px`, `20px`, `22px`, `24px` all appear as literal values across [SalarySlipForm.tsx](src/components/SalarySlipForm.tsx) and [SalarySlipPreview.tsx](src/components/SalarySlipPreview.tsx). None of these are wrong individually — the rhythm still *reads* as intentional because the values cluster reasonably — but there's no 4px/8px base unit being enforced, which means every new component added by a future contributor has no scale to check against, and small drift (a 13px gap here, a 14px gap there) will accumulate.

**Recommendation for later:** promote the most common values into CSS custom properties (`--space-1` through `--space-8`) the way color already is.

## Typography — 6.5/10

The type foundation is good: Inter is loaded with a full weight range (300–900), the app leans on 700–900 weight for hierarchy, and letter-spacing is used thoughtfully on uppercase labels (`0.06em`–`0.18em`).

Two real issues:

1. **No defined type scale.** Font sizes are hand-picked per element rather than drawn from a scale — the preview alone uses `6pt, 6.5pt, 7pt, 7.5pt, 8pt, 8.5pt, 9pt, 9.5pt, 10pt` as distinct, deliberately-chosen sizes ([SalarySlipPreview.tsx](src/components/SalarySlipPreview.tsx)). That's a lot of steps for one document, several of them only a half-point apart.
2. **Mixed units in the same visual system.** The preview mixes `pt` strings (`'8pt'`) with unitless numbers that resolve to `px` (e.g. the company name at `20`/`22`/`24` and the net-pay figure at `36`) inside the same component. It renders fine in-browser and in the html2canvas capture, but it's a sign there's no single source of truth for "how big is text in this document," which makes it harder to guarantee visual consistency as more payslip variants get added.
3. **No `font-variant-numeric: tabular-nums`** anywhere in the currency-formatting or table-cell code. On a financial document where amounts stack in a column (the earnings/deductions table), proportional digits can cause the numbers to visually zig-zag instead of lining up — a small but noticeable detail on a document whose entire job is to present numbers cleanly.

## Branding — 8.0/10

The branding system itself is a strength: a single `BrandConfig` object drives everything, 13 independent show/hide toggles give real control, and the persistence-to-localStorage-with-one-click-reset pattern is exactly right for this kind of tool.

Two things stop it short of a 9–10:

- **The user's brand color only styles the payslip, not the app.** Changing "Primary Brand Colour" in the form updates the preview beautifully, but the surrounding editor UI — buttons, focus rings, the Export button — stays hardcoded to ARNA navy/violet (`--arna-navy`, `--arna-violet` in `index.css`). For a tool that's explicitly designed to be rebranded (per [App.tsx](src/App.tsx)'s `BrandConfig`), the chrome staying fixed to ARNA's identity is a slightly confusing signal about what "branding" actually covers.
- **Two parallel color systems.** [theme.ts](src/theme.ts) defines a second, static ARNA palette that's exported but never imported anywhere — a leftover that doesn't affect the user experience today, but is a quiet trap for the next person who edits colors and doesn't realize there are two places colors "live."

## Alignment — 8.0/10

The preview shows real craft here: label/value rows use explicit fixed-width label columns with baseline alignment, the earnings/deductions table is a true 4-column grid (`1fr 112px 1fr 112px`) so amount columns line up regardless of content length, and the header's logo/company-name/badge arrangement is carefully proportioned (72%/28% split). This is the most rigorously aligned part of the app.

The one deduction: as noted under Typography, the absence of tabular figures means that rigor in *layout* alignment isn't fully backed up by *digit* alignment within the amount cells themselves.

## Component Consistency — 6.0/10

This is the weakest structural area, for two reasons:

1. **Duplicated input styling.** [SalarySlipForm.tsx](src/components/SalarySlipForm.tsx) defines a clean, reusable `InlineInput` component with consistent focus/error states — but `SalaryRow` (the earnings/deductions line-item editor) doesn't use it. Instead it hand-rolls its own `<input>` elements with inline `onFocus`/`onBlur` handlers that duplicate the same visual logic with hardcoded colors (`'#5B6CFF'` typed directly instead of referencing the `--arna-violet` token). Two inputs that should look and behave identically are implemented twice, with real risk of them drifting apart over time.
2. **Two styling paradigms in the codebase.** The active UI is entirely hand-authored CSS classes + inline styles. [TaxConfiguration.tsx](src/components/TaxConfiguration.tsx) — not currently mounted, but present and presumably intended for future use — is written entirely in Tailwind utility classes with its own field/label styling that doesn't match `.field`/`.field-label` at all. If that component gets wired in later without reconciliation, the app will visibly have two different form languages on screen at once.

Additionally, `index.css` defines five button variants (`.btn-primary`, `.btn-secondary`, `.btn-dark`, `.btn-ghost`, `.btn-icon`) but the live app only ever uses `.btn-dark`, on a single button. That's not harmful, but it suggests the button system was designed for a larger surface area than currently exists — worth keeping in mind so unused variants don't silently go stale.

## Forms — 7.5/10

The validation UX is genuinely good product thinking: errors are computed continuously but only *shown* once a field has been touched (via `touchedFields`), so a blank form doesn't greet the user with a wall of red. Deduction rows get real cross-field validation (name-without-amount, amount-without-name). The pre-export validation dialog clearly lists every outstanding issue in one place before blocking the download.

What keeps this from a higher score is accessibility-adjacent, not UX-adjacent: labels are rendered as visual `<label>` elements but are never programmatically associated with their inputs (no `htmlFor`/`id` pairing in `FieldLabel`/`InlineInput`), required fields aren't marked with the native `required` attribute or `aria-required`, and error messages aren't linked to their fields via `aria-describedby`. A sighted mouse user will never notice; a screen-reader user or anyone relying on browser-native form validation will have a materially worse experience. See the Accessibility section for the full list.

## Buttons — 7.0/10

The button surface is small and clean by design — one primary action (Export PDF) with a clear loading state (`Loader2` spinner + "Exporting…" label + disabled + reduced opacity), plus a handful of small utility buttons (Add row, Remove logo, Reset to Default). Nothing is overbuilt, and the states that exist are handled properly.

The gap: icon-only buttons (the trash-can delete on each earnings/deductions row, the small circular "×" on the logo/signature thumbnails) rely on a `title` attribute for context but have no `aria-label`. `title` tooltips are inconsistent across screen readers and don't reliably announce on touch devices — for an icon with no visible text, `aria-label` is the more dependable choice. Separately, hover states throughout the form are implemented via inline `onMouseEnter`/`onMouseLeave` JS handlers rather than CSS `:hover`, which works but means hover styling logic is scattered across dozens of individual elements instead of living in one stylesheet rule.

## PDF Preview — 9.0/10

This is the best-executed part of the product, and it should be — it's the entire point of the tool. The A4 proportions are exact, the header gracefully auto-reduces font size for long company names, the watermark is subtle and correctly rotated/composited, the earnings/deductions table pads itself to a minimum of 8 rows so short lists still fill the page proportionally (a smart print-design decision, not a bug), and the net-pay block uses strong contrast and scale to make the one number that matters most impossible to miss.

The only dock here is the same typographic nitpick from above (mixed pt/px units, no tabular figures) — the visual result is still clean, but the underlying implementation isn't as disciplined as the output looks.

## Export Workflow — 7.5/10

The flow is well-guarded: validation blocks incomplete exports with a specific, actionable error list rather than a generic "fix errors" message; the button shows a real loading state; failures surface as a dismissing toast rather than a silent failure or a raw console error.

Two things are missing:

- **No success confirmation.** Once the PDF downloads, there's no in-app acknowledgment (toast, checkmark, anything) — the only signal is the browser's own download indicator. For a workflow whose entire purpose is "successfully produce this document," a brief confirmation would close the loop.
- **The existing print stylesheet has no UI entry point.** `index.css` already contains a working `@media print` block scoped to `#printable-area`, but there's no "Print" button anywhere that calls `window.print()`. A user who wants to print directly (rather than export-then-print the PDF) has no way to discover that path — the capability exists in code but isn't surfaced, similar in spirit to the unconnected tax engine noted in the architecture review.

## Color Palette — 8.0/10

The ARNA palette itself (`#0F172A` navy, `#5B6CFF` blue-violet, `#0D9488` teal, `#5EEAD4` mint, `#F59E0B` amber, `#64748B` slate, `#F8FAFC` off-white) is genuinely well-chosen — cohesive, modern, reads as "fintech/edtech professional" rather than generic corporate blue. Navy-on-white and white-on-navy pairings (used for the export button and the payslip badge/net-pay block) are high-contrast and confident.

The deduction: `--clr-text-subtle` (`#94A3B8`) is used for several small, legibility-sensitive spots — footer captions, the "Powered by ARNA" line, generated date/time stamps — and its contrast against white is low enough (roughly 2.3–2.5:1) to fail WCAG AA's 4.5:1 requirement for normal-size text. This text is already small (as low as 6.5pt in the preview footer); the low contrast compounds the legibility problem, especially once the payslip is printed on paper rather than viewed on a backlit screen.

## Accessibility — 5.0/10

This is the category most worth prioritizing, because the gaps are concrete and fixable rather than subjective:

- **Labels aren't programmatically linked to inputs.** No `htmlFor`/`id` pairing anywhere in the form (`FieldLabel`, `InlineInput`, `InlineTextarea`). Screen readers cannot reliably announce "Company Name" when the corresponding text field receives focus.
- **No native `required` / `aria-required` on required fields.** Required-ness is entirely custom-JS-enforced; assistive technology and browser-native validation UI have no way to know a field is mandatory.
- **Error messages aren't linked via `aria-describedby`.** Inline errors are visually adjacent to their fields but not semantically connected, so a screen-reader user tabbing through the form won't hear "Company name is required" when landing on that field.
- **Icon-only buttons lack `aria-label`** (delete/remove actions) — see Buttons above.
- **The validation dialog isn't a real dialog.** It's a styled `<div>` with a click-outside-to-close handler, not a native `<dialog>` or a `role="dialog"`/`aria-modal="true"` element — there's no focus trap, no Escape-key handling, and focus isn't returned to the triggering button on close. For a modal that blocks the primary export action, this matters.
- **Low-contrast small text**, covered under Color Palette.

**What is working:** `:focus-visible` is defined globally with a clear, high-contrast outline (`index.css`), which is more than many apps bother with — and all uploaded images (logo, signature) correctly carry descriptive `alt` text. The foundation to fix the rest is straightforward; none of these require a redesign, just markup additions.

## Professional Appearance — 8.5/10

Taken as a whole, the app reads as a credible, well-made commercial product — the kind of polish level you'd expect from a paid SaaS tool, not an internal utility. The card-based editor, restrained motion (fade-in-up, staggered reveals), and especially the payslip output itself all support that impression. The gap between an 8.5 and a 9–10 here isn't visual — it's that a few of the details underneath (spacing/type discipline, accessibility semantics) aren't yet at the same level of rigor as the parts a user sees first, and those are exactly the details that tend to surface once the product is used by more people, printed more often, or audited for compliance.

---

## Summary of Highest-Value Fixes

If prioritizing by impact-to-effort, in order:

1. **Link labels to inputs** (`htmlFor`/`id`) and add `aria-label` to icon-only buttons — small, mechanical changes, largest accessibility payoff.
2. **Raise `--clr-text-subtle` contrast** or reserve it for non-essential decorative text only — a one-line CSS token change.
3. **Add `font-variant-numeric: tabular-nums`** to currency figures — a one-line fix with a real visual payoff on the payslip.
4. **Give the validation dialog real dialog semantics** (`role="dialog"`, `aria-modal`, focus trap, Escape to close).
5. **Consolidate `SalaryRow`'s hand-rolled inputs onto `InlineInput`** to close the component-consistency gap before more line-item-style UI gets built elsewhere.

None of the above require a visual redesign — they're refinements to an already strong foundation, not a rework of it.
