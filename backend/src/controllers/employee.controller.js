import * as employeeService from '../services/employee.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Thin HTTP layer only — parses/validates request shape, calls the
 * service, and shapes the response. No business logic lives here
 * (duplicate checks, error translation, queries all live in
 * services/employee.service.js).
 */

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50));
  return { page, limit };
}

export const getEmployees = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const data = await employeeService.getAllEmployees({ page, limit });
  res.status(200).json({ success: true, message: 'Employees fetched successfully', data });
});

export const getEmployee = asyncHandler(async (req, res) => {
  const data = await employeeService.getEmployeeById(req.params.id);
  res.status(200).json({ success: true, message: 'Employee fetched successfully', data });
});

export const createEmployee = asyncHandler(async (req, res) => {
  const data = await employeeService.createEmployee(req.body);
  res.status(201).json({ success: true, message: 'Employee created successfully', data });
});

export const updateEmployee = asyncHandler(async (req, res) => {
  const data = await employeeService.updateEmployee(req.params.id, req.body);
  res.status(200).json({ success: true, message: 'Employee updated successfully', data });
});

export const deleteEmployee = asyncHandler(async (req, res) => {
  await employeeService.deleteEmployee(req.params.id);
  res.status(200).json({ success: true, message: 'Employee deleted successfully', data: null });
});

export const searchEmployees = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const data = await employeeService.searchEmployees({ q, page, limit });
  res.status(200).json({ success: true, message: 'Search results fetched successfully', data });
});
