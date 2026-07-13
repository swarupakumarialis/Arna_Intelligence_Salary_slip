import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SalaryData, SalaryItem, Employee } from '../types';
import { Plus, Trash2, CircleDollarSign, Users, Lock, CalendarDays, UserCog, PhoneCall } from 'lucide-react';
import { FormErrors, TouchedFields, LOP_DEDUCTION_ID } from '../App';
import { calculateLop } from '../utils/payroll';
import { StatusBadge } from './ui/StatusBadge';
import { EmployeeAvatar } from './ui/EmployeeAvatar';
import { useCurrency } from '../contexts/CurrencyContext';

interface Props {
  data: SalaryData;
  onChange: (data: SalaryData) => void;
  errors?: FormErrors;
  touched?: TouchedFields;
  onBlurField?: (field: keyof Omit<FormErrors, 'deductions'>) => void;
  onBlurDeduction?: (id: string, col: 'name' | 'amount') => void;
  employees: Employee[];
  onSelectEmployee: (recordId: string) => void;
  onOpenEmployeeMaster: () => void;
  /** Display name for the employee directory (defaults to a generic
      label so this form works standalone for any company). */
  employeeDirectoryTitle?: string;
}

/* Standard component names for the "Quick add" chips below the
   Earnings/Deductions lists (Sprint 5.7). Purely a naming convenience —
   clicking one just calls addEarningNamed/addDeductionNamed, which
   pre-fills a normal SalaryItem row's `name` the same as typing it by
   hand. No new field, no schema change; still one flat, freely-named
   earnings/deductions array underneath, exactly as before. */
const STANDARD_EARNINGS = ['Basic Pay', 'HRA', 'Special Allowance', 'Medical', 'Conveyance', 'Bonus', 'Other Allowances'];
const STANDARD_DEDUCTIONS = ['PF', 'ESI', 'Professional Tax', 'TDS', 'Other Deductions'];

