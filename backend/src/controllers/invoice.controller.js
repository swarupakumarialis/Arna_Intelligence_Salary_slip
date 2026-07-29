import * as invoiceService from '../services/invoice.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Thin HTTP layer only — same division of responsibility as
 * salaryHistory.controller.js: parse the request, call the service,
 * shape the response. No queries or business logic here.
 */

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(query.limit, 10) || 50));
  return { page, limit };
}

function str(value) {
  return typeof value === 'string' ? value : undefined;
}

export const getInvoices = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const data = await invoiceService.getAllInvoices({
    page,
    limit,
    status: str(req.query.status),
    currency: str(req.query.currency),
    q: str(req.query.q),
    dateFrom: str(req.query.dateFrom),
    dateTo: str(req.query.dateTo),
    sort: str(req.query.sort),
  });
  res.status(200).json({ success: true, message: 'Invoices fetched successfully', data });
});

export const getInvoice = asyncHandler(async (req, res) => {
  const data = await invoiceService.getInvoiceById(req.params.id);
  res.status(200).json({ success: true, message: 'Invoice fetched successfully', data });
});

export const createInvoice = asyncHandler(async (req, res) => {
  const data = await invoiceService.createInvoice(req.body);
  res.status(201).json({ success: true, message: 'Invoice created successfully', data });
});

export const updateInvoice = asyncHandler(async (req, res) => {
  const data = await invoiceService.updateInvoice(req.params.id, req.body);
  res.status(200).json({ success: true, message: 'Invoice updated successfully', data });
});

export const deleteInvoice = asyncHandler(async (req, res) => {
  await invoiceService.deleteInvoice(req.params.id);
  res.status(200).json({ success: true, message: 'Invoice deleted successfully', data: null });
});
