import React, { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { SalaryData, Employee } from './types';
import { SalarySlipForm } from './components/SalarySlipForm';
import { SalarySlipPreview } from './components/SalarySlipPreview';
import { SalarySlipPDF } from './components/pdf/SalarySlipPDF';
import { TopNav } from './components/layout/TopNav';
import { Sidebar, SidebarKey } from './components/layout/Sidebar';
import { Footer } from './components/layout/Footer';
import { Download, Loader2, AlertTriangle, X, CheckCircle2, FileText } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { defaultTaxConfigs } from './utils/taxCalculator';
import { getEmployees, ApiError } from './api/employeeApi';
import { calculateLop, LOP_DEDUCTION_ID } from './utils/payroll';
import type { BrandConfig } from './utils/companySettingsStore';
import { DEFAULT_BRAND, loadCompanySettings, saveCompanySettings, COMPANY_SETTINGS_UPDATED_EVENT } from './utils/companySettingsStore';
import { SalaryHistoryRecord } from './types';
import { getSalaryHistory, createSalaryHistory, deleteSalaryHistory } from './api/salaryHistoryApi';
import { uploadPdf, deletePdfArchive } from './api/pdfApi';
import { sendSalaryEmail, ApiError as EmailApiError } from './api/emailApi';
import { logActivity, deleteActivityEntry, loadActivityLog } from './utils/activityLogStore';
import { useAuth } from './hooks/useAuth';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { getCurrentPeriodLabel, getCurrentMonthName, getCurrentYear } from './utils/date';
import { ExportShareDropdown } from './components/share/ExportShareDropdown';
import { EmailSalaryModal } from './components/share/EmailSalaryModal';
import { buildEmailSubject, buildEmailBody } from './components/share/EmailTemplate';
import { PreviewToolbar } from './components/preview/PreviewToolbar';
import { CurrencyProvider, CurrencyCode } from './contexts/CurrencyContext';
import type { InvoiceOpenRequest } from './modules/finance/invoice-generator/InvoiceGeneratorPage';
import type { Invoice } from './modules/finance/types';

/* Lazy-loaded — these are the pages a user visits after the Salary
   Generator, not on first load, so they're split into separate chunks
   rather than bundled into the initial page weight. Payroll Export in
   particular pulls in the xlsx library, which is otherwise the single
   largest dependency in the app. */
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const SalaryHistoryPage = lazy(() => import('./pages/SalaryHistoryPage').then(m => ({ default: m.SalaryHistoryPage })));
const PayrollExportPage = lazy(() => import('./pages/PayrollExportPage').then(m => ({ default: m.PayrollExportPage })));
const CompanySettingsPage = lazy(() => import('./pages/CompanySettingsPage').then(m => ({ default: m.CompanySettingsPage })));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage').then(m => ({ default: m.EmployeesPage })));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage').then(m => ({ default: m.DocumentsPage })));
const TaxCenterPage = lazy(() => import('./pages/TaxCenterPage').then(m => ({ default: m.TaxCenterPage })));
// Finance module (Sprint 1) — lives under modules/finance/, not
// pages/, since it's an independent, self-contained feature area (see
// src/modules/finance/README-equivalent comments in its index.ts
// placeholders) rather than another Payroll destination.
const InvoiceGeneratorPage = lazy(() => import('./modules/finance/invoice-generator/InvoiceGeneratorPage').then(m => ({ default: m.InvoiceGeneratorPage })));
const InvoiceHistoryPage = lazy(() => import('./modules/finance/invoice-history/InvoiceHistoryPage').then(m => ({ default: m.InvoiceHistoryPage })));
const InvoiceSettingsPage = lazy(() => import('./modules/finance/invoice-settings/InvoiceSettingsPage').then(m => ({ default: m.InvoiceSettingsPage })));

function PageLoadingFallback() {
  return (
    <div className="page-loading">
      <Loader2 size={16} />
      Loading…
    </div>
  );
}

/** Re-exported so existing `import { LOP_DEDUCTION_ID } from '../App'` call
    sites (e.g. SalarySlipForm.tsx) keep working unchanged — the constant
    itself now lives in utils/payroll.ts, next to calculateLop(). */
export { LOP_DEDUCTION_ID };
/** Re-exported for the same reason — BrandConfig now lives in
    utils/companySettingsStore.ts alongside its load/save functions. */
export type { BrandConfig };

/* ─── Company bootstrap config ──────────────────────────────────
   The employee directory itself now lives in MongoDB (see
   src/api/employeeApi.ts and the `employees` state below) — the only
   company-specific wiring left in the whole app is display naming.
   To stand this up for a different company: update TEAM_DIRECTORY_TITLE
   / APP_NAME. APP_NAME is the software's own product name (shown in
   the top nav); it's intentionally separate from BrandConfig.companyName,
   which is the tenant's legal entity name shown on the payslip. */
const TEAM_DIRECTORY_TITLE = 'ARNA Team Directory';
const APP_NAME = 'Arna Intelligence IntelliPayRoll';

/* ─── Validation types ─────────────────────────────────────── */
export interface FormErrors {
  companyName?: string;
  companyAddress?: string;
  employeeName?: string;
  employeeId?: string;
  designation?: string;
  department?: string;
  doj?: string;
  year?: string;
  paidDays?: string;
  basicSalary?: string;
  /* deduction row errors keyed by item id */
  deductions?: Record<string, { name?: string; amount?: string }>;
}

export type TouchedFields = Partial<Record<keyof Omit<FormErrors, 'deductions'>, boolean>> & {
  deductions?: Record<string, { name?: boolean; amount?: boolean }>;
};

function validateForm(data: SalaryData, brand: BrandConfig): FormErrors {
  const e: FormErrors = {};
  if (!brand.companyName.trim())          e.companyName    = 'Company name is required.';
  if (!brand.companyAddress.trim())       e.companyAddress = 'Company address is required.';
  if (!data.employee.name.trim())         e.employeeName   = 'Employee name is required.';
  if (!data.employee.id.trim())           e.employeeId     = 'Employee ID is required.';
  if (!data.employee.designation.trim())  e.designation    = 'Designation is required.';
  if (!data.employee.department.trim())   e.department     = 'Department is required.';
  if (!data.employee.doj)                 e.doj            = 'Date of joining is required.';
  if (!data.salary.year || String(data.salary.year).trim() === '') e.year = 'Year is required.';
  if (data.salary.paidDays === undefined || data.salary.paidDays === null || String(data.salary.paidDays) === '') e.paidDays = 'Paid days is required.';
  const hasBasic = data.earnings.some(i => i.name.toLowerCase().includes('basic') && Number(i.amount) > 0);
  const hasAnyEarning = data.earnings.some(i => Number(i.amount) > 0);
  if (!hasBasic && !hasAnyEarning)        e.basicSalary    = 'At least one earning component (Basic Salary) is required.';
  /* Deduction row validation — if any value entered, both fields must be filled */
  const dedErrs: Record<string, { name?: string; amount?: string }> = {};
  data.deductions.forEach(d => {
    const row: { name?: string; amount?: string } = {};
    if (d.name.trim() && !Number(d.amount)) row.amount = 'Amount required when name is set.';
    if (!d.name.trim() && Number(d.amount)) row.name   = 'Name required when amount is set.';
    if (row.name || row.amount) dedErrs[d.id] = row;
  });
  if (Object.keys(dedErrs).length) e.deductions = dedErrs;
  return e;
}

