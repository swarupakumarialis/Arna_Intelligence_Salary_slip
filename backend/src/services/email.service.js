import { Resend } from 'resend';
import mongoose from 'mongoose';
import EmailLog from '../models/EmailLog.js';
import SalaryHistory from '../models/SalaryHistory.js';
import PdfArchive from '../models/PdfArchive.js';
import { AppError } from '../utils/AppError.js';

/**
 * Email Automation service (Sprint 5.5, refactored Sprint 6.2B,
 * transport migrated to Resend Sprint 6.3).
 *
 * Sprint 6.2B root-cause fix (still in effect, unchanged by this
 * migration): this used to fetch the PDF to attach by reading it back
 * off local disk — that worked on localhost but failed in production
 * on Render, since nothing guarantees a file written by an earlier
 * "Export PDF" request is still on disk (or on the same instance) by
 * the time "Email" runs as a separate request. The caller sends the
 * exact same in-memory PDF buffer it already generated for Google
 * Drive upload directly in this request — this service never reads
 * from disk and never re-downloads from Drive, it only ever attaches
 * the bytes it was handed. See controllers/email.controller.js /
 * routes/email.routes.js for the multer wiring that turns the
 * multipart upload into `buffer` below.
 *
 * Sprint 6.3 transport migration: Gmail SMTP is gone. Diagnostics
 * (Sprint 6.2F's network-test endpoint) proved Render cannot open an
 * outbound TCP connection to smtp.gmail.com on either 465 or 587 at
 * all — a network/infrastructure block, not anything fixable from
 * transporter config (host/port/secure/family all correct; the
 * connection itself never established). Resend sends over HTTPS to
 * Resend's API instead of a raw SMTP socket, sidestepping that
 * blocked path entirely. Everything downstream of "how the bytes
 * leave this process" — validation, Drive verification, EmailLog,
 * SalaryHistory updates, the API contract — is unchanged.
 */

const PDF_MAGIC_BYTES = '%PDF-';

let cachedResendClient = null;

/** Never logs the real key — just enough to confirm in Render's logs
    that RESEND_API_KEY is actually set, without putting a live secret
    in plaintext logs. */
function maskApiKey(key) {
  if (!key) return '(not set)';
  return `${key.slice(0, 6)}${'*'.repeat(Math.max(key.length - 6, 4))}`;
}

/** Lazily built so a missing RESEND_API_KEY doesn't break server
    startup — it only surfaces as a send failure, caught and logged
    the same as any other Resend error. There is exactly one Resend
    client defined anywhere in this backend (this function) — no
    duplicate/stale config elsewhere. */
function getResendClient() {
  if (!cachedResendClient) {
    console.log('[email] Creating Resend client:', {
      RESEND_API_KEY: maskApiKey(process.env.RESEND_API_KEY),
      EMAIL_FROM: process.env.EMAIL_FROM || '(not set)',
    });
    cachedResendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return cachedResendClient;
}

/** Boot-time config sanity check (replaces the old SMTP
    verifyEmailTransporter — there's no persistent connection to a
    stateless HTTPS API to "verify" the same way; this just confirms
    the required env vars are present, in the boot logs, before any
    real "Email Employee" click). Called once from server.js. */
export async function verifyEmailTransporter() {
  const hasKey = Boolean(process.env.RESEND_API_KEY);
  const hasFrom = Boolean(process.env.EMAIL_FROM);
  if (hasKey && hasFrom) {
    console.log('[email] Resend config present: RESEND_API_KEY and EMAIL_FROM are both set.');
  } else {
    console.error('[email] Resend config INCOMPLETE:', {
      RESEND_API_KEY: hasKey ? 'set' : 'MISSING',
      EMAIL_FROM: hasFrom ? 'set' : 'MISSING',
    });
  }
  return hasKey && hasFrom;
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

/** HTML version of the exact same copy as buildBody above — same
    subject, same words, same sign-off, just wrapped for clients that
    render HTML. text (buildBody) is always sent alongside this as the
    plain-text fallback, so nothing about the actual message content
    changes with this migration. */
function buildHtmlBody({ employeeName, month, year }) {
  const paragraphs = [
    `Dear ${employeeName},`,
    'I hope you are doing well.',
    `Please find attached your salary slip for the month of ${month} ${year}.`,
    'Kindly review the attached document for your records. If you have any questions or notice any discrepancies, please feel free to reach out to the HR team.',
    'Thank you for your continued dedication and valuable contributions to Arna Intelligence. We truly appreciate your commitment and wish you continued success.',
    'Best regards,<br>Team HR<br>Arna Intelligence',
  ];
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;">${p}</p>`).join('\n');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;line-height:1.6;">${body}</div>`;
}

function assertValidObjectId(id, label) {
  if (id && !mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label}`, 400, 'validation');
  }
}

/** Turns a Resend error into a specific, loggable reason instead of a
    bare "Failed to send email" (requirement carried over from Sprint
    6.2B). Resend's SDK returns `{data: null, error: {name, message,
    statusCode}}` for API-level failures (see resend/dist/index.d.cts'
    RESEND_ERROR_CODE_KEY) rather than throwing; a thrown err here
    means the HTTPS request to Resend's API itself failed (DNS/network
    level, before Resend ever saw the request). */
