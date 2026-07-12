# ARNA Salary Suite

A full-stack payroll management platform: salary slip generation with a live A4 preview and PDF export, an employee directory, salary history with a searchable archive, payroll export to Excel, automated email delivery of payslips, and a payroll analytics dashboard.

Built for Arnas Learning Intelligence Studio Pvt. Ltd. ("ARNA"), designed to stay tenant-neutral so it can be white-labelled for another company.

## Features

- **Salary Generator** — Live-updating A4 payslip preview, employee autofill from the directory, free-form earnings/deductions, PDF export (html2canvas + jsPDF).
- **Employee Directory** — Searchable/filterable (department, employment type, status) employee database with full CRUD, backed by MongoDB.
- **Salary History** — Every generated payslip is recorded automatically; searchable, filterable, re-downloadable, and re-loadable back into the generator.
- **Payroll Export** — Export a month/year of salary history to Excel (`.xlsx`).
- **Email Automation** — Sends the already-archived PDF (never regenerated) as an email attachment via Nodemailer, with a delivery log.
- **PDF Archive** — Every exported payslip PDF is stored server-side and linked back to its salary history record.
- **Dashboard** — KPI cards, monthly payroll trend, salary distribution, employee/employment-type breakdown, recent activity, quick actions.
- **Company Settings** — Branding (name, address, logo, primary/secondary colour) used across the payslip and app chrome.
- **Documents / Tax Center** — UI-only "coming soon" placeholders for a future document library and tax-forecast tooling; no backend behind them yet.

## Technology Stack

**Frontend**
- React 19 + TypeScript, built with Vite 6
- Plain CSS (`src/index.css`, custom properties) for nearly all UI — Tailwind is wired in via `@tailwindcss/vite` but only load-bearing for one modal's overlay positioning
- `html2canvas` + `jsPDF` for PDF generation, `xlsx` for payroll export, `lucide-react` for icons

**Backend**
- Node.js + Express (ESM), MVC structure (`models/` → `services/` → `controllers/` → `routes/`)
- Mongoose + MongoDB Atlas
- `multer` for PDF uploads, `nodemailer` for email delivery
- Every response uses one JSON envelope: `{ success, message, data }`

**Auth**: a simple, static username/password check on the frontend (`src/config/authConfig.ts`) gating access to the whole app — there is no backend session/token system yet. See Known Limitations.

## Folder Structure

```
.
├── src/                        # Frontend
│   ├── api/                    # One file per backend resource (employeeApi.ts, salaryHistoryApi.ts, pdfApi.ts, emailApi.ts)
│   ├── components/
│   │   ├── auth/                # ProtectedRoute
│   │   ├── dashboard/            # KPI cards, charts, panels
│   │   │   └── charts/            # Reusable BarChart / DonutChart primitives
│   │   ├── employees/            # Add/Edit + View modals for the Employee Directory
│   │   ├── layout/                # TopNav, Sidebar, Footer
│   │   ├── pdf/                    # Off-screen payslip layout captured for PDF export
│   │   ├── preview/                # Live preview toolbar/zoom controls
│   │   ├── share/                  # Email/Share modal + menus
│   │   └── ui/                     # Generic building blocks (Card, EmptyState, StatusBadge, …)
│   ├── config/                  # authConfig.ts (static demo credentials)
│   ├── contexts/                # CurrencyContext (INR/USD display only — payroll is always stored in INR)
│   ├── hooks/                   # useAuth
│   ├── pages/                   # One file per sidebar destination (lazy-loaded)
│   ├── utils/                   # Payroll math, currency formatting, activity log, tax presets
│   ├── App.tsx                  # Owns all shared state (employees, salaryHistory, brand, auth) and page routing
│   └── main.tsx                 # Entry point
│
└── backend/                    # Backend
    └── src/
        ├── config/database.js    # MongoDB connection
        ├── models/                 # Mongoose schemas (Employee, SalaryHistory, PdfArchive, EmailLog)
        ├── services/               # Business logic + MongoDB queries
        ├── controllers/            # Thin HTTP layer — calls a service, shapes the response
        ├── routes/                 # Express routers, mounted in app.js
        ├── middleware/             # Shared 404 + error-handling middleware
        ├── utils/                  # AppError, asyncHandler
        ├── scripts/                # One-off seed script
        ├── app.js                  # Express app config (CORS, routes, middleware)
        └── server.js                # Starts the HTTP listener + DB connection
```

## Environment Setup

Copy the example env files and fill in real values — neither `.env` file is committed to git.

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

