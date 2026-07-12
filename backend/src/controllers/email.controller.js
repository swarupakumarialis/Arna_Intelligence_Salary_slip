import * as emailService from '../services/email.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

/**
 * Thin HTTP layer only, same division of responsibility as
 * pdfStorage.controller.js — validation, SMTP, and MongoDB writes all
 * live in services/email.service.js. The request is now multipart
 * (Sprint 6.2B, see routes/email.routes.js's multer wiring) since the
 * caller sends the actual PDF bytes to attach, not just a reference
 * to a file already on disk.
 */
export const sendEmail = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('No PDF attachment was uploaded', 400, 'attachment');

  const data = await emailService.sendSalaryEmail({
    ...req.body,
    buffer: req.file.buffer,
  });
  res.status(200).json({ success: true, message: 'Email sent successfully', data });
});
