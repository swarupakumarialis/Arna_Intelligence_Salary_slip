# ARNA Salary Suite

## Project Overview

ARNA Salary Suite is a client-side salary slip (payslip) generator built for the ARNA Learning Intelligence Studio brand. It lets a user fill in company, employee, and salary details in a form, see a pixel-accurate A4 payslip update live as they type, and export that payslip as a print-ready PDF — entirely in the browser, with no backend or database involved.

The application ships with ARNA's brand identity pre-configured (name, address, logo, colors) but every branding element is user-editable and persists locally, so the same codebase can be reused to generate payslips under a different company identity without any code changes.

## Target Users

- **HR / payroll administrators** at small-to-mid-sized organizations who need to produce professional payslips without a full payroll system.
- **Founders/operators at small companies** (like ARNA itself) who need occasional, low-volume payslip generation and want the output to look consistent with company branding.
- **Freelance accountants or consultants** issuing payslips on behalf of multiple small clients, using the branding reset/override capability to switch identities.

The tool assumes a single operator working one payslip at a time — it is not currently designed for concurrent multi-user or multi-tenant use.

## Features

### Single Payslip Generation
- Company branding (name, address, logo, GSTIN, PAN, phone, email, website — each independently toggleable)
- Employee details (name, ID, designation, department, date of joining)
- Pay period selection (month, year, paid days, LOP days)
- Free-form earnings and deductions line items (add/remove rows)
- Real-time computed totals: gross pay, total deductions, net payable
- Net pay automatically rendered in words (e.g., "Fifty Thousand Rupees Only")
- Field-level validation with inline error messages and a summary dialog before export

### Live Preview
- A4-accurate payslip preview that updates instantly on every keystroke
- Responsive scaling to fit the available panel width without affecting the underlying document size
- Optional company name watermark, authorized signatory block with uploaded signature image, and generated date/time stamps

### PDF Export
- One-click export to a downloadable, print-ready PDF at high resolution (2.5x scale)
- Filename auto-generated from employee name and pay period

### Branding System
- Editable primary/secondary brand colors with live color pickers
- Logo and signature image upload (stored as data URIs)
- 13 independent display toggles controlling exactly which branding elements appear on the payslip
- Branding configuration persists across sessions via browser local storage
- One-click reset to the ARNA default identity

## Branding

Branding is treated as **runtime-editable configuration**, not a build-time theme. The application ships with ARNA's default brand identity (name: Arnas Learning Intelligence Studio Pvt. Ltd., navy/mint color pair, ARNA logo) but nothing about the payslip is hardcoded to that identity — every visible branding element reads from a single `BrandConfig` object that the user can fully override through the form UI.

Changes are saved to the browser's local storage automatically, so a user's custom branding survives page reloads without any account or backend. A "Reset to Default" action restores the original ARNA identity at any time.

## Tech Stack

| Layer | Technology |
|---|---|
| UI framework | React 19 + TypeScript |
| Build tool | Vite 6 |
| Styling | Tailwind CSS 4 + hand-authored CSS design tokens + inline styles (for the PDF-critical preview) |
| PDF generation | html2canvas (DOM rasterization) + jsPDF (PDF assembly) |
| Text formatting | number-to-words (amount-in-words conversion) |
| Icons | lucide-react |
| Persistence | Browser `localStorage` (no backend, no database) |

The application is entirely client-side — there is no server component, API, or external service dependency at runtime.

## Folder Structure

```
src/
├── App.tsx                     # Root component: state, validation, PDF export, layout
├── main.tsx                    # React entry point
├── index.css                   # Design tokens, resets, layout, print rules
├── theme.ts                    # Static ARNA brand color reference
├── types.ts                    # Shared TypeScript interfaces
├── assets/
│   └── arnaLogo.ts             # Default ARNA logo as an inline SVG data URI
├── components/
│   ├── SalarySlipForm.tsx      # Data entry: branding, employee, period, earnings/deductions
│   ├── SalarySlipPreview.tsx   # A4 payslip preview — also the PDF export source
│   └── TaxConfiguration.tsx    # Tax rule editor (built, not yet integrated into the app flow)
└── utils/
    ├── currency.ts             # Currency formatting + amount-in-words
    └── taxCalculator.ts        # Built-in country tax configs + calculation engine
```

## PDF Workflow

1. User clicks **Export PDF**.
2. The form is validated in full; if any required field is missing, a validation dialog lists the issues and export is blocked.
3. The application waits briefly to ensure the preview has fully rendered, then captures the live preview DOM node with `html2canvas` at 2.5x scale for high print quality.
4. The captured image is embedded into a new A4 portrait PDF document via `jsPDF`.
5. The PDF is downloaded automatically as `Salary_Slip_<EmployeeName>_<Month>.pdf`.

Because the exported PDF is a rasterized capture of the same component the user sees on screen, **the live preview and the PDF are guaranteed to match exactly** — there is no separate print template to keep in sync.

## UI Workflow

1. The screen is split into two columns: a scrollable form on the left, a sticky live preview on the right.
2. All company/employee/salary fields update a single in-memory data object as the user types; the preview re-renders immediately from that same object.
3. Branding changes (logo, colors, display toggles) update a separate configuration object that is both reflected in the preview and saved to local storage automatically.
4. Validation runs continuously in the background but only surfaces errors on fields the user has already interacted with, avoiding a wall of errors on a blank form.
5. Export is a single explicit action gated behind validation passing.

## Future Goals

- Extend beyond single-payslip generation to bulk/batch payslip creation.
- Surface the existing (currently unused) tax calculation engine so deductions can be computed automatically per country/region rather than entered manually.
- Introduce persistent, structured storage of employee and salary history beyond a single in-session record.
- Expand export options beyond a single PDF format.
- See `ROADMAP.md` for the phased plan.
