import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Employee, EmploymentType } from '../types';
import { createEmployee, updateEmployee, deleteEmployee, ApiError } from '../api/employeeApi';
import { Plus, Trash2, Pencil, Eye, X, Search, Users, ArrowLeft, Upload, User, Mail, Phone, Building2, Loader2, AlertTriangle } from 'lucide-react';
import { EmployeeAvatar } from './ui/EmployeeAvatar';
import { StatusBadge } from './ui/StatusBadge';
import { EmptyState } from './ui/EmptyState';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** The one shared Employee Directory list, owned by App.tsx (fetched
      once from GET /api/employees) and passed down as a plain prop —
      this component never fetches its own copy. Every other screen
      that shows employee data (Salary Generator, Dashboard, …) reads
      the exact same array. */
  employees: Employee[];
  /** Called with the full, up-to-date list after every add/edit/delete —
      this is how App.tsx's shared state picks up the change immediately,
      no refetch needed. */
  onEmployeesChange: (employees: Employee[]) => void;
  /** Display name for this directory — defaults to a generic label so
      the component works out of the box for any company; App.tsx sets
      this to the current tenant's name (e.g. "ARNA Team Directory"). */
  title?: string;
  /** Fired once, right after a brand-new employee is saved (not on edits). */
  onEmployeeAdded?: (employee: Employee) => void;
  /** Fired once, right after an existing employee's record is saved. */
  onEmployeeUpdated?: (employee: Employee) => void;
  /** Fired once, right after an employee record is removed. */
  onEmployeeDeleted?: (employee: Employee) => void;
}

const EMPLOYMENT_TYPES: EmploymentType[] = ['Full-time', 'Part-time', 'Contract', 'Intern'];

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
    photoDataUri: null,
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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10.5,
  fontWeight: 600,
  color: 'var(--clr-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 5,
};

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input {...props} className="field" />
    </div>
  );
}

/** Backend-unreachable vs. backend-responded-with-an-error read very
    differently to a user — the former means "try again later" (toast),
    the latter is actionable right where they're typing (inline). An
    ApiError with no `status` never got an HTTP response at all, which
    is exactly the network-level "server unreachable" case. */