### Frontend (`.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | No (has a fallback) | Base URL of the backend API, e.g. `http://localhost:5001/api` locally, or the deployed Render URL in production. Every `src/api/*.ts` client falls back to `http://localhost:5001/api` if unset. |

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (defaults to 5000) | Port the Express server listens on locally. Render assigns its own `PORT` at runtime. |
| `MONGODB_URI` | **Yes** | MongoDB Atlas connection string. The server starts without it but every data endpoint will fail. |
| `FRONTEND_URL` | **Yes** | Exact origin of the deployed frontend (no trailing slash) — CORS only allows this one origin. **Must match wherever the frontend actually runs**; `npm run dev` binds the frontend to port **3000**, not Vite's default 5173, so local dev needs `FRONTEND_URL=http://localhost:3000`. |
| `EMAIL_USER` / `EMAIL_PASS` | Only for Email Automation | SMTP credentials (Gmail is assumed via Nodemailer's `service: 'gmail'` shorthand). `EMAIL_PASS` must be an **app password**, not the account's login password. |
| `NODE_ENV` | No | `development` or `production` — affects logging verbosity (`morgan`). |

## Installation

```bash
# Frontend
npm install

# Backend
cd backend
npm install
```

## Development

Run both servers in separate terminals:

```bash
# Terminal 1 — backend (http://localhost:5001 by default)
cd backend
npm run dev

# Terminal 2 — frontend (http://localhost:3000)
npm run dev
```

Health check: `GET http://localhost:5001/api/health` reports server + MongoDB connection status.

## Build

```bash
# Frontend — outputs to dist/
npm run build

# Type-check only, no emit
npx tsc --noEmit

# Backend has no build step (plain ESM Node) — npm install is sufficient
```

## Deployment

This app is designed to deploy as three separate pieces:

| Piece | Target |
|---|---|
| Frontend | Vercel |
| Backend | Render |
| Database | MongoDB Atlas |

**Backend (Render)**
1. Create a Web Service pointed at `backend/`, build command `npm install`, start command `npm start`.
2. Set environment variables: `MONGODB_URI`, `FRONTEND_URL` (the Vercel URL, once known), `EMAIL_USER`, `EMAIL_PASS`, `NODE_ENV=production`. Render supplies `PORT` automatically.
3. Confirm `GET /api/health` returns `{ database: "connected", server: "running" }` after deploy.

**Frontend (Vercel)**
1. Import the repo, build command `npm run build`, output directory `dist`.
2. Set `VITE_API_BASE_URL` to the deployed Render backend URL (including `/api`).
3. Deploy, then update the backend's `FRONTEND_URL` to the resulting Vercel URL and redeploy the backend (a mismatch here breaks every API call with a CORS error — see Known Limitations).

**Database (MongoDB Atlas)**
- Existing Atlas cluster — ensure the Render backend's outbound IP (or `0.0.0.0/0` for simplicity) is allow-listed under Network Access.

## Known Limitations

- **Authentication is a static, hardcoded credential check on the frontend only** (`src/config/authConfig.ts`) — there is no backend session, token, or per-user account system. Anyone with the source can read the credential. This is acceptable for an internal single-operator tool but should be replaced with real backend authentication before handling multiple HR users or being exposed beyond a trusted network.
- **CORS allows exactly one origin** (`FRONTEND_URL`) — correct for security, but means every deployment/environment change to the frontend's URL requires a matching backend env var update and redeploy.
- **`xlsx` (SheetJS) has known unpatched vulnerabilities** (prototype pollution, ReDoS) with no fix currently published to npm — used only for Payroll Export. Acceptable short-term given the export is admin-triggered, not user-input-driven, but worth revisiting.
- **Documents and Tax Center are UI-only placeholders** — no backend, storage, or real functionality behind either page yet.
- **Email Automation assumes Gmail** (`nodemailer`'s `service: 'gmail'` shorthand) — a different SMTP provider would need a `host`/`port` config change.
- Large main JS bundle (~917 kB / ~271 kB gzipped) — not yet code-split beyond the existing per-page `lazy()` boundaries; consider `manualChunks` if load time becomes a concern.

## Future Roadmap

- Real backend authentication (JWT or session-based) with per-user HR accounts.
- Google Drive integration for PDF Archive as an additional storage provider (the archive's `provider`/`driveFileId` fields already anticipate this).
- Build out Documents and Tax Center beyond their current placeholder state.
- Structured salary components (Basic/HRA/PF/ESI/PT/TDS as first-class fields) rather than free-text earnings/deductions rows.
