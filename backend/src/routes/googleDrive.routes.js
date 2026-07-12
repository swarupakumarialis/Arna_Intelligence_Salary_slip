import { Router } from 'express';
import * as googleDriveController from '../controllers/googleDrive.controller.js';

const router = Router();

router.get('/auth-url', googleDriveController.getAuthUrl);
router.get('/callback', googleDriveController.oauthCallback);
router.get('/status', googleDriveController.getStatus);
router.post('/disconnect', googleDriveController.disconnect);
router.post('/test', googleDriveController.testConnection);

export default router;
