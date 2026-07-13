import React, { useMemo, useState } from 'react';
import { Employee, EmploymentType } from '../types';
import { deleteEmployee, ApiError } from '../api/employeeApi';
import { PageHeader } from '../components/ui/PageHeader';
import { TableToolbar, SearchInput } from '../components/ui/TableToolbar';
import { EmptyState } from '../components/ui/EmptyState';
import { EmployeeAvatar } from '../components/ui/EmployeeAvatar';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmployeeFormModal } from '../components/employees/EmployeeFormModal';
import { EmployeeViewModal } from '../components/employees/EmployeeViewModal';
import {
  Plus, Trash2, Pencil, Eye, Users, Building2, CalendarDays,
  ChevronLeft, ChevronRight, AlertTriangle, Loader2,
} from 'lucide-react';

interface Props {
  employees: Employee[];
  /** True only until the initial App.tsx fetch settles — distinguishes
      "still loading" from a genuine zero-employee directory. */
  loading?: boolean;
  onEmployeesChange: (employees: Employee[]) => void;
  title?: string;
  onEmployeeAdded?: (employee: Employee) => void;
  onEmployeeUpdated?: (employee: Employee) => void;
  onEmployeeDeleted?: (employee: Employee) => void;
}

const PAGE_SIZE = 12;

