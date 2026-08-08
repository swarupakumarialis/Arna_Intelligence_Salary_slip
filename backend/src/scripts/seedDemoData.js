import 'dotenv/config';
import mongoose from 'mongoose';
import Employee from '../models/Employee.js';
import SalaryHistory from '../models/SalaryHistory.js';
import Invoice from '../models/Invoice.js';
import { DEMO_SOURCE } from './demoSource.js';

/**
 * Development-only demo data seeder (Sprint 9 — Gemini integration).
 * Creates a small, clearly-fake dataset (8 employees, a spread of
 * salary-history records, and a spread of invoices) so the AI
 * Assistant — RuleBasedProvider or GeminiProvider — can be exercised
 * end to end against realistic-shaped answers without touching any
 * real company data.
 *
 * SAFETY:
 *  - NEVER wired into server.js/app.js — this only runs when a human
 *    explicitly runs `npm run seed:demo`.
 *  - Every record this script writes carries `source: DEMO_SOURCE`
 *    ('ARNA_DEMO' — see models/Employee.js, SalaryHistory.js, Invoice.js
 *    for the additive schema field). Nothing else in the app ever sets
 *    that field, so it's an unambiguous, precise marker.
 *  - Idempotent: every write is an upsert keyed on a natural unique key
 *    (employeeId / invoiceNumber / employeeId+month+year+source),
 *    never a blind insert — re-running this script updates the same
 *    demo records instead of duplicating them.
 *  - Refuses to run against NODE_ENV=production unless the operator
 *    explicitly opts in with ALLOW_DEMO_SEED_IN_PROD=true — demo data
 *    has no business existing in a real deployment.
 *  - Removal is the paired script, scripts/removeDemoData.js — a
 *    precisely-scoped deleteMany({ source: DEMO_SOURCE }) per
 *    collection, never a broad deleteMany().
 *
 * Usage:
 *   cd backend
 *   npm run seed:demo
 */

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysFromNow(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d;
}

function monthYearLabel(monthsAgo) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  return { month: d.toLocaleDateString('en-IN', { month: 'long' }), year: String(d.getFullYear()) };
}

// ── 8 demo employees (Part 9) — varied names, departments,
// designations, employment types, joining dates, statuses, emails,
// phone numbers. Two (Rohan, Sneha) join THIS calendar month and one
// (Vikram) joins LAST calendar month — computed relative to "now" at
// seed time rather than hardcoded, so "Who joined this month?"/
// "Recent employees?" always has something real to answer with,
// however long after this script was written it's actually run. ────
const DEMO_EMPLOYEES = [
  {
    employeeId: 'ARNA-DEMO-001', fullName: 'Aarav Sharma',
    department: 'Engineering', designation: 'Software Engineer', employmentType: 'Full-time',
    status: 'Active', dateOfJoining: ymd(daysFromNow(-730)),
    email: 'aarav.demo@example.com', phone: '9000000001',
  },
  {
    employeeId: 'ARNA-DEMO-002', fullName: 'Priya Mehta',
    department: 'HR', designation: 'HR Manager', employmentType: 'Full-time',
    status: 'Active', dateOfJoining: ymd(daysFromNow(-1095)),
    email: 'priya.demo@example.com', phone: '9000000002',
  },
  {
    employeeId: 'ARNA-DEMO-003', fullName: 'Rahul Das',
    department: 'Finance', designation: 'Finance Analyst', employmentType: 'Full-time',
    status: 'Active', dateOfJoining: ymd(daysFromNow(-548)),
    email: 'rahul.demo@example.com', phone: '9000000003',
  },
  {
    employeeId: 'ARNA-DEMO-004', fullName: 'Ananya Singh',
    department: 'Marketing', designation: 'Marketing Lead', employmentType: 'Full-time',
    status: 'Inactive', dateOfJoining: ymd(daysFromNow(-1460)),
    email: 'ananya.demo@example.com', phone: '9000000004',
  },
  {
    employeeId: 'ARNA-DEMO-005', fullName: 'Rohan Roy',
    department: 'Engineering', designation: 'Software Engineering Intern', employmentType: 'Intern',
    status: 'Active', dateOfJoining: ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 5)),
    email: 'rohan.demo@example.com', phone: '9000000005',
  },
  {
    employeeId: 'ARNA-DEMO-006', fullName: 'Sneha Gupta',
    department: 'HR', designation: 'HR Intern', employmentType: 'Intern',
    status: 'Active', dateOfJoining: ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 12)),
    email: 'sneha.demo@example.com', phone: '9000000006',
  },
  {
    employeeId: 'ARNA-DEMO-007', fullName: 'Vikram Patel',
    department: 'Operations', designation: 'Operations Consultant', employmentType: 'Contract',
    status: 'Active', dateOfJoining: ymd(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 18)),
    email: 'vikram.demo@example.com', phone: '9000000007',
  },
  {
    employeeId: 'ARNA-DEMO-008', fullName: 'Neha Kapoor',
    department: 'Finance', designation: 'Payroll Specialist', employmentType: 'Part-time',
    status: 'Active', dateOfJoining: ymd(daysFromNow(-60)),
    email: 'neha.demo@example.com', phone: '9000000008',
  },
];

