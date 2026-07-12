import mongoose from 'mongoose';

/**
 * Metadata for a salary slip PDF archived on the server — never the
 * PDF binary itself (that lives on disk under backend/generated-pdfs/,
 * see services/pdfStorage.service.js). One document per stored file.
 *
 * `provider`/`driveFileId`/`shareUrl` were added ahead of time so
 * Google Drive (Sprint 5.9) could plug in as a second storage
 * provider without a schema change: a record now moves from
 * `provider: 'local'` (driveFileId/shareUrl/uploadedAt null) to
 * `provider: 'google-drive'` with those fields populated once the
 * same PDF has also been uploaded to Drive. The local file this
 * record's pdfPath points at is never removed or replaced by that
 * upload — Drive is an additional copy, not a migration — and
 * everything that already reads a PdfArchive record (the download
 * endpoint, Salary History's pdfArchiveId reference) keeps working
 * unchanged regardless of provider.
 */
const pdfArchiveSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: [true, 'Employee ID is required'], trim: true },
    employeeName: { type: String, required: [true, 'Employee name is required'], trim: true },
    month: { type: String, required: [true, 'Month is required'], trim: true },
    year: { type: String, required: [true, 'Year is required'], trim: true },
    /** The SalaryHistory record this PDF was generated for, if any. */
    salaryHistoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryHistory', default: null },
    /** File name on disk, e.g. "ARNA_CONT001_July_2026.pdf". */
    pdfFileName: { type: String, required: true, trim: true },
    /** Path relative to backend/generated-pdfs/, e.g. "2026/July/ARNA_CONT001_July_2026.pdf". */
    pdfPath: { type: String, required: true, trim: true },
    fileSize: { type: Number, default: 0 },
    generatedBy: { type: String, trim: true, default: 'HR Admin' },
    provider: { type: String, enum: ['local', 'google-drive'], default: 'local' },
    driveFileId: { type: String, default: null },
    shareUrl: { type: String, default: null },
    /** Sprint 5.9 — set the moment the Drive upload for this record
        succeeds; stays null for records Drive was never reached for
        (upload failed, or Drive wasn't configured at export time). */
    uploadedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('PdfArchive', pdfArchiveSchema);