/* Clean-slate starting point — no sample employee, no prefilled salary
   components. HR either selects a real employee from the Directory
   (which autofills identity fields via handleSelectEmployee below) or
   types one in; either way, earnings/deductions start empty so nothing
   ships on a payslip that wasn't explicitly entered. Month/year default
   to the real current period (via getCurrentMonthName/getCurrentYear,
   both backed by `new Date()`) rather than a hardcoded month, so a
   fresh payslip always opens on the actual current pay period. */
const initialData: SalaryData = {
  company: { name: '', address: '', logo: null },
  employee: {
    name: '',
    id: '',
    designation: '',
    department: '',
    doj: '',
    email: '',
    panNumber: '',
    bankAccount: '',
    bankName: '',
    ifscCode: ''
  },
  salary: {
    month: getCurrentMonthName(),
    year: getCurrentYear(),
    workingDays: 30,
    paidDays: 30,
    lopDays: 0,
  },
  earnings: [],
  deductions: [],
};

const fixedTaxConfig = defaultTaxConfigs[0];

export default function App() {
  const { isAuthenticated, login, logout } = useAuth();
  const [data, setData] = useState<SalaryData>(initialData);
  /* Unsaved-changes tracking for the Salary Generator (see the matching
     mechanism in InvoiceGeneratorPage's onDirtyChange) — unlike Invoice,
     `data` lives here in App.tsx and survives a page switch, but "saved"
     still means "actually exported/archived to Salary History", so a
     filled-in-but-never-exported form should still warn before the user
     navigates elsewhere and assumes it's safe. savedSnapshotRef holds the
     last-known-saved (or freshly loaded/exported) state as JSON; the
     effect below recomputes salaryDirty whenever `data` changes.
     justSyncedRef lets a programmatic load (loadHistoryRecordIntoGenerator)
     mark the very next `data` change as the new clean baseline instead of
     a user edit. */
  const savedSnapshotRef = useRef<string>(JSON.stringify(initialData));
  const justSyncedRef = useRef(false);
  const [salaryDirty, setSalaryDirty] = useState(false);
  useEffect(() => {
    const serialized = JSON.stringify(data);
    if (justSyncedRef.current) {
      justSyncedRef.current = false;
      savedSnapshotRef.current = serialized;
      setSalaryDirty(false);
      return;
    }
    setSalaryDirty(serialized !== savedSnapshotRef.current);
  }, [data]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [brand, setBrandState] = useState<BrandConfig>(loadCompanySettings);
  /* Live Preview zoom — 'fixed' means previewScale is whatever the
     toolbar last set directly (a preset % or +/- step); 'fit-width'/
     'fit-page' mean it's recomputed on every resize to fit the shell
     (see the effect below). Defaults to fixed 75% (Sprint 5.7.2) — the
     A4 page reads more comfortably at a glance; users can still zoom
     to 100%+ via the toolbar. */
  const [zoomMode, setZoomMode] = useState<'fixed' | 'fit-width' | 'fit-page'>('fixed');
  const [previewScale, setPreviewScale] = useState(0.75);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<FormErrors>({});
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [touchedFields, setTouchedFields] = useState<TouchedFields>({});
  /* Employee Directory — Sprint 5.2 moved this from localStorage
     to MongoDB via the backend API (see src/api/employeeApi.ts).
     Starts empty and is populated by the
     effect below; EmployeesPage.tsx (Sprint 5.7 — the dedicated
     directory page, replacing the old EmployeeMaster modal) updates
     this same shared state via onEmployeesChange, so this initial load
     is really just "have something to show the Salary Generator
     dropdown and Dashboard panels before the Employees page is opened." */
  const [employees, setEmployees] = useState<Employee[]>([]);
  /* True only until the mount-fetch below settles (success or failure) —
     lets EmployeesPage distinguish "still loading" from the genuine
     "zero employees" empty state, instead of briefly showing "No
     employees yet" while the very first fetch is still in flight. */
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [showEmailModal, setShowEmailModal] = useState(false);
  /* Salary History — Sprint 5.3 moved this from localStorage
     to MongoDB via the backend API (see src/api/salaryHistoryApi.ts),
     following the exact same pattern as
     the Employee Directory migration. Starts empty, populated by the
     fetch effect below; SalaryHistoryPage, DashboardPage, and
     PayrollExportPage all read this same shared state as a prop. */
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistoryRecord[]>([]);
  /* Same "loading vs genuinely empty" distinction as employeesLoading
     above, consumed by SalaryHistoryPage. */
  const [salaryHistoryLoading, setSalaryHistoryLoading] = useState(true);
  const [activityLog, setActivityLog] = useState(loadActivityLog);
  /* Set by "Download PDF" from Salary History — tells the effect below
     to trigger a real export once the loaded record's data has
     actually committed to a render (see the effect near
     handleDownloadPDF for why this is the safe way to do it). */
  const [pendingAutoExport, setPendingAutoExport] = useState(false);
  /* Which sidebar destination is showing in the main content area.
     Defaults to 'generator' — the screen every existing user already
     lands on today — so this navigation shell changes nothing about
     the app's starting workflow. */
  const [activePage, setActivePage] = useState<SidebarKey>('generator');
  /* Manual sidebar collapse (independent of the existing <=900px
     icon-only auto-collapse in index.css) — a user on a small/narrow
     screen can hide the nav rail entirely to reclaim width for the
     actual content, which zooming out can't do since it shrinks
     everything proportionally rather than freeing up space. Persisted
     so the choice survives a reload. */
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(
    () => localStorage.getItem('arna_sidebar_collapsed') === '1'
  );
  useEffect(() => {
    try { localStorage.setItem('arna_sidebar_collapsed', sidebarCollapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [sidebarCollapsed]);
  /* Sprint 4 — the one piece of Invoice-module state App.tsx lifts, so
     Invoice History can tell the Invoice Generator "open invoice X in
     edit/view mode" despite there being no URL router to carry that as
     a param. Everything else about the Invoice module (its own data
     fetching, form state, etc.) stays self-contained within
     modules/finance/ — this is not a payroll/SalaryData concern. */
  const [invoiceOpenRequest, setInvoiceOpenRequest] = useState<InvoiceOpenRequest | null>(null);
  /* Reported by InvoiceGeneratorPage's onDirtyChange (see that file) —
     since that component unmounts on navigating away, this is the only
     way App.tsx knows whether leaving 'invoice-generator' right now
     would throw away in-progress work. */
  const [invoiceDirty, setInvoiceDirty] = useState(false);
  /* Same mechanism, reported by InvoiceSettingsPage's own onDirtyChange —
     that page unmounts on navigating away too, so unsaved edits there
     (bank details, notes/terms, company identity) are just as easy to
     lose by clicking another sidebar item as an in-progress invoice. */
  const [invoiceSettingsDirty, setInvoiceSettingsDirty] = useState(false);
  /* Sidebar navigation the user asked for while a dirty form (Salary,
     Invoice, or Invoice Settings) is on screen — held here until they
     confirm via the Unsaved Changes dialog below, rather than switching
     immediately. */
  const [pendingNavKey, setPendingNavKey] = useState<SidebarKey | null>(null);
  const [unsavedDialogSource, setUnsavedDialogSource] = useState<'salary' | 'invoice' | 'invoice-settings' | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  /* Points at the dedicated SalarySlipPDF instance (rendered off-screen,
     always mounted — see the JSX below) rather than the on-screen
     SalarySlipPreview. Export captures this node now, not the preview. */
  const pdfRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  /* The one and only record of "does the payslip on screen right now
     have an archived PDF, and if so which one" — set synchronously
     (never via useState) by the two places that ever put a payslip on
     screen with a known archive: generateSalarySlipPdf, right after a
     fresh export finishes archiving+linking, and
     loadHistoryRecordIntoGenerator, right after pulling an existing
     record back in from Salary History. Both write it directly from
     data they already have in hand — "Email Employee" (findArchivedMatch,
     below) never searches `salaryHistory` for a match; it just reads
     this ref, which is always current the instant either of those two
     functions finishes, with no dependency on a re-render landing
     first the way a value read from React state via a callback closure
     would be. */
  const lastArchivedRef = useRef<{
    employeeId: string; month: string; year: string; salaryHistoryId: string; pdfArchiveId: string;
    /** The exact in-memory PDF Blob generated for this export (Sprint
        6.2B) — reused as-is for "Email Employee" so the email
        attachment is never re-read from disk or re-downloaded from
        Google Drive. Absent when the ref was populated by loading an
        existing Salary History record rather than a fresh export
        (see loadHistoryRecordIntoGenerator) — handleEmailEmployee
        falls back to a fresh in-memory capture in that case. */
    pdfBlob?: Blob;
  } | null>(null);

  /* Loads the Employee Directory from the backend once on mount. This
     is the app-wide `employees` list consumed by the Salary Generator's
     "Select Employee" dropdown and the Dashboard panels; EmployeeMaster
     (the directory modal) keeps it in sync afterwards via
     onEmployeesChange every time it opens or a record is added/edited/
     deleted, so this effect only needs to run once. */
  /* Google Drive OAuth (Sprint 6.2A): the backend's /callback route
     redirects the browser back here with a `?drive=connected` or
     `?drive=error&reason=...` query param — this app has no URL
     router (activePage is plain state, see above), so the only way
     to land the user back on Company Settings after that redirect is
     to detect the param on mount and switch pages here.
     CompanySettingsPage reads the same param itself to select its
     Google Drive tab and show a notice, then strips it from the URL. */
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('drive')) {
      setActivePage('settings');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getEmployees({ limit: 1000 })
      .then(result => {
        if (!cancelled) setEmployees(result.items);
      })
      .catch(err => {
        if (cancelled) return;
        setPdfError(err instanceof ApiError ? err.message : 'Unable to connect to server');
        setTimeout(() => setPdfError(null), 5000);
      })
      .finally(() => {
        if (!cancelled) setEmployeesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  /* Loads Salary History from the backend once on mount — same pattern
     as the Employee Directory fetch above. SalaryHistoryPage,
     DashboardPage, and PayrollExportPage all read this same shared
     `salaryHistory` state as a prop; none of them fetch independently. */
  useEffect(() => {
    let cancelled = false;
    getSalaryHistory({ limit: 1000 })
      .then(result => {
        if (!cancelled) setSalaryHistory(result.items);
      })
      .catch(err => {
        if (cancelled) return;
        setPdfError(err instanceof Error ? err.message : 'Unable to connect to server');
        setTimeout(() => setPdfError(null), 5000);
      })
      .finally(() => {
        if (!cancelled) setSalaryHistoryLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  /* Re-run validation on every data/brand change so errors clear as user types */
  useEffect(() => {
    setValidationErrors(validateForm(data, brand));
  }, [data, brand]);

  const handleBlurField = useCallback((field: keyof Omit<FormErrors, 'deductions'>) => {
    setTouchedFields(prev => ({ ...prev, [field]: true }));
  }, []);

  const handleBlurDeduction = useCallback((id: string, col: 'name' | 'amount') => {
    setTouchedFields(prev => ({
      ...prev,
      deductions: { ...(prev.deductions || {}), [id]: { ...(prev.deductions?.[id] || {}), [col]: true } },
    }));
  }, []);

  /* Live Preview zoom controls — A4 at 96dpi is 794×1123px. "Fit Width"
     and "Fit Page" recompute previewScale against the shell's current
     size (and keep doing so on resize, via the effect below); every
     other control sets previewScale directly and drops back to 'fixed'
     mode so it stops auto-recomputing until Fit Width/Page is clicked
     again. */
  const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const A4_PX_WIDTH = 794;
  const A4_PX_HEIGHT = 1123;

  const recalcFit = useCallback((mode: 'fit-width' | 'fit-page') => {
    if (!shellRef.current) return;
    const padding = 48;
    const shellW = shellRef.current.clientWidth - padding;
    if (mode === 'fit-width') {
      setPreviewScale(Math.max(0.25, shellW / A4_PX_WIDTH));
    } else {
      const shellH = shellRef.current.clientHeight - padding;
      setPreviewScale(Math.max(0.25, Math.min(shellW / A4_PX_WIDTH, shellH / A4_PX_HEIGHT)));
    }
  }, []);

  useEffect(() => {
    if (zoomMode === 'fixed') return;
    recalcFit(zoomMode);
    const ro = new ResizeObserver(() => recalcFit(zoomMode));
    if (shellRef.current) ro.observe(shellRef.current);
    return () => ro.disconnect();
  }, [zoomMode, recalcFit]);

  const handleZoomIn = useCallback(() => {
    setZoomMode('fixed');
    setPreviewScale(prev => ZOOM_STEPS.find(s => s > prev + 0.001) ?? prev);
  }, []);
  const handleZoomOut = useCallback(() => {
    setZoomMode('fixed');
    setPreviewScale(prev => [...ZOOM_STEPS].reverse().find(s => s < prev - 0.001) ?? prev);
  }, []);
  const handleSetZoom = useCallback((pct: number) => {
    setZoomMode('fixed');
    setPreviewScale(pct / 100);
  }, []);
  const handleResetZoom = useCallback(() => {
    setZoomMode('fixed');
    setPreviewScale(1);
  }, []);
  const handleFitWidth = useCallback(() => setZoomMode('fit-width'), []);
  const handleFitPage = useCallback(() => setZoomMode('fit-page'), []);

  const handleToggleFullscreen = useCallback(() => {
    if (!shellRef.current) return;
    if (!document.fullscreenElement) {
      shellRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsPreviewFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const setBrand = (b: BrandConfig) => {
    setBrandState(b);
    saveCompanySettings(b);
  };

  const handleResetBrand = () => setBrand(DEFAULT_BRAND);

  useEffect(() => { saveCompanySettings(brand); }, []);

  /* Invoice Settings now edits Company Identity directly (writing
     through saveCompanySettings, not through setBrand above), so this
     app's own long-lived `brand` state needs to resync when that
     happens elsewhere in the same tab — otherwise the Salary Generator
     would keep showing the old name/logo/address until a full reload.
     See companySettingsStore.ts's COMPANY_SETTINGS_UPDATED_EVENT. */
  useEffect(() => {
    const handler = () => setBrandState(loadCompanySettings());
    window.addEventListener(COMPANY_SETTINGS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(COMPANY_SETTINGS_UPDATED_EVENT, handler);
  }, []);

  /* Propagate the brand colours onto the document root as live theme
     variables, so the whole app (buttons, focus rings, badges) — not
     just the payslip preview — repaints instantly on colour change. */
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', brand.primaryColour || '#0F172A');
    root.style.setProperty('--brand-secondary', brand.secondaryColour || '#5EEAD4');
  }, [brand.primaryColour, brand.secondaryColour]);

  /* Autofill the employee block from a saved Employee Directory record
     — every field it holds comes straight from MongoDB (via the shared
     `employees` state), with no locally-typed fallback. Email and bank
     name used to be blanked out here under the (now stale) assumption
     that Employee Master didn't track them; both are real fields on
     the backend Employee model, so they're carried over like everything
     else. */
  const handleSelectEmployee = useCallback((recordId: string) => {
    const emp = employees.find(e => e.id === recordId);
    if (!emp) return;
    setData(prev => ({
      ...prev,
      employee: {
        ...prev.employee,
        name: emp.name,
        id: emp.employeeId,
        designation: emp.designation,
        department: emp.department,
        doj: emp.doj,
        panNumber: emp.pan || '',
        bankAccount: emp.bankAccount || '',
        bankName: emp.bankName || '',
        ifscCode: emp.ifsc || '',
        email: emp.email || '',
      },
    }));
  }, [employees]);

  /* The actual page switch, once we know it's safe (either nothing was
     dirty, or the user just confirmed leaving unsaved changes behind). */
  const commitNavigate = useCallback((key: SidebarKey) => {
    /* Clicking "Invoice Generator" in the sidebar directly (as opposed
       to arriving via Invoice History's View/Edit) always means "start
       a new invoice" — clear any pending open request so the Generator
       doesn't stay stuck showing whatever was last opened. */
    if (key === 'invoice-generator') setInvoiceOpenRequest(null);
    setActivePage(key);
  }, []);

  /* Sprint 5.7 — the Employee Directory ('directory') is now a real
     page like every other sidebar destination (it used to special-case
     into opening the EmployeeMaster modal instead).
     Later addition: warn before switching away from a dirty Salary
     Generator or Invoice Generator instead of silently discarding
     whatever the user was in the middle of typing. */
  const handleNavigate = useCallback((key: SidebarKey) => {
    const leavingDirtySalary = activePage === 'generator' && key !== 'generator' && salaryDirty;
    const leavingDirtyInvoice = activePage === 'invoice-generator' && key !== 'invoice-generator' && invoiceDirty;
    const leavingDirtyInvoiceSettings = activePage === 'invoice-settings' && key !== 'invoice-settings' && invoiceSettingsDirty;
    if (leavingDirtySalary || leavingDirtyInvoice || leavingDirtyInvoiceSettings) {
      setUnsavedDialogSource(leavingDirtyInvoice ? 'invoice' : leavingDirtyInvoiceSettings ? 'invoice-settings' : 'salary');
      setPendingNavKey(key);
      return;
    }
    commitNavigate(key);
  }, [activePage, salaryDirty, invoiceDirty, invoiceSettingsDirty, commitNavigate]);

  const handleCancelUnsavedNav = useCallback(() => {
    setPendingNavKey(null);
    setUnsavedDialogSource(null);
  }, []);

  const handleDiscardAndNavigate = useCallback(() => {
    if (unsavedDialogSource === 'salary') {
      /* The user explicitly chose to leave the Salary form as-is —
         treat its current (still un-exported) state as the new
         baseline so switching pages again later doesn't keep re-warning
         about the exact same, already-acknowledged changes. */
      savedSnapshotRef.current = JSON.stringify(data);
      setSalaryDirty(false);
    }
    if (pendingNavKey) commitNavigate(pendingNavKey);
    setPendingNavKey(null);
    setUnsavedDialogSource(null);
  }, [unsavedDialogSource, pendingNavKey, commitNavigate, data]);

  const openInvoice = useCallback((id: string, mode: 'edit' | 'view', invoice?: Invoice) => {
    setInvoiceOpenRequest({ id, mode, invoice });
    setActivePage('invoice-generator');
  }, []);

  /* Loss of Pay — automatically maintained as a deduction row keyed by
     LOP_DEDUCTION_ID so it flows straight into the existing earnings/
     deductions table (and therefore the PDF) without any layout changes.
     Per Day Salary = Gross Salary / Working Days
     LOP Deduction  = Per Day Salary × LOP Days           */
  useEffect(() => {
    const grossSalary = data.earnings.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const workingDays = Number(data.salary.workingDays) || 0;
    const lopDays = Number(data.salary.lopDays) || 0;
    const { lopAmount } = calculateLop(grossSalary, workingDays, lopDays);

    setData(prev => {
      const existing = prev.deductions.find(d => d.id === LOP_DEDUCTION_ID);
      if (lopAmount > 0) {
        if (existing && existing.amount === lopAmount) return prev;
        return {
          ...prev,
          deductions: [
            ...prev.deductions.filter(d => d.id !== LOP_DEDUCTION_ID),
            { id: LOP_DEDUCTION_ID, name: 'Loss of Pay', amount: lopAmount },
          ],
        };
      }
      if (!existing) return prev;
      return { ...prev, deductions: prev.deductions.filter(d => d.id !== LOP_DEDUCTION_ID) };
    });
  }, [data.earnings, data.salary.workingDays, data.salary.lopDays]);

  /* Sprint 6.2B: the validation + html2canvas + jsPDF capture, pulled
     out of generateSalarySlipPdf so it can be reused by
     handleEmailEmployee without also re-running that function's
     history/archive side effects below. Returns the jsPDF document
     alongside its rendered Blob — computed once here so every caller
     (Export's Drive-upload multipart body, Email's attachment) works
     from the exact same bytes rather than each calling
     `pdf.output('blob')` separately. */
  const capturePdfDocument = useCallback(async (): Promise<{ pdf: jsPDF; blob: Blob; fileName: string } | null> => {
    const errors = validateForm(data, brand);
    if (Object.keys(errors).length > 0) {
      setTouchedFields({
        companyName: true, companyAddress: true,
        employeeName: true, employeeId: true, designation: true,
        department: true, doj: true, year: true, paidDays: true,
        basicSalary: true,
      });
      setShowValidationDialog(true);
      return null;
    }
    if (!pdfRef.current) return null;

    /* Three-step settle before capture, in order:
       1) document.fonts.ready — unconditional, not raced against a
          timeout. A raced timeout could let capture proceed on
          fallback-font metrics if Inter hadn't finished loading yet,
          which changes text width/height enough to matter for any
          container sized to its content.
       2) one animation frame — lets the "Exporting…" state's own
          re-render actually paint before we read the DOM, so we're
          never capturing mid-render.
       3) a short fixed delay — final settle buffer for layout to
          fully stabilise after the frame above. */
    await document.fonts.ready;
    await new Promise(requestAnimationFrame);
    await new Promise(resolve => setTimeout(resolve, 150));
    /* Captures the dedicated off-screen SalarySlipPDF instance (see
       its mount further down in the JSX), not the on-screen
       SalarySlipPreview — that's the whole point of the separate
       rendering layer: the PDF no longer depends on whatever the
       live preview's scale/transform/viewport state happens to be. */
    const node = pdfRef.current;
    const canvas = await html2canvas(node, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      allowTaint: true,
      imageTimeout: 0,
      /* The node is rendered off-screen at its true, unscaled A4 pixel
         size (no preview-shrink transform ever applies to it), so
         this just pins the capture to that same true size. */
      windowWidth: node.scrollWidth,
      windowHeight: node.scrollHeight,
      onclone: (clonedDoc) => {
        const preview = clonedDoc.getElementById('pdf-export-area');
        if (preview) {
          preview.style.transform = 'none';
          preview.style.margin = '0';
        }
      }
    });
    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    /* Document metadata only (Title/Creator, visible in a PDF viewer's
       "Properties" panel) — not visible payslip content, so this is
       pure rebranding, not a change to what the page itself shows. */
    pdf.setProperties({
      title: `Salary Slip – ${data.employee.name} – ${data.salary.month} ${data.salary.year}`,
      creator: APP_NAME,
      subject: 'Salary Slip',
    });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    const fileName = `Salary_Slip_${data.employee.name.replace(/\s+/g, '_')}_${data.salary.month}.pdf`;
    // Computed once, here — every caller (Drive upload, email attachment) reuses this exact Blob.
    const blob = pdf.output('blob');

    return { pdf, blob, fileName };
  }, [data, brand]);

  /* The one PDF-generation pipeline shared by every export/email/share
     entry point (Export PDF, Email Employee, Share → Gmail/Outlook/
     Download PDF). Captures via capturePdfDocument above, then
     records the Salary History + PDF Archive (local + Google Drive,
     unchanged since Sprint 5.9/6.2A) side effects that only Export
     should trigger — Email reuses the already-archived record's id
     rather than calling this again. Still records a 'salary_generated'
     activity entry every time, same as before: a real slip was
     generated regardless of which button triggered it. Returns null
     (after showing the validation dialog) if the form isn't valid yet. */
  const generateSalarySlipPdf = useCallback(async (): Promise<{ pdf: jsPDF; fileName: string } | null> => {
    const captured = await capturePdfDocument();
    if (!captured) return null;
    const { pdf, blob, fileName } = captured;

    /* Record the export in Salary History + the activity feed. Purely
       additive — nothing above this line (the actual PDF generation)
       changes. */
    const grossSalary = data.earnings.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const totalDeduction = data.deductions.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const now = new Date();
    const record: SalaryHistoryRecord = {
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      employeeId: data.employee.id,
      employeeName: data.employee.name,
      department: data.employee.department,
      designation: data.employee.designation,
      employmentType: employees.find(e => e.employeeId === data.employee.id)?.employmentType,
      month: data.salary.month,
      year: String(data.salary.year),
      workingDays: Number(data.salary.workingDays) || 0,
      paidDays: Number(data.salary.paidDays) || 0,
      lopDays: Number(data.salary.lopDays) || 0,
      earnings: data.earnings,
      deductions: data.deductions,
      grossSalary,
      totalDeduction,
      netSalary: grossSalary - totalDeduction,
      generatedDate: now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      generatedTime: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      companyName: brand.companyName,
      pdfVersion: 'v1',
      status: 'Generated',
    };
    /* Persist to MongoDB. Deliberately its own try/catch: a backend
       hiccup recording history must not stop a PDF that already
       rendered successfully from downloading — matches the old
       localStorage behaviour, where saveSalaryHistory() could never
       fail loudly enough to block the download either. */
    let savedRecord: SalaryHistoryRecord | null = null;
    try {
      savedRecord = await createSalaryHistory(record);
      setSalaryHistory(prev => [savedRecord as SalaryHistoryRecord, ...prev]);
    } catch (err) {
      console.error('Failed to save salary history record:', err);
    }

    /* Archive the PDF on the backend (Sprint 5.4), linked to the
       history record just saved above (Sprint 5.5 Bug Fix 1). Only
       runs once createSalaryHistory has actually resolved with a real
       Mongo _id — inside this `if`, savedRecord.id is guaranteed
       non-null, so PdfArchive.salaryHistoryId can never be silently
       created as null the way it could when this used the old
       `savedRecord?.id` optional chain. If history saving failed
       above, archiving is skipped entirely rather than creating an
       orphaned PdfArchive nothing points back to — the download
       itself (already completed above) is unaffected either way. */
    if (savedRecord) {
      const linkedId = savedRecord.id;
      try {
        const archived = await uploadPdf({
          file: blob,
          fileName,
          employeeId: data.employee.id,
          employeeName: data.employee.name,
          month: data.salary.month,
          year: String(data.salary.year),
          salaryHistoryId: linkedId,
          generatedBy: 'HR Admin',
        });
        setSalaryHistory(prev => prev.map(r => (r.id === linkedId ? { ...r, pdfArchiveId: archived._id } : r)));
        /* Written synchronously, not via setSalaryHistory above — see
           lastArchivedRef's declaration for why "Email Employee"
           checks this ref first rather than only the (React-render-
           dependent) salaryHistory state. pdfBlob is the exact same
           Blob just uploaded to Google Drive above (Sprint 6.2B) —
           "Email Employee" attaches this directly, no disk/Drive
           round-trip. */
        lastArchivedRef.current = {
          employeeId: data.employee.id,
          month: data.salary.month,
          year: String(data.salary.year),
          salaryHistoryId: linkedId,
          pdfArchiveId: archived._id,
          pdfBlob: blob,
        };
      } catch (err) {
        console.error('Failed to archive PDF:', err);
      }
    }

    setActivityLog(logActivity('salary_generated', data.employee.name, `${data.salary.month} ${data.salary.year}`));

    /* A real export just happened for exactly this `data` — re-baseline
       so navigating away right after Export PDF doesn't still warn about
       "unsaved changes" for a form that's now archived to history. */
    savedSnapshotRef.current = JSON.stringify(data);
    setSalaryDirty(false);

    return { pdf, fileName };
  }, [capturePdfDocument, data, brand, employees]);

  const handleDownloadPDF = useCallback(async () => {
    try {
      setIsGenerating(true);
      const result = await generateSalarySlipPdf();
      if (result) result.pdf.save(result.fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setPdfError('Failed to generate PDF. Please try again.');
      setTimeout(() => setPdfError(null), 4000);
    } finally {
      setIsGenerating(false);
    }
  }, [generateSalarySlipPdf]);

  /* Sprint 5.5 Workflow Audit — "is there an archived PDF for the
     payslip on screen right now?", shared by handleOpenEmailModal and
     handleEmailEmployee so both agree on the same answer. Reads
     lastArchivedRef ONLY — no re-search of `salaryHistory` state.
     There are exactly two places that ever populate this ref, both of
     which write it directly from the record they just created/loaded
     (never by searching an array for one that "looks like" the current
     form): generateSalarySlipPdf, right after archiving+linking a
     fresh export, and loadHistoryRecordIntoGenerator, right after
     pulling an existing record back into the generator. The
     employeeId/month/year check below isn't a search — it's a single
     staleness guard against the one already-known ref, so switching to
     a different employee/period without re-exporting or re-loading
     correctly reads as "nothing archived yet" instead of reusing
     whatever was archived for the previous payslip. */
  const findArchivedMatch = useCallback((): { id: string; pdfArchiveId: string; pdfBlob: Blob | null } | null => {
    const ref = lastArchivedRef.current;
    if (
      ref &&
      ref.employeeId === data.employee.id &&
      ref.month === data.salary.month &&
      ref.year === String(data.salary.year)
    ) {
      return { id: ref.salaryHistoryId, pdfArchiveId: ref.pdfArchiveId, pdfBlob: ref.pdfBlob ?? null };
    }
    return null;
  }, [data.employee.id, data.salary.month, data.salary.year]);

  /* Email Employee (Sprint 5.5, refactored Sprint 6.2B) — sends the
     salary slip via real SMTP from the backend, attaching the PDF as
     an in-memory buffer the backend never has to read from disk or
     re-download from Google Drive (that disk read was the root cause
     of email failing in production while working on localhost — see
     the Sprint 6.2B report). Reuses the exact Blob generateSalarySlipPdf
     already captured and uploaded to Drive for this exact payslip
     when available; if the archived record was loaded from Salary
     History instead of just exported in this session (no cached Blob
     — see lastArchivedRef's declaration), captures a fresh one here
     via capturePdfDocument() rather than reading anything back from
     storage. If no matching archived record exists yet at all, the
     caller (see onEmailEmployee below) never opens this modal in the
     first place. */
  const handleEmailEmployee = useCallback(async (to: string, subject: string) => {
    const match = findArchivedMatch();
    if (!match) {
      setPdfError('Please export this salary slip as PDF first, then email it.');
      setTimeout(() => setPdfError(null), 5000);
      return;
    }
    try {
      setIsGenerating(true);
      let pdfBlob = match.pdfBlob;
      if (!pdfBlob) {
        const captured = await capturePdfDocument();
        if (!captured) return; // validation dialog already shown by capturePdfDocument
        pdfBlob = captured.blob;
      }
      await sendSalaryEmail({
        employeeId: data.employee.id,
        employeeName: data.employee.name,
        recipientEmail: to,
        month: data.salary.month,
        year: String(data.salary.year),
        salaryHistoryId: match.id,
        pdfArchiveId: match.pdfArchiveId,
        pdfBlob,
        subject,
      });
      const sentAt = new Date().toISOString();
      setSalaryHistory(prev => prev.map(r => (
        r.id === match.id ? { ...r, emailStatus: 'Sent', emailSentAt: sentAt, emailRecipient: to } : r
      )));
      setActivityLog(logActivity('salary_shared', data.employee.name, `Emailed to ${to}`));
      setShowEmailModal(false);
      setNotice(`Salary slip emailed to ${to}.`);
      setTimeout(() => setNotice(null), 6000);
    } catch (error) {
      console.error('Error sending email:', error);
      const message = error instanceof EmailApiError ? error.message : 'Failed to send email. Please try again.';
      setPdfError(message);
      setTimeout(() => setPdfError(null), 5000);
    } finally {
      setIsGenerating(false);
    }
  }, [findArchivedMatch, capturePdfDocument, data.employee.id, data.employee.name, data.salary.month, data.salary.year]);

  /* Guards the "Email Employee" entry point: only opens the modal if a
     PDF has already been archived for the current employee/month/year
     (i.e. Export PDF was already clicked for this exact payslip), so
     the modal never promises to send something that doesn't exist yet. */
  const handleOpenEmailModal = useCallback(() => {
    if (!findArchivedMatch()) {
      setPdfError('Please export this salary slip as PDF first, then email it.');
      setTimeout(() => setPdfError(null), 5000);
      return;
    }
    setShowEmailModal(true);
  }, [findArchivedMatch]);

  /* Share → Gmail / Outlook — same idea as Email Employee, but opens
     the provider's own web compose window (pre-filled) instead of the
     OS mail client. Same file-attachment limitation applies. */
  const handleShareVia = useCallback(async (channel: 'gmail' | 'outlook') => {
    try {
      setIsGenerating(true);
      const result = await generateSalarySlipPdf();
      if (!result) return;
      result.pdf.save(result.fileName);
      const to = employees.find(e => e.employeeId === data.employee.id)?.email || data.employee.email || '';
      const subject = buildEmailSubject({ month: data.salary.month, year: data.salary.year });
      const body = buildEmailBody({
        employeeName: data.employee.name, month: data.salary.month, year: data.salary.year,
      });
      const channelLabel = channel === 'gmail' ? 'Gmail' : 'Outlook';
      const url = channel === 'gmail'
        ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
        : `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      setActivityLog(logActivity('salary_shared', data.employee.name, `Shared via ${channelLabel}`));
      setNotice(`Salary slip downloaded. Attach it in the ${channelLabel} tab that just opened.`);
      setTimeout(() => setNotice(null), 6000);
    } catch (error) {
      console.error('Error preparing share:', error);
      setPdfError('Failed to generate PDF to share. Please try again.');
      setTimeout(() => setPdfError(null), 4000);
    } finally {
      setIsGenerating(false);
    }
  }, [generateSalarySlipPdf, data, employees]);

  /* Fires a real export once a record loaded via "Download PDF" (below)
     has actually committed to a render — effects only run after React
     has updated the DOM for that commit, so by the time this checks
     pendingAutoExport, previewRef's content genuinely reflects the
     loaded record. This is the safe alternative to calling
     handleDownloadPDF() synchronously right after setData(), which
     would risk capturing the *previous* preview content. */
  useEffect(() => {
    if (pendingAutoExport && activePage === 'generator') {
      setPendingAutoExport(false);
      handleDownloadPDF();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoExport, activePage, data]);

  /* Loads a saved history record's data back into the live Salary
     Generator and switches to that page. Backs "Load into Generator"
     and "Duplicate" from Salary History (identical mechanics — there's
     no separate "edit an existing record" concept in this app, so both
     just mean "start from this data"). With autoExport, it also backs
     "Download PDF": neither stores actual PDF bytes (that would blow
     through localStorage's quota fast), so "re-download" means
     "regenerate from the saved snapshot via the same, unmodified
     export pipeline," via the effect above rather than a synchronous
     call here. */
  const loadHistoryRecordIntoGenerator = useCallback((record: SalaryHistoryRecord, autoExport = false) => {
    /* Loading a record is a programmatic sync, not a user edit — the
       resulting `data` should become the new clean baseline rather than
       reading as "unsaved changes", so the dirty-tracking effect above
       re-baselines instead of comparing against the old snapshot. */
    justSyncedRef.current = true;
    setData(prev => ({
      ...prev,
      employee: {
        ...prev.employee,
        name: record.employeeName,
        id: record.employeeId,
        designation: record.designation,
        department: record.department,
      },
      salary: {
        ...prev.salary,
        month: record.month,
        year: record.year,
        workingDays: record.workingDays,
        paidDays: record.paidDays,
        lopDays: record.lopDays,
      },
      earnings: record.earnings.map(e => ({ ...e })),
      deductions: record.deductions.map(d => ({ ...d })),
    }));
    /* Use the already-selected record directly — same lastArchivedRef
       that generateSalarySlipPdf writes to, populated here straight
       from the record's own pdfArchiveId (no re-searching salaryHistory
       for something that "looks like" it). If this record was never
       archived, this correctly clears the ref so "Email Employee"
       reads as "not exported yet" for it, rather than silently reusing
       whatever the previous payslip on screen had archived. */
    lastArchivedRef.current = record.pdfArchiveId
      ? {
          employeeId: record.employeeId,
          month: record.month,
          year: record.year,
          salaryHistoryId: record.id,
          pdfArchiveId: record.pdfArchiveId,
        }
      : null;
    setActivePage('generator');
    if (autoExport) {
      setPendingAutoExport(true);
      setNotice(`Regenerating ${record.employeeName}'s ${record.month} ${record.year} PDF…`);
    } else {
      setNotice(`Loaded ${record.employeeName}'s ${record.month} ${record.year} payslip into the Salary Generator — click Export PDF to download it.`);
    }
    setTimeout(() => setNotice(null), 5000);
  }, []);

  const handleDeleteHistoryRecord = useCallback(async (record: SalaryHistoryRecord) => {
    /* Clean up the archived PDF first, so a removed salary history
       record never leaves an orphaned file behind (Sprint 5.4). This
       is best-effort — if it fails (backend hiccup, file already
       gone), the history record is still deleted below rather than
       trapping the user with a record they can no longer remove. */
    if (record.pdfArchiveId) {
      try {
        await deletePdfArchive(record.pdfArchiveId);
      } catch (err) {
        console.error('Failed to delete archived PDF:', err);
      }
    }
    try {
      await deleteSalaryHistory(record.id);
      setSalaryHistory(prev => prev.filter(r => r.id !== record.id));
      setActivityLog(logActivity('salary_deleted', record.employeeName, `${record.month} ${record.year}`));
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Unable to connect to server');
      setTimeout(() => setPdfError(null), 5000);
    }
  }, []);

  const handleDeleteActivity = useCallback((id: string) => {
    setActivityLog(deleteActivityEntry(id));
  }, []);

  /* Passed to EmployeeMaster so the activity feed reflects directory
     changes — EmployeeMaster's own add/edit/delete logic is untouched;
     these just observe the outcome. */
  const handleEmployeeAdded = useCallback((emp: Employee) => {
    setActivityLog(logActivity('employee_added', emp.name, emp.employeeId));
  }, []);

  const handleEmployeeUpdated = useCallback((emp: Employee) => {
    setActivityLog(logActivity('employee_updated', emp.name, emp.employeeId));
  }, []);

  const handleEmployeeDeleted = useCallback((emp: Employee) => {
    setActivityLog(logActivity('employee_deleted', emp.name, emp.employeeId));
  }, []);

  const handlePayrollExported = useCallback((month: string, year: string, format: string) => {
    setActivityLog(logActivity('payroll_exported', `${month} ${year}`, format));
  }, []);

  /* Company Settings has no explicit "Save" step — every field is
     already live-saved on change (see setBrand). Logging every
     keystroke would flood the activity feed, so instead the page
     itself reports one summary event when it's left, only if
     something actually changed while it was open. */
  const handleSettingsChanged = useCallback(() => {
    setActivityLog(logActivity('company_settings_changed', 'Company Settings', 'Branding or company details updated'));
  }, []);

  return (
    <ProtectedRoute isAuthenticated={isAuthenticated} onLogin={login} appName={APP_NAME} logoDataUri={brand.logoDataUri}>
    <CurrencyProvider
      currency={brand.defaultCurrency || 'INR'}
      baseCurrency={brand.baseCurrency || 'INR'}
      exchangeRates={brand.exchangeRates || {}}
      onCurrencyChange={(c: CurrencyCode) => setBrand({ ...brand, defaultCurrency: c })}
    >
    <div className="app-shell" style={{ background: 'var(--clr-bg)' }}>

      {pdfError && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 9999,
          padding: '10px 16px', background: 'var(--clr-danger)', color: '#fff',
          borderRadius: 8, fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {pdfError}
        </div>
      )}

      {notice && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 9999,
          padding: '10px 16px', background: 'var(--brand-primary)', color: '#fff',
          borderRadius: 8, fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: 8, maxWidth: 380,
        }}>
          <CheckCircle2 size={15} style={{ flexShrink: 0, color: 'var(--brand-secondary)' }} />
          {notice}
        </div>
      )}

      {/* ── VALIDATION DIALOG ───────────────────────────────────────── */}
      {showValidationDialog && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(15,23,42,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}
          onClick={() => setShowValidationDialog(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              padding: '28px 32px', maxWidth: 440, width: '100%',
              position: 'relative',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowValidationDialog(false)}
              style={{
                position: 'absolute', top: 14, right: 14,
                background: '#F1F5F9', border: 'none', borderRadius: 6,
                width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#64748B',
              }}
            >
              <X size={14} />
            </button>

            {/* Icon + Title */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <AlertTriangle size={20} color="#DC2626" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
                  Mandatory Fields Required
                </div>
                <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
                  Please complete all mandatory fields before generating the Salary Slip.
                  The highlighted fields require your attention.
                </div>
              </div>
            </div>

            {/* Error list */}
            <div style={{
              background: '#FEF2F2', border: '1px solid #FEE2E2',
              borderRadius: 8, padding: '12px 14px', marginBottom: 20,
            }}>
              {(Object.entries(validationErrors) as [string, string | Record<string, unknown>][]).filter(([k]) => k !== 'deductions').map(([, msg]) => (
                <div key={msg as string} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#B91C1C', marginBottom: 3 }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#DC2626', flexShrink: 0, display: 'inline-block' }} />
                  {msg as string}
                </div>
              ))}
              {validationErrors.deductions && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#B91C1C', marginBottom: 3 }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#DC2626', flexShrink: 0, display: 'inline-block' }} />
                  Some deduction rows have incomplete name or amount.
                </div>
              )}
            </div>

            <button
              onClick={() => setShowValidationDialog(false)}
              style={{
                width: '100%', padding: '10px 0', background: '#0F172A',
                color: '#fff', border: 'none', borderRadius: 8,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                letterSpacing: '0.01em',
              }}
            >
              Review Fields
            </button>
          </div>
        </div>
      )}

      {/* ── UNSAVED CHANGES DIALOG ──────────────────────────────────── */}
      {pendingNavKey && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(15,23,42,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}
          onClick={handleCancelUnsavedNav}
        >
          <div
            style={{
              background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              padding: '28px 32px', maxWidth: 440, width: '100%',
              position: 'relative',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={handleCancelUnsavedNav}
              style={{
                position: 'absolute', top: 14, right: 14,
                background: '#F1F5F9', border: 'none', borderRadius: 6,
                width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#64748B',
              }}
            >
              <X size={14} />
            </button>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <AlertTriangle size={20} color="#DC2626" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
                  Unsaved Changes
                </div>
                <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
                  {unsavedDialogSource === 'invoice'
                    ? "This invoice hasn't been saved yet. Switching pages now will lose your changes."
                    : unsavedDialogSource === 'invoice-settings'
                    ? "These invoice settings haven't been saved yet. Switching pages now will lose your changes."
                    : "This payslip hasn't been exported yet. Switching pages now will lose your changes."}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleCancelUnsavedNav}
                style={{
                  flex: 1, padding: '10px 0', background: '#F1F5F9',
                  color: '#0F172A', border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Stay & Save
              </button>
              <button
                onClick={handleDiscardAndNavigate}
                style={{
                  flex: 1, padding: '10px 0', background: '#DC2626',
                  color: '#fff', border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Discard & Switch
              </button>
            </div>
          </div>
        </div>
      )}

      <EmailSalaryModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        employeeName={data.employee.name}
        employeeEmail={employees.find(e => e.employeeId === data.employee.id)?.email || data.employee.email || ''}
        month={data.salary.month}
        year={data.salary.year}
        sending={isGenerating}
        onSend={handleEmailEmployee}
      />

      {/* Dedicated PDF rendering layer — always mounted, off-screen (not
          display:none, so the browser still lays it out and html2canvas
          can capture it), completely independent of the on-screen
          preview's scale/transform state. This is what Export PDF
          actually captures now. */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }} aria-hidden="true">
        <SalarySlipPDF data={data} brand={brand} taxConfig={fixedTaxConfig} pdfRef={pdfRef} />
      </div>

      <TopNav
        logoDataUri={brand.logoDataUri}
        appName={APP_NAME}
        periodLabel={getCurrentPeriodLabel()}
        onLogout={logout}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(v => !v)}
      />

      <div className="app-body">
        <Sidebar
          activeKey={activePage}
          onNavigate={handleNavigate}
          teamDirectoryLabel={TEAM_DIRECTORY_TITLE}
          collapsed={sidebarCollapsed}
        />

        <main className="app-content">

          {activePage === 'generator' && (
            <div className="page-container app-page">
              <div className="main-grid">

                {/* ── LEFT: Form ──────────────────────────────── */}
                <div className="animate-fade-in-up" style={{ minWidth: 0 }}>
                  <div style={{ marginBottom: 20 }}>
                    <h1 style={{ fontSize: 17, fontWeight: 800, color: 'var(--clr-text)', margin: 0, letterSpacing: '-0.02em' }}>
                      Salary Slip Generator
                    </h1>
                    <p style={{ fontSize: 12, color: 'var(--clr-text-muted)', margin: '2px 0 0' }}>
                      Fill in the details — the preview updates live
                    </p>
                  </div>
                  <SalarySlipForm
                    data={data}
                    onChange={setData}
                    errors={validationErrors}
                    touched={touchedFields}
                    onBlurField={handleBlurField}
                    onBlurDeduction={handleBlurDeduction}
                    employees={employees}
                    onSelectEmployee={handleSelectEmployee}
                    onOpenEmployeeMaster={() => setActivePage('directory')}
                    employeeDirectoryTitle={TEAM_DIRECTORY_TITLE}
                  />
                </div>

                {/* ── RIGHT: Live Preview ─────────────────────── */}
                <aside className="preview-panel animate-fade-in-up" style={{ animationDelay: '80ms', minWidth: 0 }}>
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--clr-text)', margin: 0, letterSpacing: '-0.02em' }}>Live Preview</p>
                    <p style={{ fontSize: 12, color: 'var(--clr-text-muted)', margin: '2px 0 0' }}>A4 · Updates instantly</p>
                  </div>

                  {/* Icon-only actions, stacked vertically beside the
                      preview itself rather than as labelled buttons
                      above it. */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <PreviewToolbar
                        zoomPct={Math.round(previewScale * 100)}
                        onZoomIn={handleZoomIn}
                        onZoomOut={handleZoomOut}
                        onSetZoom={handleSetZoom}
                        onFitWidth={handleFitWidth}
                        onFitPage={handleFitPage}
                        onReset={handleResetZoom}
                        onFullscreen={handleToggleFullscreen}
                        isFullscreen={isPreviewFullscreen}
                      />

                      <div className="preview-shell" ref={shellRef}>
                        {data.employee.name.trim() ? (
                          <div style={{
                            width: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            /* collapsed height = A4 height × scale; A4 = 1123px at 96dpi */
                            minHeight: `${Math.round(1123 * previewScale)}px`,
                            padding: '28px 0',
                          }}>
                            <div
                              id="preview-scale-wrapper"
                              style={{
                                width: 794,
                                transformOrigin: 'top center',
                                transform: `scale(${previewScale})`,
                                flexShrink: 0,
                                boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                                borderRadius: 3,
                                height: 'fit-content',
                              }}
                            >
                              <SalarySlipPreview data={data} previewRef={previewRef} taxConfig={fixedTaxConfig} brand={brand} />
                            </div>
                          </div>
                        ) : (
                          <div className="preview-empty-state">
                            <div className="preview-empty-state-icon"><FileText size={22} /></div>
                            <h2>No employee selected</h2>
                            <p>Select an employee or enter their name to generate a live salary slip preview.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={handleDownloadPDF}
                        disabled={isGenerating}
                        className="btn-icon"
                        title={isGenerating ? 'Exporting…' : 'Export PDF'}
                        aria-label={isGenerating ? 'Exporting…' : 'Export PDF'}
                        style={{
                          width: 36, height: 36, border: 'none', borderRadius: 8,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'var(--arna-navy)', color: '#fff', opacity: isGenerating ? 0.7 : 1,
                        }}
                      >
                        {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                      </button>
                      <ExportShareDropdown
                        disabled={isGenerating}
                        onEmailEmployee={handleOpenEmailModal}
                        onGmail={() => handleShareVia('gmail')}
                        onOutlook={() => handleShareVia('outlook')}
                      />
                    </div>
                  </div>
                </aside>

              </div>
            </div>
          )}

          {activePage === 'dashboard' && (
            <div className="page-container app-page">
              <Suspense fallback={<PageLoadingFallback />}>
                <DashboardPage
                  employees={employees}
                  salaryHistory={salaryHistory}
                  activityLog={activityLog}
                  currentMonth={data.salary.month}
                  currentYear={String(data.salary.year)}
                  onNavigate={handleNavigate}
                  onOpenEmployeeMaster={() => setActivePage('directory')}
                  onDeleteActivity={handleDeleteActivity}
                />
              </Suspense>
            </div>
          )}

          {activePage === 'directory' && (
            <div className="page-container app-page">
              <Suspense fallback={<PageLoadingFallback />}>
                <EmployeesPage
                  employees={employees}
                  loading={employeesLoading}
                  onEmployeesChange={setEmployees}
                  title={TEAM_DIRECTORY_TITLE}
                  onEmployeeAdded={handleEmployeeAdded}
                  onEmployeeUpdated={handleEmployeeUpdated}
                  onEmployeeDeleted={handleEmployeeDeleted}
                />
              </Suspense>
            </div>
          )}

          {activePage === 'documents' && (
            <div className="page-container app-page">
              <Suspense fallback={<PageLoadingFallback />}>
                <DocumentsPage />
              </Suspense>
            </div>
          )}

          {activePage === 'taxcenter' && (
            <div className="page-container app-page">
              <Suspense fallback={<PageLoadingFallback />}>
                <TaxCenterPage />
              </Suspense>
            </div>
          )}

          {activePage === 'history' && (
            <div className="page-container app-page">
              <Suspense fallback={<PageLoadingFallback />}>
                <SalaryHistoryPage
                  records={salaryHistory}
                  loading={salaryHistoryLoading}
                  onLoadRecord={loadHistoryRecordIntoGenerator}
                  onDelete={handleDeleteHistoryRecord}
                />
              </Suspense>
            </div>
          )}

          {activePage === 'export' && (
            <div className="page-container app-page">
              <Suspense fallback={<PageLoadingFallback />}>
                <PayrollExportPage
                  records={salaryHistory}
                  defaultMonth={data.salary.month}
                  defaultYear={String(data.salary.year)}
                  onExported={handlePayrollExported}
                />
              </Suspense>
            </div>
          )}

          {activePage === 'settings' && (
            <div className="page-container app-page">
              <Suspense fallback={<PageLoadingFallback />}>
                <CompanySettingsPage
                  brand={brand}
                  onBrandChange={setBrand}
                  onResetBrand={handleResetBrand}
                  errors={validationErrors}
                  touched={touchedFields}
                  onBlurField={handleBlurField}
                  onSettingsChanged={handleSettingsChanged}
                />
              </Suspense>
            </div>
          )}

          {activePage === 'invoice-generator' && (
            <div className="page-container app-page">
              <Suspense fallback={<PageLoadingFallback />}>
                <InvoiceGeneratorPage
                  openRequest={invoiceOpenRequest}
                  onOpenRequestHandled={() => setInvoiceOpenRequest(null)}
                  onDirtyChange={setInvoiceDirty}
                />
              </Suspense>
            </div>
          )}

          {activePage === 'invoice-history' && (
            <div className="page-container app-page">
              <Suspense fallback={<PageLoadingFallback />}>
                <InvoiceHistoryPage onOpenInvoice={openInvoice} />
              </Suspense>
            </div>
          )}

          {activePage === 'invoice-settings' && (
            <div className="page-container app-page">
              <Suspense fallback={<PageLoadingFallback />}>
                <InvoiceSettingsPage onDirtyChange={setInvoiceSettingsDirty} />
              </Suspense>
            </div>
          )}

          <Footer />
        </main>
      </div>
    </div>
    </CurrencyProvider>
    </ProtectedRoute>
  );
}