function toEmployeeDocument(e) {
  return {
    employeeId: e.employeeId,
    fullName: e.fullName,
    email: e.email,
    phone: e.phone,
    address: 'Demo Address, Not a Real Location',
    department: e.department,
    designation: e.designation,
    employmentType: e.employmentType,
    dateOfJoining: e.dateOfJoining,
    status: e.status,
    source: DEMO_SOURCE,
  };
}

// ── Demo salary-history records (Part 10) — current month + previous
// month, a mix of Sent and Failed email status, across four different
// demo employees. ────────────────────────────────────────────────
function salaryItems(basic, hra, pf, tax) {
  return {
    earnings: [
      { id: 'basic', name: 'Basic Salary', amount: basic },
      { id: 'hra', name: 'HRA', amount: hra },
    ],
    deductions: [
      { id: 'pf', name: 'Provident Fund', amount: pf },
      { id: 'tax', name: 'Professional Tax', amount: tax },
    ],
  };
}

function buildSalaryRecord(employee, { month, year }, { basic, hra, pf, tax, emailStatus }) {
  const { earnings, deductions } = salaryItems(basic, hra, pf, tax);
  const grossSalary = basic + hra;
  const totalDeduction = pf + tax;
  const now = new Date();
  return {
    employeeId: employee.employeeId,
    employeeName: employee.fullName,
    department: employee.department,
    designation: employee.designation,
    employmentType: employee.employmentType,
    month,
    year,
    workingDays: 22,
    paidDays: 22,
    lopDays: 0,
    earnings,
    deductions,
    grossSalary,
    totalDeduction,
    netSalary: grossSalary - totalDeduction,
    generatedDate: ymd(now),
    generatedTime: now.toTimeString().slice(0, 8),
    companyName: 'ARNA Demo Co (Test Data)',
    pdfVersion: 'v1',
    status: 'Generated',
    emailStatus,
    emailSentAt: emailStatus === 'Sent' ? now : null,
    emailRecipient: emailStatus === 'Sent' ? employee.email : null,
    source: DEMO_SOURCE,
  };
}

function buildDemoSalaryRecords(employeesById) {
  const current = monthYearLabel(0);
  const previous = monthYearLabel(1);
  return [
    buildSalaryRecord(employeesById['ARNA-DEMO-001'], current, { basic: 45000, hra: 18000, pf: 5400, tax: 200, emailStatus: 'Sent' }),
    buildSalaryRecord(employeesById['ARNA-DEMO-002'], current, { basic: 60000, hra: 24000, pf: 7200, tax: 200, emailStatus: 'Sent' }),
    buildSalaryRecord(employeesById['ARNA-DEMO-003'], current, { basic: 50000, hra: 20000, pf: 6000, tax: 200, emailStatus: 'Failed' }),
    buildSalaryRecord(employeesById['ARNA-DEMO-004'], current, { basic: 55000, hra: 22000, pf: 6600, tax: 200, emailStatus: 'Sent' }),
    buildSalaryRecord(employeesById['ARNA-DEMO-001'], previous, { basic: 45000, hra: 18000, pf: 5400, tax: 200, emailStatus: 'Sent' }),
    buildSalaryRecord(employeesById['ARNA-DEMO-002'], previous, { basic: 60000, hra: 24000, pf: 7200, tax: 200, emailStatus: 'Failed' }),
    buildSalaryRecord(employeesById['ARNA-DEMO-003'], previous, { basic: 50000, hra: 20000, pf: 6000, tax: 200, emailStatus: 'Sent' }),
    buildSalaryRecord(employeesById['ARNA-DEMO-007'], previous, { basic: 35000, hra: 14000, pf: 4200, tax: 200, emailStatus: 'Sent' }),
  ];
}

