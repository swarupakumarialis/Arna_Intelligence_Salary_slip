import { Router } from 'express';
import * as salaryHistoryController from '../controllers/salaryHistory.controller.js';

const router = Router();

router.get('/', salaryHistoryController.getSalaryHistory);
router.get('/:id', salaryHistoryController.getSalaryHistoryRecord);
router.post('/', salaryHistoryController.createSalaryHistory);
router.put('/:id', salaryHistoryController.updateSalaryHistory);
router.delete('/:id', salaryHistoryController.deleteSalaryHistory);

export default router;
