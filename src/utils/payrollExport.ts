import * as XLSX from 'xlsx';
import { SalaryHistoryRecord, SalaryItem } from '../types';
import { LOP_DEDUCTION_ID } from './payroll';

export interface PayrollExportRow {
  employeeCode: string;
  employeeName: string;
  department: string;
  employmentType: string;
  workingDays: number;
  paidDays: number;
  lopDays: number;
  grossSalary: number;
  basic: number;
  hra: number;
  specialAllowance: number;
  otherEarnings: number;
  pf: number;
  pt: number;
  esi: number;
  tds: number;
  lopDeduction: number;
  otherDeductions: number;
  totalDeduction: number;
  netSalary: number;
  month: string;
  year: string;
  generatedDate: string;
}

/**
 * The salary data model stores earnings/deductions as freeform named
 * rows (SalaryItem[]), not typed PF/PT/ESI/TDS fields — that's a
 * Salary Generator data-model decision this sprint explicitly doesn't
 * touch. To still produce the requested per-statutory-component export
 * columns, rows are bucketed by name pattern below. This is a
 * best-effort mapping for reporting, not a change to how salary is
 * calculated or displayed anywhere else in the app — any row that
 * doesn't match a known pattern lands safely in "Other Deductions" /
 * "Other Earnings" rather than being dropped.
 */
type EarningBucket = 'basic' | 'hra' | 'specialAllowance' | 'otherEarnings';
type DeductionBucket = 'lopDeduction' | 'pf' | 'pt' | 'esi' | 'tds' | 'otherDeductions';

function classifyEarning(item: SalaryItem): EarningBucket {
  const n = item.name.toLowerCase();
  if (/basic/.test(n)) return 'basic';
  if (/hra|house\s*rent/.test(n)) return 'hra';
  if (/special\s*allowance/.test(n)) return 'specialAllowance';
  return 'otherEarnings';
}

function classifyDeduction(item: SalaryItem): DeductionBucket {
  if (item.id === LOP_DEDUCTION_ID) return 'lopDeduction';
  const n = item.name.toLowerCase();
  if (/provident|\bpf\b/.test(n)) return 'pf';
  if (/professional\s*tax|\bpt\b/.test(n)) return 'pt';
  if (/\besi\b|state\s*insurance/.test(n)) return 'esi';
  if (/\btds\b|income\s*tax|tax\s*deducted/.test(n)) return 'tds';
  return 'otherDeductions';
}

export function buildPayrollExportRows(records: SalaryHistoryRecord[]): PayrollExportRow[] {
  return records.map(r => {
    const earnings: Record<EarningBucket, number> = { basic: 0, hra: 0, specialAllowance: 0, otherEarnings: 0 };
    r.earnings.forEach(i => { earnings[classifyEarning(i)] += Number(i.amount) || 0; });

    const deductions: Record<DeductionBucket, number> = { lopDeduction: 0, pf: 0, pt: 0, esi: 0, tds: 0, otherDeductions: 0 };
    r.deductions.forEach(i => { deductions[classifyDeduction(i)] += Number(i.amount) || 0; });

    return {
      employeeCode: r.employeeId,
      employeeName: r.employeeName,
      department: r.department,
      employmentType: r.employmentType || '',
      workingDays: r.workingDays,
      paidDays: r.paidDays,
      lopDays: r.lopDays,
      grossSalary: r.grossSalary,
      basic: earnings.basic,
      hra: earnings.hra,
      specialAllowance: earnings.specialAllowance,
      otherEarnings: earnings.otherEarnings,
      pf: deductions.pf,
      pt: deductions.pt,
      esi: deductions.esi,
      tds: deductions.tds,
      lopDeduction: deductions.lopDeduction,
      otherDeductions: deductions.otherDeductions,
      totalDeduction: r.totalDeduction,
      netSalary: r.netSalary,
      month: r.month,
      year: r.year,
      generatedDate: r.generatedDate,
    };
  });
}

