import * as emailService from '../services/email.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Thin HTTP layer only, same division of responsibility as
 * pdfStorage.controller.js — validation, SMTP, and MongoDB writes all
 * live in services/email.service.js.
 */
export const sendEmail = asyncHandler(async (req, res) => {
  const data = await emailService.sendSalaryEmail(req.body);
  res.status(200).json({ success: true, message: 'Email sent successfully', data });
});