// ── Demo invoices (Part 11) — covers all six real invoice statuses
// (Draft/Sent/Paid/Partially Paid/Overdue/Cancelled — "Unpaid" per the
// spec is Sent+Overdue+Partially Paid combined, so all three are
// represented), clearly-fake customer/company names. ──────────────
function buildDemoInvoices() {
  const item = (description, unitPrice) => ({ description, quantity: 1, unitPrice, taxPercent: 0 });
  const base = (overrides) => ({
    company: 'ARNA Demo Co (Test Data)',
    email: 'billing.demo@example.com',
    phone: '9000000099',
    gstin: '',
    billingAddress: 'Demo Address, Not a Real Location',
    paymentTerms: 'Net 30',
    currency: 'INR',
    subtotal: overrides.grandTotal,
    discount: 0,
    taxableAmount: overrides.grandTotal,
    cgst: 0,
    sgst: 0,
    roundOff: 0,
    notes: 'ARNA_DEMO test invoice — not a real transaction.',
    source: DEMO_SOURCE,
    ...overrides,
  });

  return [
    base({
      invoiceNumber: 'ARNA-DEMO-INV-0001', customer: 'Sample Traders Co (Demo)', status: 'Draft',
      invoiceDate: ymd(daysFromNow(-2)), dueDate: ymd(daysFromNow(28)),
      items: [item('Demo consulting services', 25000)], grandTotal: 25000,
    }),
    base({
      invoiceNumber: 'ARNA-DEMO-INV-0002', customer: 'Bright Retail Ltd (Demo)', status: 'Sent',
      invoiceDate: ymd(daysFromNow(-5)), dueDate: ymd(daysFromNow(25)),
      items: [item('Demo software license', 48000)], grandTotal: 48000,
    }),
    base({
      invoiceNumber: 'ARNA-DEMO-INV-0003', customer: 'Nova Textiles Pvt Ltd (Demo)', status: 'Paid',
      invoiceDate: ymd(daysFromNow(-40)), dueDate: ymd(daysFromNow(-10)),
      items: [item('Demo implementation project', 62000)], grandTotal: 62000,
      emailStatus: 'Sent', emailSentAt: daysFromNow(-39), emailRecipient: 'billing.demo@example.com',
    }),
    base({
      invoiceNumber: 'ARNA-DEMO-INV-0004', customer: 'Zenith Foods (Demo)', status: 'Partially Paid',
      invoiceDate: ymd(daysFromNow(-20)), dueDate: ymd(daysFromNow(10)),
      items: [item('Demo support retainer', 30000)], grandTotal: 30000,
    }),
    base({
      invoiceNumber: 'ARNA-DEMO-INV-0005', customer: 'Orbit Logistics (Demo)', status: 'Overdue',
      invoiceDate: ymd(daysFromNow(-60)), dueDate: ymd(daysFromNow(-15)),
      items: [item('Demo logistics integration', 15000)], grandTotal: 15000,
    }),
    base({
      invoiceNumber: 'ARNA-DEMO-INV-0006', customer: 'Vertex Solutions (Demo)', status: 'Cancelled',
      invoiceDate: ymd(daysFromNow(-15)), dueDate: ymd(daysFromNow(15)),
      items: [item('Demo cancelled engagement', 20000)], grandTotal: 20000,
    }),
  ];
}

async function upsertEmployees() {
  let created = 0, updated = 0;
  const byId = {};
  for (const e of DEMO_EMPLOYEES) {
    const doc = toEmployeeDocument(e);
    const existing = await Employee.findOne({ employeeId: doc.employeeId }).select('_id').lean();
    const saved = await Employee.findOneAndUpdate(
      { employeeId: doc.employeeId },
      { $set: doc },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    byId[doc.employeeId] = saved;
    if (existing) updated += 1; else created += 1;
  }
  console.log(`[seed:demo] Employees — ${created} created, ${updated} updated.`);
  return byId;
}

async function upsertSalaryHistory(employeesById) {
  let created = 0, updated = 0;
  for (const rec of buildDemoSalaryRecords(employeesById)) {
    const filter = { employeeId: rec.employeeId, month: rec.month, year: rec.year, source: DEMO_SOURCE };
    const existing = await SalaryHistory.findOne(filter).select('_id').lean();
    await SalaryHistory.findOneAndUpdate(filter, { $set: rec }, { upsert: true, runValidators: true, setDefaultsOnInsert: true });
    if (existing) updated += 1; else created += 1;
  }
  console.log(`[seed:demo] Salary history — ${created} created, ${updated} updated.`);
}

async function upsertInvoices() {
  let created = 0, updated = 0;
  for (const inv of buildDemoInvoices()) {
    const existing = await Invoice.findOne({ invoiceNumber: inv.invoiceNumber }).select('_id').lean();
    await Invoice.findOneAndUpdate(
      { invoiceNumber: inv.invoiceNumber },
      { $set: inv },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    if (existing) updated += 1; else created += 1;
  }
  console.log(`[seed:demo] Invoices — ${created} created, ${updated} updated.`);
}

async function run() {
  if ((process.env.NODE_ENV || '').toLowerCase() === 'production' && process.env.ALLOW_DEMO_SEED_IN_PROD !== 'true') {
    console.error('[seed:demo] Refusing to run: NODE_ENV=production. Demo data must never be seeded into a production database. Set ALLOW_DEMO_SEED_IN_PROD=true to override (not recommended).');
    process.exitCode = 1;
    return;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[seed:demo] MONGODB_URI is not set — configure backend/.env before running.');
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(uri);
  console.log('[seed:demo] Connected to MongoDB.');

  const employeesById = await upsertEmployees();
  await upsertSalaryHistory(employeesById);
  await upsertInvoices();

  console.log(`[seed:demo] Done. All records tagged source="${DEMO_SOURCE}". Run "npm run remove:demo" to remove them.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[seed:demo] Failed:', err.message);
  process.exitCode = 1;
});
