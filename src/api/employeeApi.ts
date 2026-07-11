import { Employee } from '../types';

/**
 * Centralised Employee Directory API client — every network call the
 * frontend makes for employee data goes through this file. Nothing
 * outside src/api/ should call `fetch` for employee data directly.
 *
 * The backend (backend/src/models/Employee.js) uses different field
 * names than the frontend's existing Employee type (fullName vs name,
 * dateOfJoining vs doj, a nested bankDetails object vs flat
 * bankAccount/bankName/branch/ifsc, etc.) — fromApiRecord/toApiPayload
 * below translate between the two, so every other file that already
 * works with Employee (EmployeeMaster.tsx, SalarySlipForm.tsx,
 * dashboard panels, …) needs zero changes.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:5001/api';

/** Wire shape returned by the backend — mirrors backend/src/models/Employee.js. */
interface EmployeeApiRecord {
  _id: string;
  employeeId: string;
  fullName: string;
  email?: string;
  phone?: string;
  address?: string;
  designation?: string;
  department?: string;
  employmentType?: string | null;
  dateOfJoining?: string;
  status: 'Active' | 'Inactive';
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    ifsc?: string;
    branch?: string;
  };
  PAN?: string;
  Aadhaar?: string;
  salaryDetails?: string;
  photoDataUri?: string | null;
  uan?: string;
  manager?: string;
  emergencyContact?: string;
  employmentEndDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedEmployees {
  items: Employee[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

interface PaginationParams {
  page?: number;
  limit?: number;
}

/** Thrown by every function in this file on any failure — network
    error, non-2xx response, or an envelope with success:false. UI
    code (EmployeeMaster.tsx) catches this to show the right message:
    a connection failure gets "Unable to connect to server", anything
    else shows `.message` inline. */
export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function fromApiRecord(record: EmployeeApiRecord): Employee {
  return {
    id: record._id,
    employeeId: record.employeeId,
    name: record.fullName,
    email: record.email || '',
    phone: record.phone || '',
    address: record.address || '',
    department: record.department || '',
    designation: record.designation || '',
    employmentType: (record.employmentType || undefined) as Employee['employmentType'],
    photoDataUri: record.photoDataUri ?? null,
    salaryStructureNote: record.salaryDetails || '',
    pan: record.PAN || '',
    aadhaar: record.Aadhaar || '',
    bankAccount: record.bankDetails?.accountNumber || '',
    bankName: record.bankDetails?.bankName || '',
    branch: record.bankDetails?.branch || '',
    ifsc: record.bankDetails?.ifsc || '',
    uan: record.uan || '',
    manager: record.manager || '',
    emergencyContact: record.emergencyContact || '',
    doj: record.dateOfJoining || '',
    employmentEndDate: record.employmentEndDate || '',
    notes: record.notes || '',
    status: record.status,
  };
}

function toApiPayload(employee: Employee): Record<string, unknown> {
  return {
    employeeId: employee.employeeId,
    fullName: employee.name,
    email: employee.email || undefined,
    phone: employee.phone || '',
    address: employee.address || '',
    department: employee.department || '',
    designation: employee.designation || '',
    employmentType: employee.employmentType || null,
    dateOfJoining: employee.doj || '',
    status: employee.status,
    bankDetails: {
      bankName: employee.bankName || '',
      accountNumber: employee.bankAccount || '',
      ifsc: employee.ifsc || '',
      branch: employee.branch || '',
    },
    PAN: employee.pan || '',
    Aadhaar: employee.aadhaar || '',
    salaryDetails: employee.salaryStructureNote || '',
    photoDataUri: employee.photoDataUri ?? null,
    uan: employee.uan || '',
    manager: employee.manager || '',
    emergencyContact: employee.emergencyContact || '',
    employmentEndDate: employee.employmentEndDate || '',
    notes: employee.notes || '',
  };
}

function toPaginatedEmployees(data: { items: EmployeeApiRecord[]; total: number; page: number; limit: number; totalPages: number }): PaginatedEmployees {
  return { ...data, items: data.items.map(fromApiRecord) };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    // Network-level failure — server down, wrong URL, CORS block, offline, etc.
    throw new ApiError('Unable to connect to server');
  }

  let body: ApiEnvelope<T> | null = null;
  try {
    body = await res.json();
  } catch {
    /* Non-JSON response — fall through, handled by the !res.ok check below. */
  }

  if (!res.ok || !body?.success) {
    throw new ApiError(body?.message || `Request failed (${res.status})`, res.status);
  }
  return body.data;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export async function getEmployees(params: PaginationParams = {}): Promise<PaginatedEmployees> {
  const data = await request<{ items: EmployeeApiRecord[]; total: number; page: number; limit: number; totalPages: number }>(
    `/employees${buildQuery({ page: params.page, limit: params.limit })}`
  );
  return toPaginatedEmployees(data);
}

export async function getEmployee(id: string): Promise<Employee> {
  const record = await request<EmployeeApiRecord>(`/employees/${id}`);
  return fromApiRecord(record);
}

export async function createEmployee(employee: Employee): Promise<Employee> {
  const record = await request<EmployeeApiRecord>('/employees', {
    method: 'POST',
    body: JSON.stringify(toApiPayload(employee)),
  });
  return fromApiRecord(record);
}

export async function updateEmployee(id: string, employee: Employee): Promise<Employee> {
  const record = await request<EmployeeApiRecord>(`/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(toApiPayload(employee)),
  });
  return fromApiRecord(record);
}

export async function deleteEmployee(id: string): Promise<void> {
  await request<null>(`/employees/${id}`, { method: 'DELETE' });
}

export async function searchEmployees(query: string, params: PaginationParams = {}): Promise<PaginatedEmployees> {
  const data = await request<{ items: EmployeeApiRecord[]; total: number; page: number; limit: number; totalPages: number }>(
    `/employees/search${buildQuery({ q: query, page: params.page, limit: params.limit })}`
  );
  return toPaginatedEmployees(data);
}
