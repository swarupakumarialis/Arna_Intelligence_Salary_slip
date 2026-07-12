import mongoose from 'mongoose';
import SalaryHistory from '../models/SalaryHistory.js';
import { AppError } from '../utils/AppError.js';

function assertValidId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid salary history id', 400);
  }
}

function paginationMeta({ total, page, limit }) {
  return { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** Month/year/employee are exact-match filters (they're always chosen
    from a dropdown of real values in the UI); `q` is a free-text
    substring match across the same fields SalaryHistoryPage.tsx's
    client-side search already checks. */
function buildQuery({ month, year, employeeId, q }) {
  const query = {};
  if (month) query.month = month;
  if (year) query.year = year;
  if (employeeId) query.employeeId = employeeId;
  const term = (q || '').trim();
  if (term) {
    query.$or = [
      { employeeName: { $regex: term, $options: 'i' } },
      { employeeId: { $regex: term, $options: 'i' } },
      { department: { $regex: term, $options: 'i' } },
    ];
  }
  return query;
}

export async function getAllSalaryHistory({ page = 1, limit = 50, month, year, employeeId, q, sort = 'newest' } = {}) {
  const skip = (page - 1) * limit;
  const query = buildQuery({ month, year, employeeId, q });
  const sortSpec = sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };
  const [items, total] = await Promise.all([
    SalaryHistory.find(query).sort(sortSpec).skip(skip).limit(limit),
    SalaryHistory.countDocuments(query),
  ]);
  return { items, ...paginationMeta({ total, page, limit }) };
}

export async function getSalaryHistoryById(id) {
  assertValidId(id);
  const record = await SalaryHistory.findById(id);
  if (!record) throw new AppError('Salary history record not found', 404);
  return record;
}

export async function createSalaryHistory(data) {
  try {
    return await SalaryHistory.create(data);
  } catch (err) {
    if (err.name === 'ValidationError') throw new AppError(err.message, 400);
    throw err;
  }
}

export async function updateSalaryHistory(id, data) {
  assertValidId(id);
  try {
    const record = await SalaryHistory.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
      context: 'query',
    });
    if (!record) throw new AppError('Salary history record not found', 404);
    return record;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err.name === 'ValidationError') throw new AppError(err.message, 400);
    throw err;
  }
}

export async function deleteSalaryHistory(id) {
  assertValidId(id);
  const record = await SalaryHistory.findByIdAndDelete(id);
  if (!record) throw new AppError('Salary history record not found', 404);
  return record;
}
