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

/** status/employmentType are exact-match filters (both are enums on the
    model); department is a partial, case-insensitive match (free text
    on the model, e.g. "Tech" should match "Technology"); q is the same
    free-text substring search searchEmployees already does. Added for
    the AI Assistant (Sprint 8) — "How many active employees?", "Show
    active interns", "How many employees are in Tech?" all need this
    combination, which neither getAllEmployees nor searchEmployees
    supported before. Not AI-specific in shape, so any other future
    caller (e.g. an Employee Directory filter bar) can reuse it as-is. */
export async function queryEmployees({ status, employmentType, department, q, page = 1, limit = 200 } = {}) {
  const skip = (page - 1) * limit;
  const query = {};
  if (status) query.status = status;
  if (employmentType) query.employmentType = employmentType;
  if (department) query.department = { $regex: department, $options: 'i' };
  const term = (q || '').trim();
  if (term) {
    query.$or = [
      { fullName: { $regex: term, $options: 'i' } },
      { employeeId: { $regex: term, $options: 'i' } },
      { email: { $regex: term, $options: 'i' } },
    ];
  }
  const [items, total] = await Promise.all([
    Employee.find(query).sort({ fullName: 1 }).skip(skip).limit(limit),
    Employee.countDocuments(query),
  ]);
  return { items, ...paginationMeta({ total, page, limit }) };
}

/** "Who joined this month?" — dateOfJoining is stored as a free-text
    String (see the model comment), but the Employee Directory's own
    form only ever writes it via an <input type="date">, so in practice
    every real record is 'YYYY-MM-DD' — the same lexicographic-string
    convention invoice.service.js's buildQuery already relies on for
    invoiceDate. `yearMonth` is 'YYYY-MM'; matches only records whose
    dateOfJoining starts with it. */
export async function getEmployeesJoinedInMonth(yearMonth) {
  const query = { dateOfJoining: { $regex: `^${yearMonth}` } };
  const items = await Employee.find(query).sort({ dateOfJoining: 1 });
  return { items, total: items.length };
}

/** Active/Inactive/total headcount — added for the AI Assistant
    (Sprint 8)'s Payroll section ("Employee count") and general
    "How many employees" questions that don't filter by anything else. */
export async function getEmployeeStatusCounts() {
  const [active, inactive, total] = await Promise.all([
    Employee.countDocuments({ status: 'Active' }),
    Employee.countDocuments({ status: 'Inactive' }),
    Employee.countDocuments(),
  ]);
  return { active, inactive, total };
}

/** Distinct, non-empty department count — added for the AI Assistant
    (Sprint 8)'s Payroll section ("Department count"). */
export async function getDepartmentCount() {
  const departments = await Employee.distinct('department');
  return departments.filter((d) => d && d.trim()).length;
}

/** Most recently joined employees, newest first — "Recent employees?"
    (AI Assistant). dateOfJoining is a 'YYYY-MM-DD' string (see
    getEmployeesJoinedInMonth's comment above), so a plain string sort
    is correct. */
export async function getRecentEmployees(limit = 5) {
  const items = await Employee.find({ dateOfJoining: { $ne: '' } }).sort({ dateOfJoining: -1 }).limit(limit);
  return { items };
}

/** The single most recently joined employee overall — used to make a
    "no one joined this month" answer more useful ("The latest employee
    joined on <date>") rather than a dead end. */
export async function getMostRecentlyJoinedEmployee() {
  const items = await Employee.find({ dateOfJoining: { $ne: '' } }).sort({ dateOfJoining: -1 }).limit(1);
  return items[0] || null;
}

/** Count of employees with no phone number on file — one of the
    at-a-glance flags in the AI Assistant's "System Health" summary. */
export async function getMissingPhoneCount() {
  return Employee.countDocuments({ $or: [{ phone: { $exists: false } }, { phone: '' }] });
}
