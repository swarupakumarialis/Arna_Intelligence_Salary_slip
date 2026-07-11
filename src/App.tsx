import React, { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { SalaryData, Employee } from './types';
import { SalarySlipForm } from './components/SalarySlipForm';
import { SalarySlipPreview } from './components/SalarySlipPreview';
import { SalarySlipPDF } from './components/pdf/SalarySlipPDF';
import { EmployeeMaster } from './components/EmployeeMaster';
import { TopNav } from './components/layout/TopNav';
import { Sidebar, SidebarKey } from './components/layout/Sidebar';
import { Download, Loader2, AlertTriangle, X, CheckCircle2, FileText } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { defaultTaxConfigs } from './utils/taxCalculator';
import { seedEmployeesIfEmpty, applyEmployeeEnrichment } from './utils/employeeStore';
import { calculateLop, LOP_DEDUCTION_ID } from './utils/payroll';
import { arnaTeamSeed } from './data/arnaTeamSeed';
import { ARNA_EMPLOYEE_ENRICHMENT, ARNA_EMPLOYEE_ENRICHMENT_FLAG } from './data/arnaEmployeeEnrichment';
import type { BrandConfig } from './utils/companySettingsStore';
import { DEFAULT_BRAND, loadCompanySettings, saveCompanySettings } from './utils/companySettingsStore';
import { SalaryHistoryRecord } from './types';
import { addSalaryHistoryRecord, deleteSalaryHistoryRecord, loadSalaryHistory } from './utils/salaryHistoryStore';
import { logActivity, deleteActivityEntry, loadActivityLog } from './utils/activityLogStore';
import { useAuth } from './hooks/useAuth';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { getCurrentPeriodLabel, getCurrentMonthName, getCurrentYear } from './utils/date';
import { ExportShareDropdown } from './components/share/ExportShareDropdown';
import { EmailSalaryModal } from './components/share/EmailSalaryModal';
import { buildEmailSubject, buildEmailBody } from './components/share/EmailTemplate';
import { PreviewToolbar } from './components/preview/PreviewToolbar';
import { CurrencyProvider, CurrencyCode } from './contexts/CurrencyContext';

/* Lazy-loaded — these are the pages a user visits after the Salary
   Generator, not on first load, so they're split into separate chunks
   rather than bundled into the initial page weight. Payroll Export in
   particular pulls in the xlsx library, which is otherwise the single
   largest dependency in the app. */
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const SalaryHistoryPage = lazy(() => import('./pages/SalaryHistoryPage').then(m => ({ default: m.SalaryHistoryPage })));
const PayrollExportPage = lazy(() => import('./pages/PayrollExportPage').then(m => ({ default: m.PayrollExportPage })));
const CompanySettingsPage = lazy(() => import('./pages/CompanySettingsPage').then(m => ({ default: m.CompanySettingsPage })));

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
   The lines below are the only company-specific wiring in the whole
   app. To stand this up for a different company: point
   ACTIVE_EMPLOYEE_SEED at that company's own `Employee[]` seed file
   (see src/data/arnaTeamSeed.ts for the shape and the pattern to
   copy), and update TEAM_DIRECTORY_TITLE / APP_NAME. Nothing in
   employeeStore.ts, EmployeeMaster.tsx, or the Employee type needs to
   change. APP_NAME is the software's own product name (shown in the
   top nav); it's intentionally separate from BrandConfig.companyName,
   which is the tenant's legal entity name shown on the payslip. */
const ACTIVE_EMPLOYEE_SEED = arnaTeamSeed;
const TEAM_DIRECTORY_TITLE = 'ARNA Team Directory';
const APP_NAME = 'ARNA Salary Suite';
/* One-time field enrichment for installations that were already seeded
   before this data existed — see applyEmployeeEnrichment() in
   utils/employeeStore.ts and src/data/arnaEmployeeEnrichment.ts. Swap
   alongside ACTIVE_EMPLOYEE_SEED when adapting this app for another
   company (or drop to {} / a fresh flag if there's nothing to enrich). */
