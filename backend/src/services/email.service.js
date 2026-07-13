import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import EmailLog from '../models/EmailLog.js';
import SalaryHistory from '../models/SalaryHistory.js';
import PdfArchive from '../models/PdfArchive.js';
import { AppError } from '../utils/AppError.js';

/**
 * Email Automation service (Sprint 5.5, refactored Sprint 6.2B).
 *
 * Sprint 6.2B root-cause fix: this used to fetch the PDF to attach by
 * reading it back off local disk via pdfStorage.service.js's
 * getPdfFilePath() — that worked on localhost but failed in
 * production on Render, where nothing guarantees the file written by
 * an earlier "Export PDF" request is still on disk (or on the same
 * instance) by the time "Email" runs as a separate request. The
 * caller now sends the exact same in-memory PDF buffer it already
 * generated for Google Drive upload directly in this request — this
 * service never reads from disk and never re-downloads from Drive,
 * it only ever attaches the bytes it was handed. See
 * controllers/email.controller.js / routes/email.routes.js for the
 * multer wiring that turns the multipart upload into `buffer` below.
 */

const PDF_MAGIC_BYTES = '%PDF-';

let cachedTransporter = null;

/** Never logs the real address — just enough to confirm in Render's
    logs that EMAIL_USER is actually set and roughly what it is
    ("sw***@gmail.com"), without putting a real mailbox address in
    plaintext logs. */
