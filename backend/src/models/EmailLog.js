import mongoose from 'mongoose';

/**
 * Audit trail for every salary-slip email send attempt — one document
 * per attempt, success or failure. Deliberately separate from
 * SalaryHistory (which only ever holds the *current* email state via
 * emailStatus/emailSentAt/emailRecipient): a record can be re-emailed
 * multiple times, and each attempt (including failures) should stay
 * visible here rather than being overwritten.
 */
const emailLogSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: [true, 'Employee ID is required'], trim: true },
    employeeName: { type: String, required: [true, 'Employee name is required'], trim: true },
    recipientEmail: { type: String, required: [true, 'Recipient email is required'], trim: true },
    salaryHistoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryHistory', default: null },
    pdfArchiveId: { type: mongoose.Schema.Types.ObjectId, ref: 'PdfArchive', default: null },
    subject: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['Sent', 'Failed'], required: true },
    errorMessage: { type: String, trim: true, default: '' },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('EmailLog', emailLogSchema);
