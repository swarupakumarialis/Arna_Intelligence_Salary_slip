import { Router } from 'express';
import multer from 'multer';
import * as invoiceController from '../controllers/invoice.controller.js';
import { AppError } from '../utils/AppError.js';

/* Memory storage, same reasoning as pdfStorage.routes.js/email.routes.js
   — the PDF bytes go straight to Google Drive upload or the Resend
   attachment, never touching disk. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — matches pdfStorage.routes.js's own limit
  fileFilter: (req, file, cb) => {
    const isPdfMime = file.mimetype === 'application/pdf';
    const isPdfExt = /\.pdf$/i.test(file.originalname || '');
    if (isPdfMime && isPdfExt) return cb(null, true);
    cb(new AppError('Only PDF files are allowed', 400));
  },
});

function handleUpload(req, res, next) {
  upload.single('pdf')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof AppError) return next(err);
    if (err.code === 'LIMIT_FILE_SIZE') return next(new AppError('PDF file is too large (max 10MB)', 400));
    next(new AppError(err.message || 'File upload failed', 400));
  });
}

const router = Router();

router.get('/', invoiceController.getInvoices);
router.get('/:id', invoiceController.getInvoice);
router.post('/', invoiceController.createInvoice);
router.put('/:id', invoiceController.updateInvoice);
router.delete('/:id', invoiceController.deleteInvoice);

// Sprint 5 — PDF/Drive/Email actions.
router.post('/:id/pdf', handleUpload, invoiceController.uploadInvoicePdf);
router.post('/:id/email', handleUpload, invoiceController.emailInvoice);

export default router;
