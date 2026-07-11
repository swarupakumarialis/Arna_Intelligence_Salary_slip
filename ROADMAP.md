# ARNA Salary Suite — Roadmap

This roadmap tracks the evolution of ARNA Salary Suite from its current single-payslip tool into a fuller payroll utility. It is organized in three phases, ordered by dependency — later phases build on data and infrastructure introduced in earlier ones.

---

## Phase 1 — Core Payslip Generator (Completed)

The current production state of the application.

- [x] Single-employee payslip form (employee, pay period, earnings, deductions)
- [x] Real-time, A4-accurate live preview
- [x] Editable company branding (logo, colors, identity fields, 13 display toggles)
- [x] Branding persistence via local storage, with reset-to-default
- [x] Field-level form validation with inline errors and a pre-export summary dialog
- [x] Net pay automatically rendered in words
- [x] One-click, high-resolution PDF export
- [x] Responsive preview scaling independent of export fidelity

**Known gaps carried out of Phase 1:** a tax calculation engine and tax configuration editor exist in the codebase but are not yet connected to the main workflow — deductions are currently entered manually. This is a candidate for early Phase 2 work.

---

## Phase 2 — Operational Payroll Tooling

Moves the product from "generate one payslip" to "manage payroll data for a team." This phase introduces the first persistent, structured data model beyond a single in-session record.

### Dashboard
A landing view summarizing payroll activity at a glance — recent payslips generated, employee count, upcoming pay periods, and quick actions.

### Employee Master
A persistent employee directory (add/edit/deactivate employees, store recurring details like bank information and standard salary structure) so employee data doesn't need to be re-entered for every payslip.

### Salary History
A record of previously generated payslips per employee, viewable and re-exportable, enabling month-over-month and year-over-year reference without regenerating from scratch.

### Excel Export
Bulk export of salary and payslip data to spreadsheet format, for finance/accounting workflows that consume payroll data outside the app.

### Reports
Aggregate views over salary history — department-wise totals, monthly payroll cost summaries, and deduction breakdowns — built on top of the Employee Master and Salary History data introduced in this phase.

---

## Phase 3 — Multi-Tenant & Distribution

Broadens the tool from a single-organization utility to something distributable and safely reusable across contexts, and prepares it for packaged distribution.

### Company Profiles
Support for multiple distinct branding/company configurations within one installation, so the same tool can generate payslips for more than one organization without overwriting the active brand configuration.

### Backup
User-initiated export of all application data (employee master, salary history, branding, company profiles) to a portable file.

### Restore
Import of a previously exported backup file, restoring full application state — enabling migration between devices and recovery from data loss.

### Splash Screen
A branded loading screen for the application shell, appropriate for a packaged desktop or installed experience rather than a bare browser tab.

### Installer
Packaging the application for installation as a standalone desktop application, removing the dependency on manually running a dev/build server to use the tool.

---

## Sequencing Notes

- Phase 2 introduces the first real persistence layer (Employee Master, Salary History). This is a prerequisite for everything in Phase 3 — Company Profiles, Backup, and Restore all assume there is meaningful structured data worth carrying across sessions and installations.
- Wiring up the existing tax calculation engine (see Phase 1 known gaps) is lower-risk to schedule early in Phase 2, since it extends the current data model rather than introducing a new one.
- Splash Screen and Installer are UI/packaging concerns and can proceed in parallel with the rest of Phase 3 once a target distribution format (e.g., desktop shell) is decided.
