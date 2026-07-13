import { Router } from 'express';
import multer from 'multer';
import * as emailController from '../controllers/email.controller.js';
import * as networkDiagnosticController from '../controllers/networkDiagnostic.controller.js';
import { AppError } from '../utils/AppError.js';

/* Memory storage, same reasoning as pdfStorage.routes.js — the
   attachment bytes go straight to Nodemailer (see email.service.js),
   never touching disk (Sprint 6.2B). */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — matches pdfStorage.routes.js's own limit
  fileFilter: (req, file, cb) => {
    const isPdfMime = file.mimetype === 'application/pdf';
    const isPdfExt = /\.pdf$/i.test(file.originalname || '');
    if (isPdfMime && isPdfExt) return cb(null, true);
    cb(new AppError('Only PDF files are allowed', 400, 'attachment'));
  },
});

function handleUpload(req, res, next) {
  upload.single('pdf')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof AppError) return next(err);
    if (err.code === 'LIMIT_FILE_SIZE') return next(new AppError('PDF file is too large (max 10MB)', 400, 'attachment'));
    next(new AppError(err.message || 'File upload failed', 400, 'attachment'));
  });
}

const router = Router();

router.post('/send', handleUpload, emailController.sendEmail);

// TEMPORARY (Sprint 6.2F) — remove this route once the Render SMTP
// ETIMEDOUT investigation is closed. See
// controllers/networkDiagnostic.controller.js for why this exists.
router.get('/network-test', networkDiagnosticController.networkTest);

export default router;
