import React, { useState } from 'react';
import { Employee } from '../../types';
import { EmployeeAvatar } from '../ui/EmployeeAvatar';
import { Pencil, X } from 'lucide-react';

interface Props {
  employee: Employee;
  onClose: () => void;
  onEdit: (employee: Employee) => void;
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, paddingBottom: 8, borderBottom: '1px solid var(--clr-border)' }}>
      <span style={{ color: 'var(--clr-text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: 'var(--clr-text)', textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
}

/** Read-only, tabbed employee detail view — extracted from the old
    EmployeeMaster modal (Sprint 5.7) unchanged, just relocated so the
    new Employees page can open it directly instead of going through
    the retired directory modal. */
export function EmployeeViewModal({ employee, onClose, onEdit }: Props) {
  const [viewTab, setViewTab] = useState<'personal' | 'employment' | 'bank' | 'documents' | 'salary'>('personal');

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', padding: '22px 24px', maxWidth: 480, width: '100%', maxHeight: '82vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <EmployeeAvatar name={employee.name} photoUrl={employee.photoUrl} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--clr-text)' }}>{employee.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--clr-text-muted)', fontFamily: 'monospace' }}>{employee.employeeId}</div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ border: 'none', cursor: 'pointer' }}><X size={16} /></button>
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
              <DetailRow label="Full Name" value={employee.name} />
              <DetailRow label="Employee Code" value={employee.employeeId} />
              <DetailRow label="Email" value={employee.email} />
              <DetailRow label="Phone" value={employee.phone} />
              <DetailRow label="Address" value={employee.address} />
              <DetailRow label="Status" value={employee.status} />
              <DetailRow label="Emergency Contact" value={employee.emergencyContact} />
            </>
          )}
          {viewTab === 'employment' && (
            <>
              <DetailRow label="Designation" value={employee.designation} />
              <DetailRow label="Department" value={employee.department} />
              <DetailRow label="Employment Type" value={employee.employmentType} />
              <DetailRow label="Manager" value={employee.manager} />
              <DetailRow label="Joining Date" value={employee.doj} />
              <DetailRow label="Employment End Date" value={employee.employmentEndDate} />
            </>
          )}
          {viewTab === 'bank' && (
            <>
              <DetailRow label="Bank Name" value={employee.bankName} />
              <DetailRow label="Branch" value={employee.branch} />
              <DetailRow label="Bank Account" value={employee.bankAccount} />
              <DetailRow label="IFSC Code" value={employee.ifsc} />
            </>
          )}
          {viewTab === 'documents' && (
            <>
              <DetailRow label="PAN" value={employee.pan} />
              <DetailRow label="Aadhaar" value={employee.aadhaar} />
              <DetailRow label="UAN" value={employee.uan} />
            </>
          )}
          {viewTab === 'salary' && (
            <>
              <DetailRow label="Salary Structure" value={employee.salaryStructureNote} />
              <DetailRow label="Notes" value={employee.notes} />
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={() => onEdit(employee)} className="btn btn-dark" style={{ fontSize: 12.5, flex: 1 }}>
            <Pencil size={13} /> Edit
          </button>
          <button onClick={onClose} className="btn btn-secondary" style={{ fontSize: 12.5 }}>Close</button>
        </div>
      </div>
    </div>
  );
}
