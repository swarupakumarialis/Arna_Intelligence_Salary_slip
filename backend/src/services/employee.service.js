import mongoose from 'mongoose';
import Employee from '../models/Employee.js';
import { AppError } from '../utils/AppError.js';

/** Drops a blank email entirely rather than storing "" — required for
    the schema's sparse unique index to actually treat "no email" as
    "no email" instead of colliding with every other blank email.
    Also strips photoDataUri (Production Hotfix): that field is
    legacy-read-only now — a base64 photo embedded in this plain JSON
    payload is exactly what produced 413 "request entity too large"
    errors, since express.json()'s default 100kb limit blows well
    past for any real image. Photos are set exclusively via the
    dedicated multipart upload endpoint (employee.controller.js's
    uploadPhoto → photoUrl/photoFileId), never through this payload —
    stripping it here means even a stale frontend build or a direct
    API call can't reintroduce the bug. */
function sanitizeInput(data = {}) {
  const clean = { ...data };
  if (!clean.email) delete clean.email;
  // Block (re)setting a base64 blob — but keep allowing explicit
  // clearing (photoDataUri: null), which employee.controller.js's
  // uploadPhoto/deletePhoto rely on to retire a legacy photo once
  // it's replaced or removed.
  if (clean.photoDataUri) delete clean.photoDataUri;
  return clean;
}

function isDuplicateKeyError(err) {
  return err && err.code === 11000;
}

function duplicateFieldMessage(err) {
  const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
  const value = err.keyValue ? err.keyValue[field] : undefined;
  return `An employee with this ${field} already exists${value ? `: "${value}"` : ''}.`;
}

function assertValidId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid employee id', 400);
  }
}

function paginationMeta({ total, page, limit }) {
  return { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getAllEmployees({ page = 1, limit = 50 } = {}) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Employee.find().sort({ createdAt: 1 }).skip(skip).limit(limit),
    Employee.countDocuments(),
  ]);
  return { items, ...paginationMeta({ total, page, limit }) };
}

export async function getEmployeeById(id) {
  assertValidId(id);
  const employee = await Employee.findById(id);
  if (!employee) throw new AppError('Employee not found', 404);
  return employee;
}

export async function createEmployee(data) {
  try {
    return await Employee.create(sanitizeInput(data));
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new AppError(duplicateFieldMessage(err), 409);
    if (err.name === 'ValidationError') throw new AppError(err.message, 400);
    throw err;
  }
}

export async function updateEmployee(id, data) {
  assertValidId(id);
  try {
    const employee = await Employee.findByIdAndUpdate(id, sanitizeInput(data), {
      new: true,
      runValidators: true,
      context: 'query',
    });
    if (!employee) throw new AppError('Employee not found', 404);
    return employee;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (isDuplicateKeyError(err)) throw new AppError(duplicateFieldMessage(err), 409);
    if (err.name === 'ValidationError') throw new AppError(err.message, 400);
    throw err;
  }
}

export async function deleteEmployee(id) {
  assertValidId(id);
  const employee = await Employee.findByIdAndDelete(id);
  if (!employee) throw new AppError('Employee not found', 404);
  return employee;
}

export async function searchEmployees({ q = '', page = 1, limit = 50 } = {}) {
  const skip = (page - 1) * limit;
  const term = q.trim();
  const query = term
    ? {
        $or: [
          { fullName: { $regex: term, $options: 'i' } },
          { employeeId: { $regex: term, $options: 'i' } },
          { email: { $regex: term, $options: 'i' } },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    Employee.find(query).sort({ createdAt: 1 }).skip(skip).limit(limit),
    Employee.countDocuments(query),
  ]);
  return { items, ...paginationMeta({ total, page, limit }) };
}
