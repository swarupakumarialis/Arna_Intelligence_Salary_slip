import mongoose from 'mongoose';

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Intern'];

/** Embedded — an earnings/deductions row only ever exists as part of
    one salary history record, same reasoning as Employee's bankDetails
    subdocument. */
const salaryItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

/**
 * Salary History schema — field-for-field the same as the frontend's
 * existing SalaryHistoryRecord interface (src/types.ts), with no
 * renaming (unlike Employee, where the field names were dictated by an
 * earlier sprint spec). `employeeId` is stored as the same plain
 * business-key string the rest of the app already uses to relate a
 * payslip to an employee (see SalarySlipForm.tsx's
 * `employees.find(e => e.employeeId === ...)`) — not a Mongo ObjectId
 * ref, since the app has never modelled that relationship that way and
 * introducing one now would be inventing new behaviour outside this
 * sprint's scope.
 */
const salaryHistorySchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: [true, 'Employee ID is required'], trim: true },
    employeeName: { type: String, required: [true, 'Employee name is required'], trim: true },
    department: { type: String, trim: true, default: '' },
    designation: { type: String, trim: true, default: '' },
    employmentType: { type: String, enum: [...EMPLOYMENT_TYPES, null], default: null },
    month: { type: String, required: [true, 'Month is required'], trim: true },
    year: { type: String, required: [true, 'Year is required'], trim: true },
    workingDays: { type: Number, default: 0 },
    paidDays: { type: Number, default: 0 },
    lopDays: { type: Number, default: 0 },
    earnings: { type: [salaryItemSchema], default: [] },
    deductions: { type: [salaryItemSchema], default: [] },
    grossSalary: { type: Number, required: true, default: 0 },
    totalDeduction: { type: Number, required: true, default: 0 },
    netSalary: { type: Number, required: true, default: 0 },
    generatedDate: { type: String, trim: true, default: '' },
    generatedTime: { type: String, trim: true, default: '' },
    companyName: { type: String, trim: true, default: '' },
    pdfVersion: { type: String, trim: true, default: 'v1' },
    status: { type: String, enum: ['Generated'], default: 'Generated' },
    /* Sprint 5.4 — the ONLY change to this file. Optional reference to
       this record's archived PDF (see models/PdfArchive.js); defaults
       to null so every existing document remains valid with no
       migration. Set by services/pdfStorage.service.js after a PDF
       upload, never by anything in this module. */
    pdfArchiveId: { type: mongoose.Schema.Types.ObjectId, ref: 'PdfArchive', default: null },
    /* Sprint 5.5 — the ONLY change to this file since. Optional email
       status, set by services/email.service.js after a send attempt;
       no default on emailStatus so existing/never-emailed documents
       simply omit the field rather than reading as a fake "Pending". */
    emailStatus: { type: String, enum: ['Pending', 'Sent', 'Failed'] },
    emailSentAt: { type: Date, default: null },
    emailRecipient: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('SalaryHistory', salaryHistorySchema);
