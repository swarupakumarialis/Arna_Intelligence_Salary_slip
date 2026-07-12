import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import PdfArchive from '../models/PdfArchive.js';
import SalaryHistory from '../models/SalaryHistory.js';
import { AppError } from '../utils/AppError.js';
import * as storageService from './storage/storageService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** backend/generated-pdfs — the one existing storage location from
    Sprint 5.1; this module writes here and nowhere else. */
const STORAGE_ROOT = path.resolve(__dirname, '..', '..', 'generated-pdfs');

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB — a payslip PDF is a few hundred KB at most
const PDF_MAGIC_BYTES = '%PDF-';

/** Turns a raw value (employeeId, month, year) into a safe path
    segment: "/" and "\" become "_" (so "ARNA/CONT001" reads as
    "ARNA_CONT001" instead of silently losing the separator), ".."
    sequences are removed outright, then anything left that isn't
    alphanumeric/space/dash/underscore is stripped and whitespace
    collapses to "_". This is what actually prevents directory
    traversal: the resulting string can never contain "/", "\", or
    "..", so a path built from it can never escape STORAGE_ROOT
    regardless of what was submitted. */
function sanitizeSegment(value) {
  return String(value || '')
    .replace(/[/\\]/g, '_')
    .replace(/\.\./g, '')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'unknown';
}

function assertValidId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid PDF id', 400);
  }
}

/** Builds the EmployeeID_Month_Year.pdf name, e.g. "ARNA_CONT001_July_2026.pdf" —
    the employeeId's "/" (ARNA/CONT001) becomes "_" via sanitizeSegment. */
function buildBaseFileName({ employeeId, month, year }) {
  return `${sanitizeSegment(employeeId)}_${sanitizeSegment(month)}_${sanitizeSegment(year)}.pdf`;
}

/** Never overwrites: if the target name is already taken, appends a
    timestamp before the extension until a free name is found. Returns
    pdfPath as a portable "/"-joined relative path (independent of the
    OS this happens to run on) alongside the real, OS-native absolute
    path used for the actual filesystem write. */
async function reserveFilePath(year, month, baseFileName) {
  const yearSeg = sanitizeSegment(year);
  const monthSeg = sanitizeSegment(month);
  const dir = path.join(STORAGE_ROOT, yearSeg, monthSeg);
  await fs.mkdir(dir, { recursive: true });

  let candidate = baseFileName;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const fullPath = path.join(dir, candidate);
    try {
      await fs.access(fullPath);
      // File exists — try again with a unique suffix.
      attempt += 1;
      const suffix = `${Date.now()}${attempt > 1 ? `-${attempt}` : ''}`;
      candidate = baseFileName.replace(/\.pdf$/i, `_${suffix}.pdf`);
    } catch {
      // fs.access threw => file does not exist => this name is free.
      return { fullPath, fileName: candidate, pdfPath: `${yearSeg}/${monthSeg}/${candidate}` };
    }
  }
}

/** Defence in depth: even though pdfPath is always server-generated
    (see buildBaseFileName/reserveFilePath) and always "/"-joined,
    re-verify the resolved absolute path is still inside STORAGE_ROOT
    before ever reading a file from disk. path.resolve/path.join both
    accept "/" as a segment separator on every OS Node runs on
    (including Windows), so no OS-specific conversion is needed here. */
function resolveWithinStorageRoot(relativePath) {
  const segments = String(relativePath).split('/').filter(Boolean);
  const resolved = path.resolve(STORAGE_ROOT, ...segments);
  if (!resolved.startsWith(STORAGE_ROOT + path.sep) && resolved !== STORAGE_ROOT) {
    throw new AppError('Invalid PDF path', 400);
  }
  return resolved;
}

/**
 * Validates and saves an uploaded PDF buffer to generated-pdfs/<year>/<month>/,
 * creates its MongoDB metadata record, and — if a salaryHistoryId was
 * given — links the two by setting SalaryHistory.pdfArchiveId. This is
 * the only place that write happens; salaryHistory.service.js itself
 * is untouched.
 *
 * Sprint 5.9 (now OAuth-based as of Sprint 6.2A) — once the local
 * archive above is safely written, also uploads the same bytes to
 * Google Drive as an additional copy (see services/storage/). That
 * step is strictly best-effort: it runs
 * after everything the caller actually needs (the local file, the
 * PdfArchive record, the Salary History link) has already succeeded,
 * and any Drive failure is caught and logged here rather than thrown
 * — Export PDF must complete whether or not Drive is reachable.
 */
