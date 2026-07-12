import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import EmailLog from '../models/EmailLog.js';
import SalaryHistory from '../models/SalaryHistory.js';
import { getPdfFilePath } from './pdfStorage.service.js';
import { AppError } from '../utils/AppError.js';

/**
 * Email Automation service (Sprint 5.5). Reuses pdfStorage.service.js's
 * getPdfFilePath() to locate the ALREADY-STORED PDF on disk — this
 * module never renders or uploads a PDF itself, it only ever reads one
 * that pdfStorage.service.js already wrote. EMAIL_USER/EMAIL_PASS are
 * read from process.env exactly as database.js reads MONGODB_URI —
 * backend/.env is never touched or written to by this file.
 */

let cachedTransporter = null;

/** Lazily built so a missing/blank EMAIL_USER/EMAIL_PASS doesn't break
    server startup — it only surfaces as a send failure, caught and
    logged the same as any other SMTP error. Gmail's "service" shorthand
    is assumed since EMAIL_USER/EMAIL_PASS are the only two email env
    vars defined (no EMAIL_HOST/EMAIL_PORT) — see Known Limitations. */
function getTransporter() {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return cachedTransporter;
}

function buildSubject({ month, year }) {
  return `Salary Slip – ${month} ${year} | ARNA Intelligence`;
}

/* Verbatim template text as provided — intentionally NOT parameterised
   by companyName (unlike the rest of this white-label app): the
   sign-off literally reads "Arna Intelligence" in the exact copy
   requested. */
function buildBody({ employeeName, month, year }) {
  return `Dear ${employeeName},

I hope you are doing well.

Please find attached your salary slip for the month of ${month} ${year}.

Kindly review the attached document for your records. If you have any questions or notice any discrepancies, please feel free to reach out to the HR team.

Thank you for your continued dedication and valuable contributions to Arna Intelligence. We truly appreciate your commitment and wish you continued success.

Best regards,

Team HR
Arna Intelligence`;
}

function assertValidObjectId(id, label) {
  if (id && !mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
}

/**
 * Full send workflow: Read Employee (recipientEmail passed in by the
 * caller, already resolved from Employee Master) → Locate PDF Archive
 * → Fetch Stored PDF → Attach PDF → Send Email → Save Email Log →
 * Update Salary History → Return Success.
 */
export async function sendSalaryEmail({
  employeeId,
  employeeName,
  recipientEmail,
  month,
  year,
  salaryHistoryId,
  pdfArchiveId,
  subject: customSubject,
}) {
  if (!employeeId || !employeeName) {
    throw new AppError('employeeId and employeeName are required', 400);
  }
  if (!recipientEmail) {
    throw new AppError('This employee has no email address on file — add one in Employee Master first', 400);
  }
  if (!pdfArchiveId) {
    throw new AppError('No stored PDF found for this salary slip — export it first, then email it', 400);
  }
  assertValidObjectId(salaryHistoryId, 'salaryHistoryId');
  assertValidObjectId(pdfArchiveId, 'pdfArchiveId');

  const subject = (customSubject && customSubject.trim()) || buildSubject({ month, year });
  const body = buildBody({ employeeName, month, year });

  // Locate + fetch the already-stored PDF. Never regenerated here.
  let filePath;
  try {
    filePath = await getPdfFilePath(pdfArchiveId);
  } catch (err) {
    await EmailLog.create({
      employeeId,
      employeeName,
      recipientEmail,
      salaryHistoryId: salaryHistoryId || null,
      pdfArchiveId,
      subject,
      status: 'Failed',
      errorMessage: err.message || 'Stored PDF could not be found',
    });
    throw new AppError('Stored PDF could not be found — export the salary slip again', 404);
  }

  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject,
      text: body,
      attachments: [{ filename: filePath.fileName, path: filePath.absolutePath }],
    });
  } catch (err) {
    await EmailLog.create({
      employeeId,
      employeeName,
      recipientEmail,
      salaryHistoryId: salaryHistoryId || null,
      pdfArchiveId,
      subject,
      status: 'Failed',
      errorMessage: err.message || 'SMTP send failed',
    });
    if (salaryHistoryId) {
      await SalaryHistory.findByIdAndUpdate(salaryHistoryId, {
        emailStatus: 'Failed',
        emailRecipient: recipientEmail,
      }).catch(() => {});
    }
    throw new AppError(`Failed to send email: ${err.message || 'SMTP error'}`, 502);
  }

  const sentAt = new Date();
  const log = await EmailLog.create({
    employeeId,
    employeeName,
    recipientEmail,
    salaryHistoryId: salaryHistoryId || null,
    pdfArchiveId,
    subject,
    status: 'Sent',
    sentAt,
  });

  if (salaryHistoryId) {
    await SalaryHistory.findByIdAndUpdate(salaryHistoryId, {
      emailStatus: 'Sent',
      emailSentAt: sentAt,
      emailRecipient: recipientEmail,
    }).catch(() => {
      // Non-fatal — the email genuinely sent and the log genuinely
      // exists; a failed status patch shouldn't turn a real success
      // into a reported failure.
    });
  }

  return log;
}