const ACTIVE_EMPLOYEE_ENRICHMENT = ARNA_EMPLOYEE_ENRICHMENT;
const ACTIVE_EMPLOYEE_ENRICHMENT_FLAG = ARNA_EMPLOYEE_ENRICHMENT_FLAG;

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [brand, setBrandState] = useState<BrandConfig>(loadCompanySettings);
  /* Live Preview zoom — 'fixed' means previewScale is whatever the
     toolbar last set directly (a preset % or +/- step); 'fit-width'/
     'fit-page' mean it's recomputed on every resize to fit the shell
     (see the effect below). Defaults to fixed 100%, per spec. */
  const [zoomMode, setZoomMode] = useState<'fixed' | 'fit-width' | 'fit-page'>('fixed');
  const [previewScale, setPreviewScale] = useState(1);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<FormErrors>({});
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [touchedFields, setTouchedFields] = useState<TouchedFields>({});
  /* Lazy initializer — runs exactly once, on first render, before
     anything else touches the employee directory. seedEmployeesIfEmpty
     itself checks localStorage first, so this is safe to call on
     every app start: it only ever writes when the directory is empty.
     applyEmployeeEnrichment runs right after — it targets installs that
     were already seeded before the enrichment data existed, and is
     itself gated by its own one-time flag, so it's equally safe to call
     on every app start. */
  const [employees, setEmployees] = useState<Employee[]>(() =>
    applyEmployeeEnrichment(
      seedEmployeesIfEmpty(ACTIVE_EMPLOYEE_SEED),
      ACTIVE_EMPLOYEE_ENRICHMENT,
      ACTIVE_EMPLOYEE_ENRICHMENT_FLAG
    )
  );
  const [showEmployeeMaster, setShowEmployeeMaster] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistoryRecord[]>(loadSalaryHistory);
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
  const previewRef = useRef<HTMLDivElement>(null);
  /* Points at the dedicated SalarySlipPDF instance (rendered off-screen,
     always mounted — see the JSX below) rather than the on-screen
     SalarySlipPreview. Export captures this node now, not the preview. */
  const pdfRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

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

  /* Propagate the brand colours onto the document root as live theme
     variables, so the whole app (buttons, focus rings, badges) — not
     just the payslip preview — repaints instantly on colour change. */
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', brand.primaryColour || '#0F172A');
    root.style.setProperty('--brand-secondary', brand.secondaryColour || '#5EEAD4');
  }, [brand.primaryColour, brand.secondaryColour]);

  /* Autofill the employee block from a saved Employee Master record.
     Bank name and email aren't tracked by Employee Master, so they're
     cleared rather than carried over from whichever employee was
     previously selected. */
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
        bankName: '',
        ifscCode: emp.ifsc || '',
        email: '',
      },
    }));
  }, [employees]);

  /* ARNA Team Directory is still the existing modal, not a page —
     clicking it opens the modal without disturbing whatever page was
     showing underneath. Every other sidebar item just switches which
     page is visible in the content area. */
  const handleNavigate = useCallback((key: SidebarKey) => {
    if (key === 'directory') {
      setShowEmployeeMaster(true);
      return;
    }
    setActivePage(key);
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

  /* The one PDF-generation pipeline shared by every export/email/share
     entry point (Export PDF, Email Employee, Share → Gmail/Outlook/
     Download PDF). Validates, captures the off-screen PDF layer, and
     builds the jsPDF document exactly as the original single-purpose
     handleDownloadPDF always did — nothing about capture options,
     timing, or the PDF's own layout changed in this extraction, only
     the final `pdf.save(...)` call moved out to each caller, since
     Email/Share need the document before deciding what to do with it.
     Still records the Salary History + a 'salary_generated' activity
     entry every time, same as before: a real slip was generated
     regardless of which button triggered it. Returns null (after
     showing the validation dialog) if the form isn't valid yet. */
  const generateSalarySlipPdf = useCallback(async (): Promise<{ pdf: jsPDF; fileName: string } | null> => {
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
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    const fileName = `Salary_Slip_${data.employee.name.replace(/\s+/g, '_')}_${data.salary.month}.pdf`;

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
    setSalaryHistory(addSalaryHistoryRecord(record));
    setActivityLog(logActivity('salary_generated', data.employee.name, `${data.salary.month} ${data.salary.year}`));

    return { pdf, fileName };
  }, [data, brand, employees]);

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

  /* Email Employee — generates + downloads the PDF exactly like Export
     PDF, then opens the user's default mail client via mailto: with
     the (possibly user-edited) recipient/subject/message. Browsers
     don't allow a web page to attach a file to an outgoing email, so
     "attach automatically" means "download it for you and tell you to
     attach it" — EmailSalaryModal's inline note says this explicitly. */
  const handleEmailEmployee = useCallback(async (to: string, subject: string, message: string) => {
    try {
      setIsGenerating(true);
      const result = await generateSalarySlipPdf();
      if (!result) return;
      result.pdf.save(result.fileName);
      setActivityLog(logActivity('salary_shared', data.employee.name, `Emailed to ${to}`));
      setShowEmailModal(false);
      setNotice(`Salary slip downloaded. Attach it to the email now opening for ${to}.`);
      setTimeout(() => setNotice(null), 6000);
      window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    } catch (error) {
      console.error('Error preparing email:', error);
      setPdfError('Failed to generate PDF for email. Please try again.');
      setTimeout(() => setPdfError(null), 4000);
    } finally {
      setIsGenerating(false);
    }
  }, [generateSalarySlipPdf, data.employee.name]);

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
        companyName: brand.companyName,
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
  }, [generateSalarySlipPdf, data, brand, employees]);

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
    setActivePage('generator');
    if (autoExport) {
      setPendingAutoExport(true);
      setNotice(`Regenerating ${record.employeeName}'s ${record.month} ${record.year} PDF…`);
    } else {
      setNotice(`Loaded ${record.employeeName}'s ${record.month} ${record.year} payslip into the Salary Generator — click Export PDF to download it.`);
    }
    setTimeout(() => setNotice(null), 5000);
  }, []);

  const handleDeleteHistoryRecord = useCallback((record: SalaryHistoryRecord) => {
    setSalaryHistory(deleteSalaryHistoryRecord(record.id));
    setActivityLog(logActivity('salary_deleted', record.employeeName, `${record.month} ${record.year}`));
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
      exchangeRate={brand.exchangeRate || 86}
      onCurrencyChange={(c: CurrencyCode) => setBrand({ ...brand, defaultCurrency: c })}
      onExchangeRateChange={(r: number) => setBrand({ ...brand, exchangeRate: r })}
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

      <EmployeeMaster
        isOpen={showEmployeeMaster}
        onClose={() => setShowEmployeeMaster(false)}
        onEmployeesChange={setEmployees}
        title={TEAM_DIRECTORY_TITLE}
        onEmployeeAdded={handleEmployeeAdded}
        onEmployeeUpdated={handleEmployeeUpdated}
        onEmployeeDeleted={handleEmployeeDeleted}
      />

      <EmailSalaryModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        employeeName={data.employee.name}
        employeeEmail={employees.find(e => e.employeeId === data.employee.id)?.email || data.employee.email || ''}
        month={data.salary.month}
        year={data.salary.year}
        companyName={brand.companyName}
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
        tagline="Payroll Management Platform"
        periodLabel={getCurrentPeriodLabel()}
        onLogout={logout}
      />

      <div className="app-body">
        <Sidebar
          activeKey={showEmployeeMaster ? 'directory' : activePage}
          onNavigate={handleNavigate}
          teamDirectoryLabel={TEAM_DIRECTORY_TITLE}
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
                    onOpenEmployeeMaster={() => setShowEmployeeMaster(true)}
                    employeeDirectoryTitle={TEAM_DIRECTORY_TITLE}
                  />
                </div>

                {/* ── RIGHT: Live Preview ─────────────────────── */}
                <aside className="preview-panel animate-fade-in-up" style={{ animationDelay: '80ms' }}>
                  <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--clr-text)', margin: 0 }}>Live Preview</p>
                      <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', margin: '2px 0 0' }}>A4 · Updates instantly</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={handleDownloadPDF}
                        disabled={isGenerating}
                        className="btn btn-dark"
                        style={{ fontSize: 12, opacity: isGenerating ? 0.7 : 1 }}
                      >
                        {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                        {isGenerating ? 'Exporting…' : 'Export PDF'}
                      </button>
                      <ExportShareDropdown
                        disabled={isGenerating}
                        onDownloadPDF={handleDownloadPDF}
                        onEmailEmployee={() => setShowEmailModal(true)}
                        onGmail={() => handleShareVia('gmail')}
                        onOutlook={() => handleShareVia('outlook')}
                      />
                    </div>
                  </div>

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
                  onOpenEmployeeMaster={() => setShowEmployeeMaster(true)}
                  onDeleteActivity={handleDeleteActivity}
                />
              </Suspense>
            </div>
          )}

          {activePage === 'history' && (
            <div className="page-container app-page">
              <Suspense fallback={<PageLoadingFallback />}>
                <SalaryHistoryPage
                  records={salaryHistory}
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

        </main>
      </div>
    </div>
    </CurrencyProvider>
    </ProtectedRoute>
  );
}