function categorizeResendError(err) {
  const name = err?.name || '';
  const message = err?.message || 'Resend send failed';

  switch (name) {
    case 'missing_api_key':
    case 'invalid_api_key':
    case 'restricted_api_key':
      return 'Resend authentication failed — check RESEND_API_KEY';
    case 'invalid_from_address':
      return 'Invalid sender address — check EMAIL_FROM';
    case 'invalid_attachment':
      return 'Resend rejected the PDF attachment';
    case 'rate_limit_exceeded':
      return 'Resend rate limit exceeded — try again shortly';
    case 'monthly_quota_exceeded':
    case 'daily_quota_exceeded':
      return 'Resend sending quota exceeded';
    case 'validation_error':
    case 'missing_required_field':
    case 'invalid_parameter':
      return `Resend rejected the request: ${message}`;
    case 'security_error':
      return 'Resend blocked this request for security reasons';
    case 'internal_server_error':
    case 'application_error':
      return 'Resend service error — try again shortly';
    default:
      return message;
  }
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

  const html = buildHtmlBody({ employeeName, month, year });

  try {
    const { error } = await getResendClient().emails.send({
      from: process.env.EMAIL_FROM,
      to: recipientEmail,
      subject,
      text: body,
      html,
      // filename intentionally taken from the archive record, not the
      // client — this is the exact same name storePdf() gave the file
      // it archived and uploaded to Drive, e.g. "ARNA_CONT001_July_2026.pdf".
      attachments: [{ filename: archive.pdfFileName, content: buffer, contentType: 'application/pdf' }],
    });
    if (error) {
      // API-level failure (Resend responded, but rejected the send) —
      // thrown here so the single catch block below handles both this
      // and a genuine network-level throw the same way.
      throw error;
    }
  } catch (err) {
    const reason = categorizeResendError(err);
    console.error('[email] Resend send failed:', { name: err?.name, message: err?.message, recipientEmail });
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

function buildInvoiceHtmlBody({ customerName, invoiceNumber, companyName }) {
  const paragraphs = [
    `Dear ${customerName || 'Customer'},`,
    `Please find attached invoice <strong>${invoiceNumber}</strong>${companyName ? ` from ${companyName}` : ''}.`,
    'Kindly review the attached document. If you have any questions, please feel free to reach out.',
    `Thank you for your business.<br>${companyName || ''}`,
  ];
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;">${p}</p>`).join('\n');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;line-height:1.6;">${body}</div>`;
}

function buildInvoiceTextBody({ customerName, invoiceNumber, companyName }) {
  return `Dear ${customerName || 'Customer'},

Please find attached invoice ${invoiceNumber}${companyName ? ` from ${companyName}` : ''}.

Kindly review the attached document. If you have any questions, please feel free to reach out.

Thank you for your business.
${companyName || ''}`;
}

/**
 * Invoice email send (Sprint 5) — reuses this module's Resend client
 * (getResendClient) and error categorization (categorizeResendError)
 * directly rather than duplicating that boilerplate in a separate
 * file, per "reuse the existing Resend email infrastructure". Kept
 * deliberately independent of sendSalaryEmail above: its own
 * subject/body copy, no EmailLog/SalaryHistory writes (Invoice tracks
 * its own emailStatus/emailSentAt/emailRecipient — see
 * services/invoice.service.js's emailInvoicePdf, which calls this and
 * then updates the Invoice document itself), and — unlike
 * sendSalaryEmail — no PdfArchive/Google-Drive-already-uploaded
 * precondition, since Download/Print/Email/Drive are independent
 * actions for Invoice (see Sprint 5 spec's Part 7), not a fixed
 * pipeline order.
 */
export async function sendInvoiceEmail({ recipientEmail, invoiceNumber, customerName, companyName, subject: customSubject, buffer }) {
  if (!recipientEmail) {
    throw new AppError('Recipient email is required', 400, 'validation');
  }
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new AppError('PDF attachment is missing or empty', 400, 'attachment');
  }
  if (buffer.subarray(0, 5).toString('ascii') !== PDF_MAGIC_BYTES) {
    throw new AppError('PDF attachment is not a valid PDF file', 400, 'attachment');
  }

  const subject = (customSubject && customSubject.trim()) || `Invoice ${invoiceNumber}${companyName ? ` from ${companyName}` : ''}`;
  const text = buildInvoiceTextBody({ customerName, invoiceNumber, companyName });
  const html = buildInvoiceHtmlBody({ customerName, invoiceNumber, companyName });

  try {
    const { error } = await getResendClient().emails.send({
      from: process.env.EMAIL_FROM,
      to: recipientEmail,
      subject,
      text,
      html,
      attachments: [{ filename: `${invoiceNumber}.pdf`, content: buffer, contentType: 'application/pdf' }],
    });
    if (error) throw error;
  } catch (err) {
    const reason = categorizeResendError(err);
    console.error('[email] Resend invoice send failed:', { name: err?.name, message: err?.message, recipientEmail });
    throw new AppError(`Failed to send email: ${reason}`, 502, 'email');
  }

  return { sentAt: new Date(), recipientEmail };
}
