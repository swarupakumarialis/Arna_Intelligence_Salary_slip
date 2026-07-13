import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Employee, EmploymentType } from '../../types';
import { createEmployee, updateEmployee, uploadEmployeePhoto, deleteEmployeePhoto, ApiError } from '../../api/employeeApi';
import { ArrowLeft, X, Upload, User, Loader2, AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** The employee being edited, or a freshly-blanked record when adding. */
  employee: Employee;
  /** True when `employee.id` already exists in the directory — decides
      whether Save calls updateEmployee or createEmployee, and the
      header/CTA copy. Passed in rather than re-derived so the caller
      (which already knows whether this is an add or edit flow) stays
      the single source of truth. */
  isExisting: boolean;
  onSaved: (employee: Employee, wasExisting: boolean) => void;
}

const EMPLOYMENT_TYPES: EmploymentType[] = ['Full-time', 'Part-time', 'Contract', 'Intern'];

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

/**
 * Add/Edit Employee form — extracted from the old EmployeeMaster modal
 * (Sprint 5.7) so both the legacy modal shape and the new dedicated
 * Employees page can trigger the exact same save flow. The validation,
 * createEmployee/updateEmployee calls, and error handling below are
 * unchanged from EmployeeMaster.tsx — this is a relocation, not a
 * rewrite; Employee CRUD and the Employee API contract are untouched.
 */
export function EmployeeFormModal({ isOpen, onClose, employee, isExisting, onSaved }: Props) {
  const [editing, setEditing] = useState<Employee>(employee);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  /* Photo (Production Hotfix): the file is staged here, not read as
     base64 into `editing` — that base64-in-JSON approach is exactly
     what caused 413 "request entity too large" errors once a real
     photo blew past express.json()'s default 100kb limit. The actual
     upload happens after the employee record itself is saved (see
     handleSave), via a dedicated multipart endpoint, so it never
     touches the JSON payload at all. photoPreviewUrl is a local
     object URL purely for the in-modal preview before that upload
     completes — revoked below whenever it's replaced or the modal
     unmounts, so it never leaks. */
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [removePhotoRequested, setRemovePhotoRequested] = useState(false);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  // Re-seed local edit state whenever a different employee record is opened.
  const [lastId, setLastId] = useState(employee.id);
  if (employee.id !== lastId) {
    setLastId(employee.id);
    setEditing(employee);
    setFormError('');
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setRemovePhotoRequested(false);
  }

  if (!isOpen) return null;

  const handlePhotoSelected = (file: File) => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
    setRemovePhotoRequested(false);
  };

  const handleRemovePhoto = () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    // Only need a server round-trip if there's a persisted photo to
    // actually delete from Drive — a still-staged, never-saved photo
    // just disappears locally.
    if (editing.photoUrl) setRemovePhotoRequested(true);
  };

  const handleSave = async () => {
    if (!editing.employeeId.trim() || !editing.name.trim()) {
      setFormError('Employee ID and Employee Name are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      let saved = isExisting ? await updateEmployee(editing.id, editing) : await createEmployee(editing);

      // Photo step runs after the record is safely saved, and is
      // deliberately best-effort from here on — a Drive hiccup must
      // never turn an otherwise-successful employee save into a
      // reported failure (same pattern as PDF archiving in App.tsx).
      try {
        if (photoFile) {
          saved = await uploadEmployeePhoto(saved.id, photoFile);
        } else if (removePhotoRequested) {
          saved = await deleteEmployeePhoto(saved.id);
        }
      } catch (photoErr) {
        setToast(errorMessage(photoErr, 'Employee saved, but the photo upload failed. Try uploading it again.'));
      }

      onSaved(saved, isExisting);
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

  const displayedPhotoUrl = photoPreviewUrl || (removePhotoRequested ? null : editing.photoUrl);

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', zIndex: 9999 }}
      onClick={() => !saving && onClose()}
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
        <div style={{
          padding: '18px 22px', borderBottom: '1px solid var(--clr-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <button
              onClick={onClose}
              title="Cancel"
              disabled={saving}
              style={{ display: 'flex', border: 'none', background: 'transparent', cursor: saving ? 'default' : 'pointer', color: 'var(--clr-text-muted)', padding: 4 }}
            >
              <ArrowLeft size={16} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--clr-text)' }}>
              {isExisting ? 'Edit Employee' : 'Add Employee'}
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            style={{
              width: 28, height: 28, borderRadius: 6, border: 'none', background: '#F1F5F9',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: saving ? 'default' : 'pointer', color: '#64748B',
            }}
          >
            <X size={14} />
          </button>
        </div>

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
                {displayedPhotoUrl
                  ? <img src={displayedPhotoUrl} alt={editing.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <User size={20} style={{ color: 'var(--clr-text-subtle)' }} />}
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1.5px dashed var(--clr-border)', borderRadius: 8, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: 'var(--clr-text-muted)' }}>
                <Upload size={13} />
                {displayedPhotoUrl ? 'Change Photo' : 'Upload Photo'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoSelected(file);
                }} />
              </label>
              {displayedPhotoUrl && (
                <button onClick={handleRemovePhoto} className="btn-icon" style={{ border: 'none', cursor: 'pointer' }} title="Remove photo">
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
            <button onClick={onClose} disabled={saving} className="btn btn-secondary" style={{ fontSize: 12.5, opacity: saving ? 0.6 : 1 }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-dark" style={{ fontSize: 12.5, opacity: saving ? 0.7 : 1 }}>
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? 'Saving…' : 'Save Employee'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