function QuickAddChips({ names, onAdd }: { names: string[]; onAdd: (name: string) => void }) {
  if (names.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
      {names.map(name => (
        <button
          key={name}
          type="button"
          onClick={() => onAdd(name)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '3px 8px', borderRadius: 999,
            border: '1px dashed var(--clr-border)', background: 'transparent',
            fontSize: 10.5, fontWeight: 600, color: 'var(--clr-text-subtle)', cursor: 'pointer',
            transition: 'all 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--arna-accent)'; e.currentTarget.style.color = 'var(--arna-accent)'; e.currentTarget.style.background = '#F0FDFA'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--clr-border)'; e.currentTarget.style.color = 'var(--clr-text-subtle)'; e.currentTarget.style.background = 'transparent'; }}
        >
          <Plus size={9} /> {name}
        </button>
      ))}
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────── */

function FieldGroup({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="card animate-fade-in-up">
      <div className="card-header">
        <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {icon && <span style={{ color: 'var(--clr-accent)', opacity: 0.8 }}>{icon}</span>}
          {title}
        </span>
      </div>
      <div className="card-body">
        {children}
      </div>
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="field-label">
      {children}
      {required && <span style={{ color: '#DC2626', marginLeft: 3, fontWeight: 700 }}>*</span>}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#DC2626', flexShrink: 0, display: 'inline-block' }} />
      {message}
    </div>
  );
}

function InlineInput({
  label: lbl,
  required,
  error,
  ...props
}: { label: string; required?: boolean; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <FieldLabel required={required}>{lbl}</FieldLabel>
      <input
        {...props}
        className="field"
        style={{
          ...(props.style || {}),
          borderColor: error ? '#FCA5A5' : undefined,
          boxShadow: error ? '0 0 0 3px rgba(220,38,38,0.10)' : undefined,
        }}
      />
      <FieldError message={error} />
    </div>
  );
}

/* Default department options (Sprint 6.2B) — a fixed starting list,
   not a managed/admin-editable list: "Other" always stays available
   below so this never blocks a department that isn't on it. */
const DEFAULT_DEPARTMENTS = [
  'Human Resources (HR)', 'Finance', 'Accounts', 'Sales', 'Marketing', 'Operations',
  'Administration', 'Engineering', 'IT', 'Development', 'QA', 'Support',
  'Customer Success', 'Legal', 'Procurement', 'Logistics', 'Production',
  'Research & Development', 'Training', 'Business Development', 'Management',
];

/** Searchable Department dropdown (Sprint 6.2B) — replaces a plain
    free-text field with a filterable list of common departments,
    while still allowing any custom value via "Other" so this never
    blocks a department that isn't one of the defaults. Kept local to
    this file, matching how InlineInput/SalaryRow/etc. are already
    file-scoped sub-components rather than shared ui/ primitives. */
function DepartmentField({
  value, onChange, onBlur, error,
}: { value: string; onChange: (v: string) => void; onBlur?: () => void; error?: string }) {
  const isPreset = DEFAULT_DEPARTMENTS.includes(value);
  const [manualMode, setManualMode] = useState(value.length > 0 && !isPreset);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(
    () => DEFAULT_DEPARTMENTS.filter(d => d.toLowerCase().includes(query.trim().toLowerCase())),
    [query]
  );

  if (manualMode) {
    return (
      <div>
        <FieldLabel required>Department</FieldLabel>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            className="field"
            type="text"
            name="department"
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder="Enter department"
            style={{ borderColor: error ? '#FCA5A5' : undefined, boxShadow: error ? '0 0 0 3px rgba(220,38,38,0.10)' : undefined }}
          />
          <button
            type="button"
            title="Choose from list instead"
            onClick={() => { setManualMode(false); onChange(''); setQuery(''); }}
            style={{
              flexShrink: 0, padding: '0 12px', borderRadius: 8,
              border: '1.5px solid var(--clr-border)', background: 'transparent',
              fontSize: 11, fontWeight: 600, color: 'var(--clr-text-muted)', cursor: 'pointer',
            }}
          >
            List
          </button>
        </div>
        <FieldError message={error} />
      </div>
    );
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <FieldLabel required>Department</FieldLabel>
      <input
        className="field"
        type="text"
        name="department"
        value={open ? query : value}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onBlur={onBlur}
        placeholder="Search department…"
        autoComplete="off"
        style={{ borderColor: error ? '#FCA5A5' : undefined, boxShadow: error ? '0 0 0 3px rgba(220,38,38,0.10)' : undefined }}
      />
      {open && (
        <div style={{
          position: 'absolute', zIndex: 20, top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#fff', border: '1px solid var(--clr-border)', borderRadius: 8,
          maxHeight: 220, overflowY: 'auto', boxShadow: 'var(--shadow-md, 0 8px 20px rgba(0,0,0,0.12))',
        }}>
          {filtered.map(d => (
            <div
              key={d}
              onMouseDown={() => { onChange(d); setOpen(false); }}
              style={{ padding: '7px 10px', fontSize: 12.5, cursor: 'pointer', color: 'var(--clr-text)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--clr-bg)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              {d}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '7px 10px', fontSize: 11.5, color: 'var(--clr-text-subtle)' }}>
              No match — choose "Other" below
            </div>
          )}
          <div
            onMouseDown={() => { setManualMode(true); onChange(''); setOpen(false); }}
            style={{
              padding: '7px 10px', fontSize: 12.5, fontWeight: 600, color: 'var(--arna-accent)',
              cursor: 'pointer', borderTop: '1px solid var(--clr-border)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--clr-bg)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            Other (type manually)
          </div>
        </div>
      )}
      <FieldError message={error} />
    </div>
  );
}

/** Read-only key/value row — used for the Contact & Bank Details block
    pulled from the Employee Directory, so HR only ever reviews this
    data on the payslip screen instead of retyping it every month. */
function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--clr-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 2px' }}>{label}</p>
      <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--clr-text)', margin: 0, wordBreak: 'break-word' }}>{value}</p>
    </div>
  );
}

interface SalaryRowProps {
  item: SalaryItem;
  onNameChange: (v: string) => void;
  onAmountChange: (v: number) => void;
  onRemove: () => void;
  onBlurName?: () => void;
  onBlurAmount?: () => void;
  nameError?: string;
  amountError?: string;
  /** System-computed row (e.g. auto Loss of Pay) — read-only, no remove. */
  locked?: boolean;
}

function SalaryRow({ item, onNameChange, onAmountChange, onRemove, onBlurName, onBlurAmount, nameError, amountError, locked }: SalaryRowProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div className="salary-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Component name"
            value={item.name}
            readOnly={locked}
            onChange={e => onNameChange(e.target.value)}
            style={{
              flex: 1,
              padding: locked ? '7px 26px 7px 10px' : '7px 10px',
              background: locked ? '#F8FAFC' : (nameError ? '#FFF5F5' : '#f9fafb'),
              border: nameError ? '1.5px solid #FCA5A5' : '1.5px solid transparent',
              borderRadius: 7,
              fontSize: 12.5,
              color: locked ? 'var(--clr-text-muted)' : 'var(--clr-text)',
              fontFamily: 'inherit',
              fontWeight: 500,
              fontStyle: locked ? 'italic' : 'normal',
              cursor: locked ? 'default' : 'text',
              transition: 'all 150ms',
              outline: 'none',
            }}
            onFocus={e => { if (locked) return; e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = 'var(--brand-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--brand-primary) 12%, transparent)'; }}
            onBlur={e => { if (locked) return; e.currentTarget.style.background = nameError ? '#FFF5F5' : '#f9fafb'; e.currentTarget.style.borderColor = nameError ? '#FCA5A5' : 'transparent'; e.currentTarget.style.boxShadow = 'none'; onBlurName?.(); }}
          />
          {locked && (
            <Lock size={11} title="Automatically calculated" style={{ position: 'absolute', right: 9, color: 'var(--clr-text-subtle)' }} />
          )}
        </div>
        <input
          type="number"
          placeholder="0"
          value={item.amount || ''}
          readOnly={locked}
          onChange={e => onAmountChange(Number(e.target.value))}
          style={{
            width: 88,
            padding: '7px 10px',
            background: locked ? '#F8FAFC' : (amountError ? '#FFF5F5' : '#f9fafb'),
            border: amountError ? '1.5px solid #FCA5A5' : '1.5px solid transparent',
            borderRadius: 7,
            fontSize: 12.5,
            color: locked ? 'var(--clr-text-muted)' : 'var(--clr-text)',
            fontFamily: 'inherit',
            fontWeight: 700,
            textAlign: 'right',
            cursor: locked ? 'default' : 'text',
            transition: 'all 150ms',
            outline: 'none',
          }}
          onFocus={e => { if (locked) return; e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = 'var(--brand-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--brand-primary) 12%, transparent)'; }}
          onBlur={e => { if (locked) return; e.currentTarget.style.background = amountError ? '#FFF5F5' : '#f9fafb'; e.currentTarget.style.borderColor = amountError ? '#FCA5A5' : 'transparent'; e.currentTarget.style.boxShadow = 'none'; onBlurAmount?.(); }}
        />
        {locked ? (
          <div style={{ width: 23, flexShrink: 0 }} />
        ) : (
          <button
            onClick={onRemove}
            className="salary-row-delete"
            title="Remove"
            style={{
              padding: 5, borderRadius: 6, border: 'none',
              background: 'transparent', cursor: 'pointer',
              color: '#d1d5db', transition: 'all 150ms',
              display: 'flex', alignItems: 'center', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#d1d5db'; }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {/* Inline row errors */}
      {(nameError || amountError) && (
        <div style={{ display: 'flex', gap: 8, paddingLeft: 2 }}>
          {nameError && <span style={{ fontSize: 10.5, color: '#DC2626', fontWeight: 500 }}>{nameError}</span>}
          {amountError && !nameError && <span style={{ fontSize: 10.5, color: '#DC2626', fontWeight: 500 }}>{amountError}</span>}
        </div>
      )}
    </div>
  );
}

interface SalaryColHeaderProps {
  label: string;
  onAdd: () => void;
}

function SalaryColHeader({ label: lbl, onAdd }: SalaryColHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <span className="field-label" style={{ marginBottom: 0 }}>{lbl}</span>
      <button
        onClick={onAdd}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 9px', borderRadius: 6,
          border: '1.5px dashed var(--clr-border)',
          background: 'transparent', cursor: 'pointer',
          fontSize: 11, fontWeight: 600, color: 'var(--clr-text-muted)',
          transition: 'all 150ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#0D9488'; e.currentTarget.style.color = '#0D9488'; e.currentTarget.style.background = '#F0FDFA'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--clr-border)'; e.currentTarget.style.color = 'var(--clr-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
      >
        <Plus size={12} />
        Add
      </button>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────── */

export function SalarySlipForm({ data, onChange, errors = {}, touched = {}, onBlurField, onBlurDeduction, employees, onSelectEmployee, onOpenEmployeeMaster, employeeDirectoryTitle = 'Employee Master' }: Props) {
  const { format: fmt } = useCurrency();

  /* Helper: only show error if field has been touched */
  const err = (field: keyof Omit<FormErrors, 'deductions'>) =>
    touched[field] ? errors[field] : undefined;
  const dedErr = (id: string, col: 'name' | 'amount') =>
    touched.deductions?.[id]?.[col] ? errors.deductions?.[id]?.[col] : undefined;

  /* Employee */
  const handleEmployeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...data, employee: { ...data.employee, [e.target.name]: e.target.value } });
  };

  /* Salary period */
  const handleSalaryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    onChange({ ...data, salary: { ...data.salary, [e.target.name]: value } });
  };

  /* Earnings */
  const addEarning = () =>
    onChange({ ...data, earnings: [...data.earnings, { id: Date.now().toString(), name: '', amount: 0 }] });
  /* Quick-add a standard component by name (Sprint 5.7 — "prepare UI
     for structured salary components" without changing the underlying
     free-text SalaryItem[] model: this just pre-fills the name field
     of a normal new row, same as typing it in by hand). Skips adding a
     duplicate if a row with that name (case-insensitive) already exists. */
  const addEarningNamed = (name: string) => {
    if (data.earnings.some(e => e.name.trim().toLowerCase() === name.toLowerCase())) return;
    onChange({ ...data, earnings: [...data.earnings, { id: Date.now().toString(), name, amount: 0 }] });
  };
  const removeEarning = (id: string) =>
    onChange({ ...data, earnings: data.earnings.filter(e => e.id !== id) });
  const updateEarning = (id: string, f: keyof SalaryItem, v: string | number) =>
    onChange({ ...data, earnings: data.earnings.map(e => e.id === id ? { ...e, [f]: v } : e) });

  /* Deductions */
  const addDeduction = () =>
    onChange({ ...data, deductions: [...data.deductions, { id: Date.now().toString(), name: '', amount: 0 }] });
  const addDeductionNamed = (name: string) => {
    if (data.deductions.some(d => d.name.trim().toLowerCase() === name.toLowerCase())) return;
    onChange({ ...data, deductions: [...data.deductions, { id: Date.now().toString(), name, amount: 0 }] });
  };
  const removeDeduction = (id: string) =>
    onChange({ ...data, deductions: data.deductions.filter(d => d.id !== id) });
  const updateDeduction = (id: string, f: keyof SalaryItem, v: string | number) =>
    onChange({ ...data, deductions: data.deductions.map(d => d.id === id ? { ...d, [f]: v } : d) });

  /* Totals — memoised since they recompute on every render otherwise
     (this form re-renders on every keystroke across the whole page). */
  const totalEarnings   = useMemo(() => data.earnings.reduce((s, e) => s + (Number(e.amount) || 0), 0), [data.earnings]);
  const totalDeductions = useMemo(() => data.deductions.reduce((s, d) => s + (Number(d.amount) || 0), 0), [data.deductions]);
  const netPay           = totalEarnings - totalDeductions;

  /* Live LOP calculation — same formula App.tsx uses to maintain the
     auto deduction row, so this summary always matches the payslip. */
  const lop = useMemo(
    () => calculateLop(totalEarnings, Number(data.salary.workingDays) || 0, Number(data.salary.lopDays) || 0),
    [totalEarnings, data.salary.workingDays, data.salary.lopDays]
  );
  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'Active'), [employees]);

  /* The employee record behind whatever is currently in the Employee
     ID field — whether it got there via "Select Employee" or was typed
     by hand. Purely a lookup for display (the read-only details block
     below); SalaryData.employee stays the single source of truth for
     the form and the payslip itself. */
  const selectedEmployee = useMemo(
    () => employees.find(e => e.employeeId === data.employee.id) || null,
    [employees, data.employee.id]
  );

  /* Contact/bank rows to show read-only, sourced straight from the
     Employee Directory record rather than SalaryData.employee — this
     is what removes the old "Additional Details" form: HR reviews this
     once in the Directory, not again every time a payslip is made. */
  const readOnlyDetails = useMemo<[string, string][]>(() => {
    if (!selectedEmployee) return [];
    const rows: [string, string | undefined][] = [
      ['Email', selectedEmployee.email],
      ['PAN', selectedEmployee.pan],
      ['Bank Name', selectedEmployee.bankName],
      ['Bank Account', selectedEmployee.bankAccount],
      ['IFSC Code', selectedEmployee.ifsc],
    ];
    return rows.filter((row): row is [string, string] => !!row[1]);
  }, [selectedEmployee]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="stagger-children">

      {/* Employee — selection, identity, and (once a directory record
          is linked) a read-only summary of its contact/bank details. */}
      <FieldGroup title="Employee" icon={<Users size={13} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Select from Employee Master — autofills the fields below */}
          <div>
            <FieldLabel>Select Employee</FieldLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                defaultValue=""
                onChange={e => { if (e.target.value) { onSelectEmployee(e.target.value); e.target.value = ''; } }}
                className="field"
                style={{ fontSize: 12.5, flex: 1 }}
              >
                <option value="" disabled>
                  {activeEmployees.length === 0 ? 'No employees saved yet' : `Choose from ${employeeDirectoryTitle}…`}
                </option>
                {activeEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} — {emp.employeeId}</option>
                ))}
              </select>
              <button
                onClick={onOpenEmployeeMaster}
                title={`Open ${employeeDirectoryTitle}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                  padding: '0 12px', borderRadius: 8,
                  border: '1.5px solid var(--clr-border)',
                  background: 'transparent', cursor: 'pointer',
                  fontSize: 11.5, fontWeight: 600, color: 'var(--clr-text-muted)',
                  transition: 'all 150ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#0D9488'; e.currentTarget.style.color = '#0D9488'; e.currentTarget.style.background = '#F0FDFA'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--clr-border)'; e.currentTarget.style.color = 'var(--clr-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <Users size={13} />
                Manage
              </button>
            </div>
          </div>

          {/* Compact summary of the matched directory record, if any */}
          {selectedEmployee && (
            <div className="animate-fade-in-up" style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px', borderRadius: 12,
              border: '1px solid color-mix(in srgb, var(--arna-accent) 30%, var(--clr-border))',
              borderLeft: '3px solid var(--arna-accent)',
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--arna-accent) 7%, white), white 65%)',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <EmployeeAvatar name={selectedEmployee.name} photoUrl={selectedEmployee.photoUrl} size={48} />
              {/* minWidth: 0 at every flex level below (this block, the
                  name row, and the name span itself) is what actually
                  lets long content truncate/wrap in place instead of
                  forcing this card — and therefore the whole form
                  column — wider (Sprint 5.6.1). A flex item's default
                  min-width is `auto` (its content's min-content size),
                  which for nowrap text is its full unbroken width; only
                  an explicit minWidth: 0 overrides that. */}
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, minWidth: 0 }}>
                  <span style={{
                    fontSize: 13.5, fontWeight: 800, color: 'var(--clr-text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    minWidth: 0, flex: '0 1 auto',
                  }}>
                    {selectedEmployee.name}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: 'var(--arna-slate)', flexShrink: 0,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    background: 'var(--clr-bg)', border: '1px solid var(--clr-border)',
                    borderRadius: 5, padding: '1px 6px',
                  }}>
                    {selectedEmployee.employeeId}
                  </span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--clr-text)', overflowWrap: 'break-word' }}>
                  {selectedEmployee.designation || '—'}
                  {selectedEmployee.employmentType && <span style={{ color: 'var(--clr-text-subtle)', fontWeight: 500 }}> · {selectedEmployee.employmentType}</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--clr-text-muted)', marginTop: 1, overflowWrap: 'break-word' }}>
                  {selectedEmployee.department || '—'}
                  {selectedEmployee.doj && ` · Joined ${new Date(selectedEmployee.doj).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                </div>
                {/* Manager / Emergency Contact — only rendered when at
                    least one is on file, so employees without either
                    don't get an empty row (Sprint 5.7). Same
                    overflowWrap safety as the lines above. */}
                {(selectedEmployee.manager || selectedEmployee.emergencyContact) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: 10.5, color: 'var(--clr-text-subtle)', marginTop: 4 }}>
                    {selectedEmployee.manager && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, overflowWrap: 'break-word' }}>
                        <UserCog size={10} style={{ flexShrink: 0 }} /> {selectedEmployee.manager}
                      </span>
                    )}
                    {selectedEmployee.emergencyContact && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, overflowWrap: 'break-word' }}>
                        <PhoneCall size={10} style={{ flexShrink: 0 }} /> {selectedEmployee.emergencyContact}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <StatusBadge label={selectedEmployee.status} tone={selectedEmployee.status === 'Active' ? 'success' : 'neutral'} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <InlineInput label="Full Name" type="text" name="name" required value={data.employee.name}
              onChange={handleEmployeeChange} onBlur={() => onBlurField?.('employeeName')}
              placeholder="John Doe" error={err('employeeName')} />
            <InlineInput label="Employee ID" type="text" name="id" required value={data.employee.id}
              onChange={handleEmployeeChange} onBlur={() => onBlurField?.('employeeId')}
              placeholder="EMP-001" error={err('employeeId')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <InlineInput label="Designation" type="text" name="designation" required value={data.employee.designation}
              onChange={handleEmployeeChange} onBlur={() => onBlurField?.('designation')}
              placeholder="Engineer" error={err('designation')} />
            <DepartmentField
              value={data.employee.department}
              onChange={v => onChange({ ...data, employee: { ...data.employee, department: v } })}
              onBlur={() => onBlurField?.('department')}
              error={err('department')}
            />
          </div>
          <InlineInput label="Date of Joining" type="date" name="doj" required value={data.employee.doj}
            onChange={handleEmployeeChange} onBlur={() => onBlurField?.('doj')}
            error={err('doj')} />

          {/* Read-only — pulled from the Employee Directory, not re-entered
              here. Only shown once a directory record is actually linked
              and it has at least one of these fields on file. */}
          {readOnlyDetails.length > 0 && (
            <div style={{ borderTop: '1px solid var(--clr-border)', paddingTop: 14 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--clr-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
                Contact &amp; Bank Details <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>— from {employeeDirectoryTitle}</span>
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                {readOnlyDetails.map(([label, value]) => (
                  <React.Fragment key={label}>
                    <ReadOnlyRow label={label} value={value} />
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      </FieldGroup>

      {/* Pay Period */}
      <FieldGroup title="Pay Period" icon={<CalendarDays size={13} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <div>
              <FieldLabel required>Month</FieldLabel>
              <select name="month" value={data.salary.month} onChange={handleSalaryChange} className="field" style={{ fontSize: 13 }}>
                {['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <InlineInput label="Year" type="number" name="year" required value={data.salary.year}
              onChange={handleSalaryChange} onBlur={() => onBlurField?.('year')}
              error={err('year')} />
            <InlineInput label="Working Days" type="number" name="workingDays" value={data.salary.workingDays}
              onChange={handleSalaryChange} min={0} max={31} />
            <InlineInput label="Paid Days" type="number" name="paidDays" required value={data.salary.paidDays}
              onChange={handleSalaryChange} onBlur={() => onBlurField?.('paidDays')}
              min={0} max={31} error={err('paidDays')} />
            <InlineInput label="LOP Days" type="number" name="lopDays" value={data.salary.lopDays}
              onChange={handleSalaryChange} min={0} max={31} />
          </div>

          {/* Live LOP calculation — no manual math, updates on every keystroke.
              Only shown once there's an actual gross to calculate against, so
              a brand-new payslip doesn't open with a wall of zeroes. */}
          {totalEarnings > 0 && (
            <div style={{
              padding: '10px 12px', background: 'var(--clr-bg)',
              border: '1px solid var(--clr-border)', borderRadius: 8,
              display: 'flex', gap: 20, flexWrap: 'wrap',
            }}>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--clr-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>LOP Amount</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--clr-danger)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {lop.lopAmount > 0 ? `- ${fmt(lop.lopAmount)}` : fmt(0)}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--clr-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Net Gross</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--clr-text)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{fmt(lop.netGross)}</p>
              </div>
            </div>
          )}
        </div>
      </FieldGroup>

      {/* Salary Components — earnings/deductions, plus a single compact
          Net Pay indicator in the header (replaces the old four-card
          Salary Summary section: gross/deductions are already visible
          line-by-line right below, so only the one bottom-line figure
          needs a highlight). */}
      <div className="card animate-fade-in-up">
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <CircleDollarSign size={13} style={{ color: 'var(--clr-text-muted)', opacity: 0.8 }} />
            Salary Components
          </span>
          {(totalEarnings > 0 || totalDeductions > 0) && (
            <div className="net-pay-chip">
              <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Net Pay</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--clr-text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(netPay)}</span>
            </div>
          )}
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>

            {/* Earnings */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="field-label" style={{ marginBottom: 0 }}>
                  Earnings
                  <span style={{ color: '#DC2626', marginLeft: 3, fontWeight: 700 }}>*</span>
                </span>
                <button
                  onClick={addEarning}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 9px', borderRadius: 6,
                    border: '1.5px dashed var(--clr-border)',
                    background: 'transparent', cursor: 'pointer',
                    fontSize: 11, fontWeight: 600, color: 'var(--clr-text-muted)',
                    transition: 'all 150ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#0D9488'; e.currentTarget.style.color = '#0D9488'; e.currentTarget.style.background = '#F0FDFA'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--clr-border)'; e.currentTarget.style.color = 'var(--clr-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <Plus size={12} /> Add
                </button>
              </div>
              <QuickAddChips
                names={STANDARD_EARNINGS.filter(n => !data.earnings.some(e => e.name.trim().toLowerCase() === n.toLowerCase()))}
                onAdd={addEarningNamed}
              />
              {/* Basic salary validation banner */}
              {touched.basicSalary && errors.basicSalary && (
                <div style={{
                  background: '#FEF2F2', border: '1px solid #FEE2E2',
                  borderRadius: 6, padding: '6px 10px', marginBottom: 6,
                  fontSize: 11, color: '#DC2626', fontWeight: 500,
                }}>
                  {errors.basicSalary}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.earnings.map(item => (
                  <React.Fragment key={item.id}>
                    <SalaryRow
                      item={item}
                      onNameChange={v => updateEarning(item.id, 'name', v)}
                      onAmountChange={v => updateEarning(item.id, 'amount', v)}
                      onRemove={() => removeEarning(item.id)}
                    />
                  </React.Fragment>
                ))}
                {data.earnings.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--clr-text-subtle)', textAlign: 'center', padding: '16px 0' }}>
                    No earnings yet — click Add to start building this payslip.
                  </p>
                )}
              </div>
            </div>

            {/* Deductions */}
            <div>
              <SalaryColHeader label="Deductions" onAdd={addDeduction} />
              <QuickAddChips
                names={STANDARD_DEDUCTIONS.filter(n => !data.deductions.some(d => d.name.trim().toLowerCase() === n.toLowerCase()))}
                onAdd={addDeductionNamed}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.deductions.map(item => (
                  <React.Fragment key={item.id}>
                    <SalaryRow
                      item={item}
                      onNameChange={v => updateDeduction(item.id, 'name', v)}
                      onAmountChange={v => updateDeduction(item.id, 'amount', v)}
                      onRemove={() => removeDeduction(item.id)}
                      onBlurName={() => onBlurDeduction?.(item.id, 'name')}
                      onBlurAmount={() => onBlurDeduction?.(item.id, 'amount')}
                      nameError={dedErr(item.id, 'name')}
                      amountError={dedErr(item.id, 'amount')}
                      locked={item.id === LOP_DEDUCTION_ID}
                    />
                  </React.Fragment>
                ))}
                {data.deductions.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--clr-text-subtle)', textAlign: 'center', padding: '16px 0' }}>
                    No deductions added
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
