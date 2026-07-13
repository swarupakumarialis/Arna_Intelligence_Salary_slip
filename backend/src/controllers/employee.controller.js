import * as employeeService from '../services/employee.service.js';
import * as storageService from '../services/storage/storageService.js';
import { generateThumbnailDataUri } from '../services/thumbnail.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

/**
 * Thin HTTP layer only — parses/validates request shape, calls the
 * service, and shapes the response. No business logic lives here
 * (duplicate checks, error translation, queries all live in
 * services/employee.service.js).
 */

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50));
  return { page, limit };
}

export const getEmployees = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const data = await employeeService.getAllEmployees({ page, limit });
  res.status(200).json({ success: true, message: 'Employees fetched successfully', data });
});

export const getEmployee = asyncHandler(async (req, res) => {
  const data = await employeeService.getEmployeeById(req.params.id);
  res.status(200).json({ success: true, message: 'Employee fetched successfully', data });
});

export const createEmployee = asyncHandler(async (req, res) => {
  const data = await employeeService.createEmployee(req.body);
  res.status(201).json({ success: true, message: 'Employee created successfully', data });
});

export const updateEmployee = asyncHandler(async (req, res) => {
  const data = await employeeService.updateEmployee(req.params.id, req.body);
  res.status(200).json({ success: true, message: 'Employee updated successfully', data });
});

export const deleteEmployee = asyncHandler(async (req, res) => {
  await employeeService.deleteEmployee(req.params.id);
  res.status(200).json({ success: true, message: 'Employee deleted successfully', data: null });
});

/**
 * Employee profile picture upload (Production Hotfix; architecture
 * finalized Sprint 6.2D). Multipart (see routes/employee.routes.js's
 * multer wiring) — the raw image bytes go to Google Drive as the
 * permanent original archive (photoFileId/photoUrl), exactly as
 * before, using storage/googleDriveProvider.js's uploadEmployeePhoto
 * and its own separate "Employee Photos" folder (salary-slip Drive
 * logic untouched).
 *
 * Sprint 6.2D: rendering a Drive URL directly in <img> proved
 * unreliable across three attempts (webViewLink, then two different
 * hand-built/officially-sourced direct-content URLs — redirects,
 * permission edge cases, browser differences). The UI now never
 * touches Drive for display at all: a small compressed thumbnail
 * (~150x150 JPEG, generated from the exact same buffer already in
 * memory for the Drive upload — no extra download) is stored directly
 * in Mongo as photoDataUri and is the only thing any component
 * renders. Thumbnail generation is best-effort: if it fails for some
 * reason, the Drive upload (the real archive) has still succeeded,
 * so that failure doesn't roll back the upload — it just means this
 * employee falls back to initials until a future upload succeeds.
 */
export const uploadPhoto = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('No image file was uploaded', 400);

  const employee = await employeeService.getEmployeeById(req.params.id);
  const { fileId, url } = await storageService.uploadEmployeePhoto({
    buffer: req.file.buffer,
    employeeId: employee.employeeId,
    mimeType: req.file.mimetype,
  });

  let photoDataUri = null;
  try {
    photoDataUri = await generateThumbnailDataUri(req.file.buffer);
  } catch (err) {
    console.warn('[employeePhoto] Thumbnail generation failed — original is still archived in Drive:', err.message);
  }

  const previousPhotoFileId = employee.photoFileId;
  const updated = await employeeService.updateEmployee(req.params.id, {
    photoUrl: url,
    photoFileId: fileId,
    photoDataUri,
  });

  // Best-effort: the new photo is already saved and linked above: an
  // old-file cleanup failure must never turn a successful upload into
  // a reported failure.
  if (previousPhotoFileId) {
    storageService.deleteFile(previousPhotoFileId).catch((err) => {
      console.warn('[employeePhoto] Failed to delete previous photo:', err.message);
    });
  }

  res.status(200).json({ success: true, message: 'Photo uploaded successfully', data: updated });
});

export const deletePhoto = asyncHandler(async (req, res) => {
  const employee = await employeeService.getEmployeeById(req.params.id);
  if (employee.photoFileId) {
    await storageService.deleteFile(employee.photoFileId).catch((err) => {
      console.warn('[employeePhoto] Failed to delete photo from Drive:', err.message);
    });
  }
  const updated = await employeeService.updateEmployee(req.params.id, {
    photoUrl: null,
    photoFileId: null,
    photoDataUri: null,
  });
  res.status(200).json({ success: true, message: 'Photo removed successfully', data: updated });
});

export const searchEmployees = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const data = await employeeService.searchEmployees({ q, page, limit });
  res.status(200).json({ success: true, message: 'Search results fetched successfully', data });
});
