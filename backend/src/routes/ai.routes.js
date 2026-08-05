import { Router } from 'express';
import * as aiController from '../controllers/ai.controller.js';

const router = Router();

// POST, not GET — the question text goes in the body (same reasoning
// as any other free-text search endpoint in this backend), not a query
// string. Read-only in effect (see ai.service.js), but the request
// itself is a POST because it carries a body.
router.post('/ask', aiController.ask);

export default router;
