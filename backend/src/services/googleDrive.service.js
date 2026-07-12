import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { google } from 'googleapis';

/**
 * Google Drive integration (Sprint 5.9) — a second, additive storage
 * provider for archived payslip PDFs, layered on top of
 * pdfStorage.service.js. It never replaces the local filesystem
 * archive: every function here is only ever called AFTER a PDF is
 * already safely saved locally, and every failure here is meant to be
 * caught by the caller and logged as a warning, never thrown back to
 * whatever triggered the export.
 *
 * Credentials are read exclusively from process.env at call time —
 * never hardcoded, never logged:
 *   GOOGLE_SERVICE_ACCOUNT_KEY — this deployment's actual value is a
 *     path (relative to the backend's working directory, e.g.
 *     "./credentials/<file>.json") to the service account's JSON key
 *     file on disk. Also accepts the key content directly — as a raw
 *     JSON string or base64-encoded JSON — so this keeps working if a
 *     future deployment sets the variable to the content instead of a
 *     path, without any code change.
 *   GOOGLE_DRIVE_FOLDER_ID — the root Drive folder. "Salary Slips"
 *     and the Year/Month tree are created *inside* this folder, never
 *     at the Drive root.
 */

let cachedDrive = null;
/** "<parentId>/<name>" -> folder id. Folders are never renamed or
    moved once created, so caching for the life of the process is safe
    and avoids re-searching Drive for the same Year/Month folder on
    every single payslip upload. */
const folderIdCache = new Map();

function parseServiceAccountKey() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');

  // Primary convention for this deployment: the variable holds a file
  // path, not the key content — resolved against process.cwd() (the
  // backend project root when started via `npm run dev`/`start`).
  const resolvedPath = path.resolve(process.cwd(), raw);
  if (fs.existsSync(resolvedPath)) {
    return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  }

  try {
    return JSON.parse(raw);
  } catch {
    // Fall back to base64 — some deployments encode the key to avoid
    // escaping the private key's embedded newlines inside a .env file.
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  }
}

function getDrive() {
  if (cachedDrive) return cachedDrive;
  const credentials = parseServiceAccountKey();
  const auth = new google.auth.GoogleAuth({
    credentials,
    // drive.file — least-privilege scope: only grants access to
    // files/folders this service account itself creates, never the
    // rest of the Drive.
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  cachedDrive = google.drive({ version: 'v3', auth });
  return cachedDrive;
}

/** Finds a folder named `name` directly under `parentId`, creating it
    only if it doesn't already exist — never creates a duplicate. */
async function findOrCreateFolder(name, parentId) {
  const cacheKey = `${parentId}/${name}`;
  if (folderIdCache.has(cacheKey)) return folderIdCache.get(cacheKey);

  const drive = getDrive();
  const escapedName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const query = `name='${escapedName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const existing = await drive.files.list({ q: query, fields: 'files(id, name)', spaces: 'drive' });

  let folderId;
  if (existing.data.files && existing.data.files.length > 0) {
    folderId = existing.data.files[0].id;
  } else {
    const created = await drive.files.create({
      requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
      fields: 'id',
    });
    folderId = created.data.id;
  }

  folderIdCache.set(cacheKey, folderId);
  return folderId;
}

/** Resolves the Salary Slips/<Year>/<Month> folder chain inside the
    configured root folder, creating any level that doesn't exist yet
    and reusing every level that does. */
async function resolveMonthFolder(year, month) {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootFolderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID is not set');

  const salarySlipsId = await findOrCreateFolder('Salary Slips', rootFolderId);
  const yearId = await findOrCreateFolder(String(year), salarySlipsId);
  const monthId = await findOrCreateFolder(String(month), yearId);
  return monthId;
}

/**
 * Uploads the exact same PDF bytes already saved locally to
 * Salary Slips/<year>/<month>/<fileName> in Drive (reusing existing
 * folders — see resolveMonthFolder). Returns the new file's id and a
 * view link for PdfArchive to store. Throws on any failure — the
 * caller (pdfStorage.service.js) is responsible for catching this and
 * treating it as non-fatal to the export.
 */
export async function uploadPdfToDrive({ buffer, fileName, year, month }) {
  const drive = getDrive();
  const folderId = await resolveMonthFolder(year, month);

  const created = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: 'application/pdf', body: Readable.from(buffer) },
    fields: 'id, webViewLink',
  });

  return { driveFileId: created.data.id, shareUrl: created.data.webViewLink || null };
}

/** Best-effort delete, used when a PdfArchive record is removed so
    the local file, the Drive file, and the metadata document stay in
    sync. Never throws — the caller treats Drive as optional. */
export async function deletePdfFromDrive(driveFileId) {
  if (!driveFileId) return;
  const drive = getDrive();
  await drive.files.delete({ fileId: driveFileId });
}
