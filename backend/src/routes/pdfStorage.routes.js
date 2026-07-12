import { Router } from 'express';
import multer from 'multer';
import * as pdfStorageController from '../controllers/pdfStorage.controller.js';
import { AppError } from '../utils/AppError.js';

/* Memory storage, not diskStorage — the raw bytes are handed to
   services/pdfStorage.service.js, which owns the actual folder/naming
   convention (generated-pdfs/<year>/<month>/EmployeeID_Month_Year.pdf,
   never-overwrite). Letting multer write directly to disk would mean
   duplicating that logic in a multer-specific `destination`/`filename`
   callback instead of one place. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — matches pdfStorage.service.js's own check
  fileFilter: (req, file, cb) => {
    const isPdfMime = file.mimetype === 'application/pdf';
    const isPdfExt = /\.pdf$/i.test(file.originalname || '');
    if (isPdfMime && isPdfExt) return cb(null, true);
    cb(new AppError('Only PDF files are allowed', 400));
  },
});

/** Wraps multer so its errors (wrong file type, too large) come out as
    AppError with a proper status code, matching every other error in
    this API, instead of multer's own error shapes. */
function handleUpload(req, res, next) {
  upload.single('pdf')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof AppError) return next(err);
    if (err.code === 'LIMIT_FILE_SIZE') return next(new AppError('PDF file is too large (max 10MB)', 400));
    next(new AppError(err.message || 'File upload failed', 400));
  });
}

const router = Router();

// /download/:id must be registered before /:id — same reasoning as
// Employee's /search: otherwise Express would treat "download" as the
// :id param.
router.get('/download/:id', pdfStorageController.downloadPdf);

router.post('/upload', handleUpload, pdfStorageController.uploadPdf);
router.get('/:id', pdfStorageController.getPdfMetadata);
router.delete('/:id', pdfStorageController.deletePdf);

export default router;