const COLUMNS: { key: keyof PayrollExportRow; header: string }[] = [
  { key: 'employeeCode', header: 'Employee Code' },
  { key: 'employeeName', header: 'Employee Name' },
  { key: 'department', header: 'Department' },
  { key: 'employmentType', header: 'Employment Type' },
  { key: 'workingDays', header: 'Working Days' },
  { key: 'paidDays', header: 'Paid Days' },
  { key: 'lopDays', header: 'LOP Days' },
  { key: 'grossSalary', header: 'Gross Salary' },
  { key: 'basic', header: 'Basic' },
  { key: 'hra', header: 'HRA' },
  { key: 'specialAllowance', header: 'Special Allowance' },
  { key: 'otherEarnings', header: 'Other Earnings' },
  { key: 'pf', header: 'PF' },
  { key: 'pt', header: 'PT' },
  { key: 'esi', header: 'ESI' },
  { key: 'tds', header: 'TDS' },
  { key: 'lopDeduction', header: 'LOP Deduction' },
  { key: 'otherDeductions', header: 'Other Deductions' },
  { key: 'totalDeduction', header: 'Total Deduction' },
  { key: 'netSalary', header: 'Net Salary' },
  { key: 'month', header: 'Month' },
  { key: 'year', header: 'Year' },
  { key: 'generatedDate', header: 'Generated Date' },
];

function toAoa(records: SalaryHistoryRecord[]): (string | number)[][] {
  const rows = buildPayrollExportRows(records);
  return [
    COLUMNS.map(c => c.header),
    ...rows.map(row => COLUMNS.map(c => row[c.key])),
  ];
}

/** Aggregate figures for the "review before you export" summary screen. */
export interface PayrollSummary {
  employeeCount: number;
  estimatedGross: number;
  estimatedNet: number;
  totalPf: number;
  totalPt: number;
  totalEsi: number;
  totalLop: number;
}

export function buildPayrollSummary(records: SalaryHistoryRecord[]): PayrollSummary {
  const rows = buildPayrollExportRows(records);
  return rows.reduce((s, r) => ({
    employeeCount: s.employeeCount + 1,
    estimatedGross: s.estimatedGross + r.grossSalary,
    estimatedNet: s.estimatedNet + r.netSalary,
    totalPf: s.totalPf + r.pf,
    totalPt: s.totalPt + r.pt,
    totalEsi: s.totalEsi + r.esi,
    totalLop: s.totalLop + r.lopDeduction,
  }), { employeeCount: 0, estimatedGross: 0, estimatedNet: 0, totalPf: 0, totalPt: 0, totalEsi: 0, totalLop: 0 });
}

/** Exports the given (already-filtered) records to a downloaded .xlsx file. */
export function exportPayrollToExcel(records: SalaryHistoryRecord[], filename: string): void {
  const worksheet = XLSX.utils.aoa_to_sheet(toAoa(records));
  worksheet['!cols'] = COLUMNS.map(c => ({ wch: Math.max(c.header.length + 2, 12) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Payroll');
  XLSX.writeFile(workbook, filename);
}

/** Exports the given (already-filtered) records to a downloaded .csv file. */
export function exportPayrollToCsv(records: SalaryHistoryRecord[], filename: string): void {
  const escapeCell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = toAoa(records).map(row => row.map(escapeCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Single entry point for "export this payroll run" — the format is
 * just a string switch today (xlsx/csv), so adding a future format
 * (e.g. a bank-transfer file, a statutory-filing format) means adding
 * one case here and one function above it, not restructuring how the
 * export page calls into this module.
 */
export type ExportFormat = 'xlsx' | 'csv';

export function exportPayroll(records: SalaryHistoryRecord[], format: ExportFormat, baseFilename: string): void {
  if (format === 'csv') {
    exportPayrollToCsv(records, `${baseFilename}.csv`);
  } else {
    exportPayrollToExcel(records, `${baseFilename}.xlsx`);
  }
}
