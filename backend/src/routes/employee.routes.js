import { Router } from 'express';
import * as employeeController from '../controllers/employee.controller.js';

const router = Router();

// /search must be registered before /:id — otherwise Express would
// match "search" as the :id param and this route would never be hit.
router.get('/search', employeeController.searchEmployees);

router.get('/', employeeController.getEmployees);
router.get('/:id', employeeController.getEmployee);
router.post('/', employeeController.createEmployee);
router.put('/:id', employeeController.updateEmployee);
router.delete('/:id', employeeController.deleteEmployee);

export default router;
