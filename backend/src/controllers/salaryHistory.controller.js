import * as salaryHistoryService from '../services/salaryHistory.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Thin HTTP layer only — same division of responsibility as
 * employee.controller.js: parse the request, call the service, shape
 * the response. No queries or business logic here.
 */

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(query.limit, 10) || 50));
  return { page, limit };
}

function str(value) {
  return typeof value === 'string' ? value : undefined;
}

export const getSalaryHistory = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const data = await salaryHistoryService.getAllSalaryHistory({
    page,
    limit,
    month: str(req.query.month),
    year: str(req.query.year),
    employeeId: str(req.query.employeeId),
    q: str(req.query.q),
    sort: str(req.query.sort),
  });
  res.status(200).json({ success: true, message: 'Salary history fetched successfully', data });
});

export const getSalaryHistoryRecord = asyncHandler(async (req, res) => {
  const data = await salaryHistoryService.getSalaryHistoryById(req.params.id);
  res.status(200).json({ success: true, message: 'Salary history record fetched successfully', data });
});

export const createSalaryHistory = asyncHandler(async (req, res) => {
  const data = await salaryHistoryService.createSalaryHistory(req.body);
  res.status(201).json({ success: true, message: 'Salary history record created successfully', data });
});

export const updateSalaryHistory = asyncHandler(async (req, res) => {
  const data = await salaryHistoryService.updateSalaryHistory(req.params.id, req.body);
  res.status(200).json({ success: true, message: 'Salary history record updated successfully', data });
});

export const deleteSalaryHistory = asyncHandler(async (req, res) => {
  await salaryHistoryService.deleteSalaryHistory(req.params.id);
  res.status(200).json({ success: true, message: 'Salary history record deleted successfully', data: null });
});