function maskEmail(email) {
  if (!email) return '(not set)';
  const [local, domain] = String(email).split('@');
  if (!domain) return '***';
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

/** Lazily built so a missing/blank EMAIL_USER/EMAIL_PASS doesn't break
    server startup — it only surfaces as a send failure, caught and
    logged the same as any other SMTP error.
 *
 * Investigated for the production hotfix ("localhost sends, Render
 * times out, despite Drive/Mongo/PDF/attachment all succeeding" —
 * i.e. the failure is specifically at the SMTP connection stage).
 * There is exactly one transporter defined anywhere in this backend
 * (this function) — no duplicate/stale config elsewhere that could
 * explain the deployed process using something different from what's
 * below; the log line this function prints on first use is the
 * ground truth for whatever is actually running.
 *
 * The prior fix forced IPv4 (`family: 4`) on the theory that Render's
 * outbound networking couldn't route Gmail's IPv6 address — that
 * remains in place below (it's still correct and harmless either
 * way), but port 465 (implicit TLS) continuing to time out even with
 * IPv6 ruled out points at the port itself, not the IP family: 465
 * requires the TLS handshake to begin immediately on connect, and
 * several PaaS/container network layers (Render's outbound proxy
 * among them, by report) are known to stall or drop that specific
 * handshake pattern while still allowing a plain TCP connect followed
 * by an explicit STARTTLS upgrade on port 587 through cleanly. Gmail
 * supports both on smtp.gmail.com; 587 + STARTTLS is Google's own
 * documented "if 465 doesn't work in your environment" fallback.
 * `requireTLS: true` keeps this from ever silently sending over an
 * unencrypted connection if the STARTTLS upgrade fails — the send
 * fails loudly instead. */
function getTransporter() {
  if (!cachedTransporter) {
    const config = {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // STARTTLS on 587, not implicit TLS — see comment above
      requireTLS: true,
      family: 4, // force IPv4 — see comment above
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    };
    console.log('[email] Creating SMTP transporter:', {
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: config.requireTLS,
      family: config.family,
      connectionTimeout: config.connectionTimeout,
      greetingTimeout: config.greetingTimeout,
      socketTimeout: config.socketTimeout,
      service: 'gmail (explicit host, not the "service: gmail" shorthand)',
      EMAIL_USER: maskEmail(process.env.EMAIL_USER),
    });
    cachedTransporter = nodemailer.createTransport({
      ...config,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return cachedTransporter;
}

/** Connection-only health check (Production Hotfix) — verifies the
    SMTP handshake (DNS + TCP connect + STARTTLS + auth) independent
    of sending an actual message, so a boot-time log can say
    definitively "SMTP reachable" or show the exact failing stage
    (err.code) without waiting for a real "Email Employee" click.
    Called once from server.js on startup; safe to call again anytime
    (e.g. from a future health-check route) since it reuses the same
    cached transporter. */
export async function verifyEmailTransporter() {
  try {
    await getTransporter().verify();
    console.log('[email] SMTP connection verified OK.');
    return true;
  } catch (err) {
    console.error('[email] SMTP verification FAILED:', {
      code: err.code,
      command: err.command,
      message: err.message,
    });
    return false;
  }
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
    throw new AppError(`Invalid ${label}`, 400, 'validation');
  }
}

/** Turns a raw SMTP/network error into a specific, loggable reason
    instead of a bare "Failed to send email" (Sprint 6.2B requirement
    2). Nodemailer/Node's SMTP transport surfaces the failure kind via
    `err.code`; falls back to matching the message text for the few
    cases that don't set one. */
function categorizeSmtpError(err) {
  const code = err.code || '';
  const message = (err.message || '').toLowerCase();

  if (code === 'EAUTH' || message.includes('invalid login') || message.includes('username and password not accepted')) {
    return 'SMTP authentication failed — check EMAIL_USER / EMAIL_PASS (must be a Gmail App Password, not the account login password)';
  }
  if (code === 'ETIMEDOUT' || message.includes('timeout')) {
    return 'SMTP connection timeout — the mail server did not respond in time';
  }
  if (code === 'ECONNECTION' || code === 'ESOCKET' || message.includes('econnrefused') || message.includes('connect')) {
    return 'SMTP connection error — unable to reach the mail server';
  }
  if (code === 'EENVELOPE' || message.includes('recipient') || message.includes('envelope')) {
    return 'SMTP rejected the recipient address';
  }
  return err.message || 'SMTP send failed';
}

/** Best-effort audit log write for a failed attempt — never allowed
    to itself throw and mask the real error the caller is already
    raising. */
async function logFailure({ employeeId, employeeName, recipientEmail, salaryHistoryId, pdfArchiveId, subject, stage, reason }) {
  await EmailLog.create({
    employeeId,
    employeeName,
    recipientEmail,
    salaryHistoryId: salaryHistoryId || null,
    pdfArchiveId: pdfArchiveId || null,
    subject,
    status: 'Failed',
    errorMessage: reason,
    stage,
  }).catch((err) => {
    console.error('[email] Failed to write EmailLog failure record:', err.message);
  });
}

/**
 * Full send workflow (Sprint 6.2B): Validate inputs → Validate the
 * in-memory PDF buffer the caller sent → Verify the PDF Archive
 * record exists and its Google Drive upload already succeeded →
 * Attach the buffer directly to Nodemailer → Send → Save Email Log →
 * Update Salary History → Return Success. No filesystem read, no
 * Google Drive read, at any point in this function.
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
  buffer,
}) {
  if (!employeeId || !employeeName) {
    throw new AppError('employeeId and employeeName are required', 400, 'validation');
  }
  if (!recipientEmail) {
    throw new AppError('This employee has no email address on file — add one in Employee Master first', 400, 'validation');
  }
  if (!pdfArchiveId) {
    throw new AppError('No PDF archive reference was provided — export this salary slip first, then email it', 400, 'validation');
  }
  assertValidObjectId(salaryHistoryId, 'salaryHistoryId');
  assertValidObjectId(pdfArchiveId, 'pdfArchiveId');

  const subject = (customSubject && customSubject.trim()) || buildSubject({ month, year });
  const body = buildBody({ employeeName, month, year });
  const logContext = { employeeId, employeeName, recipientEmail, salaryHistoryId, pdfArchiveId, subject };

  // Requirement 7 — attachment verification, entirely in memory.
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    await logFailure({ ...logContext, stage: 'attachment', reason: 'PDF attachment is missing or empty' });
    throw new AppError('PDF attachment is missing or empty', 400, 'attachment');
  }
  if (buffer.subarray(0, 5).toString('ascii') !== PDF_MAGIC_BYTES) {
    await logFailure({ ...logContext, stage: 'attachment', reason: 'PDF attachment is not a valid PDF file' });
    throw new AppError('PDF attachment is not a valid PDF file', 400, 'attachment');
  }

  // Requirement 3 — Google Drive verification before send. The
  // archive record (and its driveFileId) is only ever set by
  // pdfStorage.service.js's storePdf(), which this sprint explicitly
  // leaves untouched — this is a read-only check, never a re-upload.
  const archive = await PdfArchive.findById(pdfArchiveId);
  if (!archive) {
    await logFailure({ ...logContext, stage: 'archive', reason: 'PDF archive record not found' });
    throw new AppError('PDF archive record not found — export this salary slip again, then email it', 404, 'archive');
  }
  if (!archive.driveFileId) {
    await logFailure({ ...logContext, stage: 'drive', reason: 'Google Drive upload has not completed for this salary slip' });
    throw new AppError(
      'This salary slip has not finished uploading to Google Drive yet — please wait a moment and try again',
      409,
      'drive'
    );
  }

  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject,
      text: body,
      // filename intentionally taken from the archive record, not the
      // client — this is the exact same name storePdf() gave the file
      // it archived and uploaded to Drive, e.g. "ARNA_CONT001_July_2026.pdf".
      attachments: [{ filename: archive.pdfFileName, content: buffer, contentType: 'application/pdf' }],
    });
  } catch (err) {
    const reason = categorizeSmtpError(err);
    console.error('[email] SMTP send failed:', { code: err.code, message: err.message, recipientEmail });
    await logFailure({ ...logContext, stage: 'email', reason });
    if (salaryHistoryId) {
      await SalaryHistory.findByIdAndUpdate(salaryHistoryId, {
        emailStatus: 'Failed',
        emailRecipient: recipientEmail,
      }).catch(() => {});
    }
    throw new AppError(`Failed to send email: ${reason}`, 502, 'email');
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