function emptyEmployee(): Employee {
  return {
    id: `emp-${Date.now()}`,
    employeeId: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    department: '',
    designation: '',
    employmentType: undefined,
    photoUrl: null,
    salaryStructureNote: '',
    pan: '',
    aadhaar: '',
    bankAccount: '',
    bankName: '',
    branch: '',
    ifsc: '',
    uan: '',
    manager: '',
    emergencyContact: '',
    doj: '',
    employmentEndDate: '',
    notes: '',
    status: 'Active',
  };
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * Dedicated Employee Directory page (Sprint 5.7) — replaces the old
 * EmployeeMaster modal as the primary way to browse/manage employees.
 * All create/update/delete calls go through the exact same
 * api/employeeApi.ts functions the old modal used (via
 * EmployeeFormModal, extracted unchanged); this page only owns
 * browsing (search/filter/pagination) and which modal is open.
 */
export function EmployeesPage({
  employees, loading = false, onEmployeesChange, title = 'Employees',
  onEmployeeAdded, onEmployeeUpdated, onEmployeeDeleted,
}: Props) {
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [page, setPage] = useState(1);

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingIsExisting, setEditingIsExisting] = useState(false);
  const [viewing, setViewing] = useState<Employee | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const departments = useMemo(
    () => Array.from(new Set(employees.map(e => e.department).filter(Boolean))).sort(),
    [employees]
  );
  const employmentTypes = useMemo(
    () => Array.from(new Set(employees.map(e => e.employmentType).filter((t): t is EmploymentType => !!t))),
    [employees]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter(e => {
      if (department && e.department !== department) return false;
      if (status && e.status !== status) return false;
      if (employmentType && e.employmentType !== employmentType) return false;
      if (!q) return true;
      return [e.name, e.employeeId, e.department, e.designation, e.email, e.phone]
        .some(v => (v || '').toLowerCase().includes(q));
    });
  }, [employees, search, department, status, employmentType]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetToFirstPage = () => setPage(1);

  const startAdd = () => { setEditingIsExisting(false); setEditingEmployee(emptyEmployee()); };
  const startEdit = (emp: Employee) => { setEditingIsExisting(true); setEditingEmployee({ ...emp }); setViewing(null); };

  const handleSaved = (saved: Employee, wasExisting: boolean) => {
    const next = wasExisting ? employees.map(e => (e.id === saved.id ? saved : e)) : [...employees, saved];
    onEmployeesChange(next);
    if (wasExisting) onEmployeeUpdated?.(saved); else onEmployeeAdded?.(saved);
    setEditingEmployee(null);
  };

  const handleDelete = async (emp: Employee) => {
    if (!window.confirm(`Delete ${emp.name || emp.employeeId}? This cannot be undone.`)) return;
    setDeletingId(emp.id);
    setToast('');
    try {
      await deleteEmployee(emp.id);
      onEmployeesChange(employees.filter(e => e.id !== emp.id));
      onEmployeeDeleted?.(emp);
      setViewing(null);
    } catch (err) {
      setToast(errorMessage(err, 'Unable to connect to server'));
      setTimeout(() => setToast(''), 5000);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={title}
        description={`${employees.length} employee${employees.length === 1 ? '' : 's'} in the directory`}
        actions={
          <button onClick={startAdd} className="btn btn-dark" style={{ fontSize: 12.5 }}>
            <Plus size={14} /> Add Employee
          </button>
        }
      />

      {toast && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
          padding: '10px 14px', background: 'var(--clr-danger-soft)', color: 'var(--clr-danger)',
          borderRadius: 8, fontSize: 12.5, fontWeight: 600,
        }}>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          {toast}
        </div>
      )}

      <TableToolbar>
        <SearchInput value={search} onChange={v => { setSearch(v); resetToFirstPage(); }} placeholder="Search by name, employee ID, email, or phone…" />
        <select value={department} onChange={e => { setDepartment(e.target.value); resetToFirstPage(); }} className="field" style={{ flex: '0 1 170px' }} aria-label="Filter by department">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={employmentType} onChange={e => { setEmploymentType(e.target.value); resetToFirstPage(); }} className="field" style={{ flex: '0 1 160px' }} aria-label="Filter by employment type">
          <option value="">All Types</option>
          {employmentTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); resetToFirstPage(); }} className="field" style={{ flex: '0 1 150px' }} aria-label="Filter by status">
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </TableToolbar>

      {loading ? (
        <div className="page-loading">
          <Loader2 size={16} />
          Loading employees…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={employees.length === 0 ? 'No employees yet' : 'No matches found'}
          description={employees.length === 0 ? 'Click "Add Employee" to create the first record.' : 'Try a different search or filter.'}
        />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(252px, 1fr))', gap: 14 }} className="stagger-children">
            {visible.map(emp => (
              <div
                key={emp.id}
                className="entity-card animate-fade-in-up"
                style={{ padding: '18px 18px 14px', display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer' }}
                onClick={() => setViewing(emp)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <EmployeeAvatar name={emp.name} photoUrl={emp.photoUrl} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--clr-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--clr-text-muted)', fontFamily: 'monospace' }}>{emp.employeeId}</div>
                  </div>
                  <StatusBadge label={emp.status} tone={emp.status === 'Active' ? 'success' : 'neutral'} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11.5, color: 'var(--clr-text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Building2 size={11} style={{ flexShrink: 0, color: 'var(--clr-text-subtle)' }} />
                    {[emp.designation, emp.department].filter(Boolean).join(' · ') || '—'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <CalendarDays size={11} style={{ flexShrink: 0, color: 'var(--clr-text-subtle)' }} />
                    {emp.doj ? `Joined ${new Date(emp.doj).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : '—'}
                  </div>
                </div>

                {emp.employmentType && (
                  <div><StatusBadge label={emp.employmentType} tone="info" /></div>
                )}

                <div
                  style={{ display: 'flex', gap: 2, marginTop: 'auto', borderTop: '1px solid var(--clr-border)', paddingTop: 9, justifyContent: 'flex-end' }}
                  onClick={e => e.stopPropagation()}
                >
                  <button onClick={() => setViewing(emp)} title="View Employee" className="btn-icon" style={{ border: 'none', cursor: 'pointer' }} disabled={deletingId === emp.id}>
                    <Eye size={13} />
                  </button>
                  <button onClick={() => startEdit(emp)} title="Edit" className="btn-icon" style={{ border: 'none', cursor: 'pointer' }} disabled={deletingId === emp.id}>
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(emp)}
                    title="Delete"
                    className="btn-icon"
                    style={{ border: 'none', cursor: deletingId === emp.id ? 'default' : 'pointer' }}
                    disabled={deletingId === emp.id}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--clr-danger)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--clr-text-muted)'; }}
                  >
                    {deletingId === emp.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 22 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn-icon"
                style={{ border: '1px solid var(--clr-border)', cursor: currentPage === 1 ? 'default' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1 }}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--clr-text-muted)' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn-icon"
                style={{ border: '1px solid var(--clr-border)', cursor: currentPage === totalPages ? 'default' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1 }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}

      {editingEmployee && (
        <EmployeeFormModal
          isOpen
          onClose={() => setEditingEmployee(null)}
          employee={editingEmployee}
          isExisting={editingIsExisting}
          onSaved={handleSaved}
        />
      )}

      {viewing && (
        <EmployeeViewModal
          employee={viewing}
          onClose={() => setViewing(null)}
          onEdit={startEdit}
        />
      )}
    </div>
  );
}