function isConnectionError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === undefined;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export function EmployeeMaster({ isOpen, onClose, employees, onEmployeesChange, title = 'Employee Master', onEmployeeAdded, onEmployeeUpdated, onEmployeeDeleted }: Props) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Employee | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [viewing, setViewing] = useState<Employee | null>(null);
  const [viewTab, setViewTab] = useState<'personal' | 'employment' | 'bank' | 'documents' | 'salary'>('personal');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  /* Client-side filter over the shared `employees` prop — no network
     call. The whole directory is already loaded (App.tsx fetches it
     once on startup), so there's nothing a server round-trip would add
     here except latency; searching the array in memory keeps this the
     one and only place employee data is read from, per the "no
     duplicate fetches" rule. */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    const haystack = (e: Employee) => [
      e.name, e.employeeId, e.department, e.designation, e.employmentType,
      e.email, e.phone, e.address, e.pan, e.aadhaar, e.bankAccount, e.bankName, e.branch, e.ifsc, e.uan,
      e.manager, e.emergencyContact, e.doj, e.employmentEndDate, e.notes,
      e.salaryStructureNote, e.status,
    ];
    return employees.filter(e => haystack(e).some(v => (v || '').toLowerCase().includes(q)));
  }, [employees, search]);

  if (!isOpen) return null;

  const startAdd = () => {
    setEditing(emptyEmployee());
    setFormError('');
    setShowForm(true);
  };

  const startEdit = (emp: Employee) => {
    setEditing({ ...emp });
    setFormError('');
    setShowForm(true);
  };

  const cancelForm = () => {
    if (saving) return;
    setShowForm(false);
    setEditing(null);
    setFormError('');
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.employeeId.trim() || !editing.name.trim()) {
      setFormError('Employee ID and Employee Name are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const exists = employees.some(e => e.id === editing.id);
      const saved = exists ? await updateEmployee(editing.id, editing) : await createEmployee(editing);
      const next = exists ? employees.map(e => (e.id === saved.id ? saved : e)) : [...employees, saved];
      onEmployeesChange(next);
      if (exists) onEmployeeUpdated?.(saved); else onEmployeeAdded?.(saved);
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      if (isConnectionError(err)) {
        setToast(errorMessage(err, 'Unable to connect to server'));
      } else {
        setFormError(errorMessage(err, 'Failed to save employee. Please try again.'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (emp: Employee) => {
    if (!window.confirm(`Delete ${emp.name || emp.employeeId}? This cannot be undone.`)) return;
    setDeletingId(emp.id);
    setToast('');
    try {
      await deleteEmployee(emp.id);
      onEmployeesChange(employees.filter(e => e.id !== emp.id));
      onEmployeeDeleted?.(emp);
    } catch (err) {
      setToast(errorMessage(err, 'Unable to connect to server'));
    } finally {
      setDeletingId(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', zIndex: 9999 }}
      onClick={onClose}
    >
      {toast && (
        <div
          style={{
            position: 'fixed', top: 16, right: 16, zIndex: 10010,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 16px', background: 'var(--clr-danger)', color: '#fff',
            borderRadius: 8, fontSize: 13, fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxWidth: 360,
          }}
          onClick={e => e.stopPropagation()}
        >
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          {toast}
        </div>
      )}
      <div
        style={{
          background: '#fff', borderRadius: 16, width: '100%', maxWidth: 800,
          maxHeight: '86vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px', borderBottom: '1px solid var(--clr-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            {showForm && (
              <button
                onClick={cancelForm}
                title="Back to list"
                style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--clr-text-muted)', padding: 4 }}
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <Users size={15} style={{ color: 'var(--clr-accent)' }} />
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--clr-text)' }}>
              {showForm ? (employees.some(e => e.id === editing?.id) ? 'Edit Employee' : 'Add Employee') : title}
            </span>
            {!showForm && (
              <span style={{ fontSize: 11.5, color: 'var(--clr-text-muted)', fontWeight: 600 }}>
                {employees.length} record{employees.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 28, height: 28, borderRadius: 6, border: 'none', background: '#F1F5F9',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {!showForm ? (
          <>
            {/* Search + Add */}
            <div style={{ padding: '16px 22px 0', display: 'flex', gap: 10, flexShrink: 0 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--clr-text-subtle)' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, employee ID, department, email, or phone…"
                  className="field"
                  style={{ paddingLeft: 34 }}
                  aria-label="Search employees"
                />
              </div>
              <button onClick={startAdd} className="btn btn-dark" style={{ fontSize: 12.5, flexShrink: 0 }}>
                <Plus size={14} /> Add Employee
              </button>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px 22px' }}>
              {filtered.length === 0 ? (
                <EmptyState
                  compact
                  icon={Users}
                  title={search.trim() ? 'No matches found' : 'No employees yet'}
                  description={search.trim() ? 'Try a different search term.' : 'Click "Add Employee" to create the first record.'}
                />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))', gap: 12 }}>
                  {filtered.map(emp => (
                    <div key={emp.id} className="entity-card" style={{ padding: '16px 16px 13px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <EmployeeAvatar name={emp.name} photoDataUri={emp.photoDataUri} size={42} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--clr-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--clr-text-muted)', fontFamily: 'monospace' }}>{emp.employeeId}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        <StatusBadge label={emp.status} tone={emp.status === 'Active' ? 'success' : 'neutral'} />
                        {emp.employmentType && <StatusBadge label={emp.employmentType} tone="info" />}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11.5, color: 'var(--clr-text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Building2 size={11} style={{ flexShrink: 0, color: 'var(--clr-text-subtle)' }} />
                          {[emp.designation, emp.department].filter(Boolean).join(' · ') || '—'}
                        </div>
                        {emp.email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Mail size={11} style={{ flexShrink: 0, color: 'var(--clr-text-subtle)' }} />
                            {emp.email}
                          </div>
                        )}
                        {emp.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Phone size={11} style={{ flexShrink: 0, color: 'var(--clr-text-subtle)' }} />
                            {emp.phone}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 2, marginTop: 2, borderTop: '1px solid var(--clr-border)', paddingTop: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setViewing(emp); setViewTab('personal'); }} title="View Employee" className="btn-icon" style={{ border: 'none', cursor: 'pointer' }} disabled={deletingId === emp.id}>
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
              )}
            </div>
          </>
        ) : (
          editing && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>

              {/* Photo */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Photo (optional)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--clr-bg)', border: '1px solid var(--clr-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}>
                    {editing.photoDataUri
                      ? <img src={editing.photoDataUri} alt={editing.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <User size={20} style={{ color: 'var(--clr-text-subtle)' }} />}
                  </div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1.5px dashed var(--clr-border)', borderRadius: 8, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: 'var(--clr-text-muted)' }}>
                    <Upload size={13} />
                    {editing.photoDataUri ? 'Change Photo' : 'Upload Photo'}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onloadend = () => setEditing({ ...editing, photoDataUri: reader.result as string });
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                  {editing.photoDataUri && (
                    <button onClick={() => setEditing({ ...editing, photoDataUri: null })} className="btn-icon" style={{ border: 'none', cursor: 'pointer' }} title="Remove photo">
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Employee ID *" value={editing.employeeId} onChange={e => setEditing({ ...editing, employeeId: e.target.value })} placeholder="EMP-001" />
                <Field label="Employee Name *" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Jane Doe" />
                <Field label="Email" type="email" value={editing.email || ''} onChange={e => setEditing({ ...editing, email: e.target.value })} placeholder="jane.doe@company.com" />
                <Field label="Phone" value={editing.phone || ''} onChange={e => setEditing({ ...editing, phone: e.target.value })} placeholder="9876543210" />
                <div>
                  <label style={labelStyle}>Employment Type</label>
                  <select
                    value={editing.employmentType || ''}
                    onChange={e => setEditing({ ...editing, employmentType: (e.target.value || undefined) as EmploymentType | undefined })}
                    className="field"
                  >
                    <option value="">—</option>
                    {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <Field label="Department" value={editing.department} onChange={e => setEditing({ ...editing, department: e.target.value })} placeholder="Engineering" />
                <Field label="Designation" value={editing.designation} onChange={e => setEditing({ ...editing, designation: e.target.value })} placeholder="Software Engineer" />
                <Field label="Manager" value={editing.manager || ''} onChange={e => setEditing({ ...editing, manager: e.target.value })} placeholder="Reporting manager" />
                <Field label="Emergency Contact" value={editing.emergencyContact || ''} onChange={e => setEditing({ ...editing, emergencyContact: e.target.value })} placeholder="Name · phone number" />
                <div style={{ gridColumn: '1 / -1' }}>
                  <Field label="Residential Address" value={editing.address || ''} onChange={e => setEditing({ ...editing, address: e.target.value })} placeholder="Street, City, State - PIN" />
                </div>
                <Field label="Joining Date" type="date" value={editing.doj} onChange={e => setEditing({ ...editing, doj: e.target.value })} />
                <Field label="Employment End Date" type="date" value={editing.employmentEndDate || ''} onChange={e => setEditing({ ...editing, employmentEndDate: e.target.value })} />
                <div>
                  <label style={labelStyle}>Status</label>
                  <select
                    value={editing.status}
                    onChange={e => setEditing({ ...editing, status: e.target.value as Employee['status'] })}
                    className="field"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <Field label="PAN" value={editing.pan || ''} onChange={e => setEditing({ ...editing, pan: e.target.value })} placeholder="AAAPL1234C" />
                <Field label="Aadhaar" value={editing.aadhaar || ''} onChange={e => setEditing({ ...editing, aadhaar: e.target.value })} placeholder="1234 5678 9012" />
                <Field label="Bank Name" value={editing.bankName || ''} onChange={e => setEditing({ ...editing, bankName: e.target.value })} placeholder="State Bank of India" />
                <Field label="Branch" value={editing.branch || ''} onChange={e => setEditing({ ...editing, branch: e.target.value })} placeholder="Madhapur" />
                <Field label="Bank Account" value={editing.bankAccount || ''} onChange={e => setEditing({ ...editing, bankAccount: e.target.value })} placeholder="1234567890" />
                <Field label="IFSC" value={editing.ifsc || ''} onChange={e => setEditing({ ...editing, ifsc: e.target.value })} placeholder="SBIN0001234" />
                <Field label="UAN" value={editing.uan || ''} onChange={e => setEditing({ ...editing, uan: e.target.value })} placeholder="100123456789" />
                <Field label="Salary Structure" value={editing.salaryStructureNote || ''} onChange={e => setEditing({ ...editing, salaryStructureNote: e.target.value })} placeholder="e.g. CTC 6L, Basic 40%, HRA 20%" />
                <div style={{ gridColumn: '1 / -1' }}>
                  <Field label="Notes" value={editing.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} placeholder="Any other HR notes" />
                </div>
              </div>

              {formError && (
                <div style={{ marginTop: 14, padding: '9px 12px', background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: 8, fontSize: 12, color: '#B91C1C', fontWeight: 500 }}>
                  {formError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button onClick={cancelForm} disabled={saving} className="btn btn-secondary" style={{ fontSize: 12.5, opacity: saving ? 0.6 : 1 }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn btn-dark" style={{ fontSize: 12.5, opacity: saving ? 0.7 : 1 }}>
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {saving ? 'Saving…' : 'Save Employee'}
                </button>
              </div>
            </div>
          )
        )}
      </div>

      {/* View Employee — read-only, tabbed by category. Purely a
          different view of the same Employee record; no storage change. */}
      {viewing && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { e.stopPropagation(); setViewing(null); }}
        >
          <div
            style={{ background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', padding: '22px 24px', maxWidth: 480, width: '100%', maxHeight: '82vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <EmployeeAvatar name={viewing.name} photoDataUri={viewing.photoDataUri} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--clr-text)' }}>{viewing.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--clr-text-muted)', fontFamily: 'monospace' }}>{viewing.employeeId}</div>
              </div>
              <button onClick={() => setViewing(null)} className="btn-icon" style={{ border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div className="tabs-row" style={{ marginBottom: 14 }}>
              {([
                ['personal', 'Personal'],
                ['employment', 'Employment'],
                ['bank', 'Bank'],
                ['documents', 'Documents'],
                ['salary', 'Salary'],
              ] as const).map(([key, label]) => (
                <button key={key} className={`tab-item${viewTab === key ? ' active' : ''}`} onClick={() => setViewTab(key)}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {viewTab === 'personal' && (
                <>
                  <DetailRow label="Full Name" value={viewing.name} />
                  <DetailRow label="Employee Code" value={viewing.employeeId} />
                  <DetailRow label="Email" value={viewing.email} />
                  <DetailRow label="Phone" value={viewing.phone} />
                  <DetailRow label="Address" value={viewing.address} />
                  <DetailRow label="Status" value={viewing.status} />
                  <DetailRow label="Emergency Contact" value={viewing.emergencyContact} />
                </>
              )}
              {viewTab === 'employment' && (
                <>
                  <DetailRow label="Designation" value={viewing.designation} />
                  <DetailRow label="Department" value={viewing.department} />
                  <DetailRow label="Employment Type" value={viewing.employmentType} />
                  <DetailRow label="Manager" value={viewing.manager} />
                  <DetailRow label="Joining Date" value={viewing.doj} />
                  <DetailRow label="Employment End Date" value={viewing.employmentEndDate} />
                </>
              )}
              {viewTab === 'bank' && (
                <>
                  <DetailRow label="Bank Name" value={viewing.bankName} />
                  <DetailRow label="Branch" value={viewing.branch} />
                  <DetailRow label="Bank Account" value={viewing.bankAccount} />
                  <DetailRow label="IFSC Code" value={viewing.ifsc} />
                </>
              )}
              {viewTab === 'documents' && (
                <>
                  <DetailRow label="PAN" value={viewing.pan} />
                  <DetailRow label="Aadhaar" value={viewing.aadhaar} />
                  <DetailRow label="UAN" value={viewing.uan} />
                </>
              )}
              {viewTab === 'salary' && (
                <>
                  <DetailRow label="Salary Structure" value={viewing.salaryStructureNote} />
                  <DetailRow label="Notes" value={viewing.notes} />
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={() => { startEdit(viewing); setViewing(null); }} className="btn btn-dark" style={{ fontSize: 12.5, flex: 1 }}>
                <Pencil size={13} /> Edit
              </button>
              <button onClick={() => setViewing(null)} className="btn btn-secondary" style={{ fontSize: 12.5 }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, paddingBottom: 8, borderBottom: '1px solid var(--clr-border)' }}>
      <span style={{ color: 'var(--clr-text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: 'var(--clr-text)', textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
}
