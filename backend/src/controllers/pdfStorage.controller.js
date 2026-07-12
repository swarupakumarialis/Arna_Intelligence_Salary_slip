import * as pdfStorageService from '../services/pdfStorage.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

/**
 * Thin HTTP layer only, same division of responsibility as
 * employee.controller.js / salaryHistory.controller.js — validation,
 * file-system work, and MongoDB writes all live in
 * services/pdfStorage.service.js.
 */

export const uploadPdf = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('No PDF file was uploaded', 400);

  const { employeeId, employeeName, month, year, salaryHistoryId, generatedBy } = req.body;
  const data = await pdfStorageService.storePdf({
    buffer: req.file.buffer,
    employeeId,
    employeeName,
    month,
    year,
    salaryHistoryId,
    generatedBy,
  });

  res.status(201).json({ success: true, message: 'PDF archived successfully', data });
});

export const getPdfMetadata = asyncHandler(async (req, res) => {
  const data = await pdfStorageService.getPdfArchiveById(req.params.id);
  res.status(200).json({ success: true, message: 'PDF metadata fetched successfully', data });
});

export const downloadPdf = asyncHandler(async (req, res) => {
  const { absolutePath, fileName } = await pdfStorageService.getPdfFilePath(req.params.id);
  res.download(absolutePath, fileName);
});

export const deletePdf = asyncHandler(async (req, res) => {
  await pdfStorageService.deletePdfArchive(req.params.id);
  res.status(200).json({ success: true, message: 'PDF deleted successfully', data: null });
});
