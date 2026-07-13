import { Router } from 'express';
import multer from 'multer';
import * as employeeController from '../controllers/employee.controller.js';
import { AppError } from '../utils/AppError.js';

/* Memory storage, same pattern as pdfStorage.routes.js/email.routes.js
   — the image bytes go straight to Google Drive (see
   storage/googleDriveProvider.js's uploadEmployeePhoto), never to
   disk and never embedded in a JSON body (Production Hotfix: that
   base64-in-JSON approach is what caused the 413s). 5MB is generous
   headroom for a profile photo — well below what would ever trouble
   Drive or this multer limit, unlike the old 100kb JSON ceiling a
   base64 photo blew past immediately. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isImage = /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype);
    if (isImage) return cb(null, true);
    cb(new AppError('Only JPEG, PNG, WEBP, or GIF images are allowed', 400));
  },
});

function handleUpload(req, res, next) {
  upload.single('photo')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof AppError) return next(err);
    if (err.code === 'LIMIT_FILE_SIZE') return next(new AppError('Image file is too large (max 5MB)', 400));
    next(new AppError(err.message || 'File upload failed', 400));
  });
}

const router = Router();

// /search must be registered before /:id — otherwise Express would
// match "search" as the :id param and this route would never be hit.
router.get('/search', employeeController.searchEmployees);

router.get('/', employeeController.getEmployees);
router.get('/:id', employeeController.getEmployee);
router.post('/', employeeController.createEmployee);
router.put('/:id', employeeController.updateEmployee);
router.delete('/:id', employeeController.deleteEmployee);

router.post('/:id/photo', handleUpload, employeeController.uploadPhoto);
router.delete('/:id/photo', employeeController.deletePhoto);

export default router;