export async function storePdf({ buffer, employeeId, employeeName, month, year, salaryHistoryId, generatedBy }) {
  if (!buffer || buffer.length === 0) throw new AppError('PDF file is empty', 400);
  if (buffer.length > MAX_FILE_SIZE) throw new AppError('PDF file is too large (max 10MB)', 400);
  if (buffer.subarray(0, 5).toString('ascii') !== PDF_MAGIC_BYTES) {
    throw new AppError('Uploaded file is not a valid PDF', 400);
  }
  if (!employeeId || !employeeName || !month || !year) {
    throw new AppError('employeeId, employeeName, month, and year are required', 400);
  }
  if (salaryHistoryId && !mongoose.Types.ObjectId.isValid(salaryHistoryId)) {
    throw new AppError('Invalid salaryHistoryId', 400);
  }

  const baseFileName = buildBaseFileName({ employeeId, month, year });
  const { fullPath, fileName, pdfPath } = await reserveFilePath(year, month, baseFileName);
  await fs.writeFile(fullPath, buffer);

  let archive;
  try {
    archive = await PdfArchive.create({
      employeeId,
      employeeName,
      month,
      year,
      salaryHistoryId: salaryHistoryId || null,
      pdfFileName: fileName,
      pdfPath,
      fileSize: buffer.length,
      generatedBy: generatedBy || 'HR Admin',
      provider: 'local',
    });
  } catch (err) {
    // Metadata write failed — don't leave an orphan file behind.
    await fs.unlink(fullPath).catch(() => {});
    if (err.name === 'ValidationError') throw new AppError(err.message, 400);
    throw err;
  }

  if (salaryHistoryId) {
    await SalaryHistory.findByIdAndUpdate(salaryHistoryId, { pdfArchiveId: archive._id }).catch(() => {
      // Non-fatal: the archive itself is still valid and retrievable
      // by its own id even if linking back to the history record failed.
    });
  }

  // Google Drive — additional cloud archive (Sprint 5.9). Everything
  // the caller actually needs has already succeeded above; this is
  // purely additive and must never turn a successful export into a
  // failure, so it's wrapped in its own try/catch with no rethrow.
  try {
    const { fileId, shareUrl } = await storageService.upload({ buffer, fileName, year, month });
    const updated = await PdfArchive.findByIdAndUpdate(
      archive._id,
      { provider: 'google-drive', driveFileId: fileId, shareUrl, uploadedAt: new Date() },
      { new: true }
    );
    if (updated) archive = updated;
  } catch (err) {
    // Local archive (file + metadata + Salary History link) is
    // already durable — a Drive failure (including "not connected",
    // which is expected until HR completes the OAuth flow once) only
    // ever shows up here as a server-side warning, never as an error
    // surfaced to the export.
    console.warn('[googleDrive] Upload failed — local PDF archive is unaffected:', err.message);
  }

  return archive;
}

export async function getPdfArchiveById(id) {
  assertValidId(id);
  const archive = await PdfArchive.findById(id);
  if (!archive) throw new AppError('PDF not found', 404);
  return archive;
}

/** Returns the absolute on-disk path for a given archive record,
    verified to be inside STORAGE_ROOT. */
export async function getPdfFilePath(id) {
  const archive = await getPdfArchiveById(id);
  const absolutePath = resolveWithinStorageRoot(archive.pdfPath);
  try {
    await fs.access(absolutePath);
  } catch {
    throw new AppError('PDF file is missing from storage', 404);
  }
  return { absolutePath, fileName: archive.pdfFileName, archive };
}

/** Deletes the file on disk, its Drive copy (if one was ever
    uploaded), and its metadata document — used directly by the
    pdf.controller's DELETE endpoint, and by App.tsx's delete-history
    flow (via that same endpoint) so a removed salary history record
    never leaves an orphaned PDF behind, locally or on Drive. */
export async function deletePdfArchive(id) {
  const archive = await getPdfArchiveById(id);
  const absolutePath = resolveWithinStorageRoot(archive.pdfPath);
  await fs.unlink(absolutePath).catch(() => {
    // File already missing on disk — still proceed to remove the
    // metadata so it doesn't linger pointing at nothing.
  });
  if (archive.driveFileId) {
    // Best-effort, same reasoning as the upload side in storePdf():
    // a Drive failure here must not stop the local file/metadata from
    // being removed as requested.
    await storageService.deleteFile(archive.driveFileId).catch(err => {
      console.warn('[googleDrive] Delete failed — local cleanup still proceeding:', err.message);
    });
  }
  await PdfArchive.findByIdAndDelete(id);
  if (archive.salaryHistoryId) {
    await SalaryHistory.findByIdAndUpdate(archive.salaryHistoryId, { pdfArchiveId: null }).catch(() => {});
  }
  return archive;
}
