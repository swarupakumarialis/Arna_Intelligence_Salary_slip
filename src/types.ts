export interface SalaryItem {
  id: string;
  name: string;
  amount: number;
}

export interface TaxRule {
  id: string;
  name: string;
  type: 'percentage' | 'slab' | 'fixed' | 'formula';
  rate?: number;
  minAmount?: number;
  maxAmount?: number;
  baseOn: 'gross' | 'basic' | 'taxable' | 'net' | 'tax';
  slabs?: TaxSlab[];
  formula?: string;
  isDeduction: boolean;
  isStatutory: boolean;
  description?: string;
  appliesTo: 'all' | 'monthly' | 'annual';
}

export interface TaxSlab {
  min: number;
  max: number | null;
  rate: number;
  fixedAmount?: number;
}

export interface TaxConfig {
  id: string;
  name: string;
  country: string;
  currency: string;
  locale: string;
  taxYear: number;
  rules: TaxRule[];
  standardDeductions?: StandardDeduction[];
  isCustom: boolean;
}

export interface StandardDeduction {
  id: string;
  name: string;
  amount: number;
  type: 'fixed' | 'percentage';
  baseOn?: 'gross' | 'basic';
}

export interface TaxCalculation {
  taxableIncome: number;
  totalTax: number;
  breakdown: TaxBreakdownItem[];
  effectiveRate: number;
  afterTaxIncome: number;
}

export interface TaxBreakdownItem {
  ruleId: string;
  ruleName: string;
  baseAmount: number;
  calculatedAmount: number;
  rate?: number;
  isDeduction: boolean;
}

export interface CompanyDetails {
  name: string;
  address: string;
  logo: string | null;
}

export interface EmployeeDetails {
  name: string;
  id: string;
  designation: string;
  department: string;
  doj: string;
  email?: string;
  panNumber?: string;
  bankAccount?: string;
  bankName?: string;
  ifscCode?: string;
}

export interface SalaryDetails {
  month: string;
  year: string;
  workingDays: number;
  paidDays: number;
  lopDays: number;
  basicSalary?: number;
  taxConfigId?: string;
  taxCalculation?: TaxCalculation;
}

export type EmploymentType = 'Full-time' | 'Part-time' | 'Contract' | 'Intern';

/* ── Employee Master ──────────────────────────────────────────
   Persistent employee directory, independent of any single payslip
   and independent of any one company — this type and its backend
   storage (src/api/employeeApi.ts) are generic. `id` is the internal
   storage key; `employeeId` is the user-facing business ID (aka
   "Employee Code") shown on the payslip and used for lookup/search. */
export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  department: string;
  designation: string;
  employmentType?: EmploymentType;
  photoDataUri?: string | null;
  /** Free-text HR note on pay structure (e.g. "CTC 6L, Basic 40%, HRA 20%") — not a computed field. */
  salaryStructureNote?: string;
  pan?: string;
  aadhaar?: string;
  bankAccount?: string;
  bankName?: string;
  branch?: string;
  ifsc?: string;
  uan?: string;
  manager?: string;
  emergencyContact?: string;
  doj: string;
  employmentEndDate?: string;
  notes?: string;
  status: 'Active' | 'Inactive';
}

/* ── Salary History ───────────────────────────────────────────
   A snapshot recorded automatically each time a payslip PDF is
   exported. Deliberately richer than a bare audit trail — it keeps
   the full earnings/deductions breakdown so Payroll Export can later
   report Basic/HRA/PF/PT/ESI/TDS/etc. per record without needing to
   re-derive anything from the (mutable, in-progress) live form. */
export interface SalaryHistoryRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  employmentType?: EmploymentType;
  month: string;
  year: string;
  workingDays: number;
  paidDays: number;
  lopDays: number;
  earnings: SalaryItem[];
  deductions: SalaryItem[];
  grossSalary: number;
  totalDeduction: number;
  netSalary: number;
  generatedDate: string;
  generatedTime: string;
  companyName: string;
  pdfVersion: string;
  status: 'Generated';
  /** Sprint 5.4 — the only addition to this interface. Set once the
      generated PDF has been archived on the backend (see
      src/api/pdfApi.ts); undefined for records created before this
      sprint, or if archiving failed (archiving is best-effort and
      never blocks a payslip download). */
  pdfArchiveId?: string;
  /** Sprint 5.5 — email automation additions, same "optional, no
      migration needed" convention as pdfArchiveId above. Set by the
      backend (see src/api/emailApi.ts) after a send attempt; undefined
      for records that have never been emailed. */
  emailStatus?: 'Pending' | 'Sent' | 'Failed';
  emailSentAt?: string;
  emailRecipient?: string;
}

export type ActivityType =
  | 'salary_generated'
  | 'employee_added'
  | 'employee_updated'
  | 'employee_deleted'
  | 'salary_deleted'
  | 'payroll_exported'
  | 'company_settings_changed'
  | 'salary_shared';

export interface ActivityLogEntry {
  id: string;
  type: ActivityType;
  employeeName: string;
  detail?: string;
  timestamp: string;
}

export interface SalaryData {
  company: CompanyDetails;
  employee: EmployeeDetails;
  salary: SalaryDetails;
  earnings: SalaryItem[];
  deductions: SalaryItem[];
  signatures?: Record<string, unknown>;
}

export interface BulkEmployeeData {
  employeeId: string;
  name: string;
  designation: string;
  department: string;
  doj: string;
  email?: string;
  panNumber?: string;
  bankAccount?: string;
  bankName?: string;
  ifscCode?: string;
  basicSalary: number;
  hra?: number;
  specialAllowance?: number;
  otherEarnings?: number;
  paidDays?: number;
  lopDays?: number;
  errors?: string[];
}

export interface BulkUploadResult {
  valid: BulkEmployeeData[];
  invalid: BulkEmployeeData[];
  totalCount: number;
}
