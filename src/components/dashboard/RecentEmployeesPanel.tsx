import React, { useMemo, useState } from 'react';
import { Employee, EmploymentType } from '../../types';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { EmployeeAvatar } from '../ui/EmployeeAvatar';
import { StatusBadge } from '../ui/StatusBadge';
import { Search, UserPlus, Users } from 'lucide-react';

interface Props {
  employees: Employee[];
  onOpenEmployeeMaster: () => void;
}

type SortKey = 'newest' | 'oldest' | 'az' | 'recently-joined';

/** Cap on how many rows this dashboard panel shows at once — it's a
    quick-glance widget, not the full directory; "View All Employees"
    is what opens that. */
const DISPLAY_LIMIT = 8;

const selectStyle: React.CSSProperties = { flex: '1 1 110px', fontSize: 11.5, padding: '6px 30px 6px 9px' };

/** Searchable/filterable/sortable slice of the Employee Directory —
    same underlying Employee[] data model as EmployeeMaster, just
    queried differently for a quick dashboard glance. Every filter
    option (departments, employment types) is derived from whatever's
    actually in `employees`, never a hardcoded list. */
export function RecentEmployeesPanel({ employees, onOpenEmployeeMaster }: Props) {
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');

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
    const list = employees.filter(e => {
      if (department && e.department !== department) return false;
      if (employmentType && e.employmentType !== employmentType) return false;
      if (status && e.status !== status) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q) || e.employeeId.toLowerCase().includes(q);
    });

    /* EmployeeMaster appends new records to the end of the array, so
       array order IS add order — "Newest"/"Oldest" read directly off
       that rather than any invented timestamp. */
    switch (sort) {
      case 'newest':          return [...list].reverse();
      case 'oldest':          return list;
      case 'az':               return [...list].sort((a, b) => a.name.localeCompare(b.name));
      case 'recently-joined': return [...list].sort((a, b) => (b.doj || '').localeCompare(a.doj || ''));
      default:                 return list;
    }
  }, [employees, search, department, employmentType, status, sort]);

  const visible = filtered.slice(0, DISPLAY_LIMIT);

  return (
    <Card title="Recent Employees" icon={<UserPlus size={13} />}>
      {employees.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--clr-text-subtle)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or employee ID…"
              className="field"
              style={{ paddingLeft: 30, fontSize: 12 }}
              aria-label="Search employees"
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <select value={department} onChange={e => setDepartment(e.target.value)} className="field" style={selectStyle} aria-label="Filter by department">
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={employmentType} onChange={e => setEmploymentType(e.target.value)} className="field" style={selectStyle} aria-label="Filter by employment type">
              <option value="">All Types</option>
              {employmentTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={status} onChange={e => setStatus(e.target.value)} className="field" style={selectStyle} aria-label="Filter by status">
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <select value={sort} onChange={e => setSort(e.target.value as SortKey)} className="field" style={selectStyle} aria-label="Sort employees">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="az">A–Z</option>
              <option value="recently-joined">Recently Joined</option>
            </select>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          compact
          icon={UserPlus}
          title={employees.length === 0 ? 'No employees yet' : 'No matches found'}
          description={employees.length === 0 ? 'Employees you add to the directory will appear here.' : 'Try a different search or filter.'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {visible.map(emp => (
            <button
              key={emp.id}
              onClick={onOpenEmployeeMaster}
              className="data-row"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px',
                borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer',
                textAlign: 'left', width: '100%',
              }}
            >
              <EmployeeAvatar name={emp.name} photoDataUri={emp.photoDataUri} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--clr-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {emp.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--clr-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {emp.designation || emp.employeeId}
                </div>
              </div>
              <StatusBadge label={emp.status} tone={emp.status === 'Active' ? 'success' : 'neutral'} />
            </button>
          ))}
        </div>
      )}

      <button
        onClick={onOpenEmployeeMaster}
        className="btn btn-secondary"
        style={{ width: '100%', justifyContent: 'center', fontSize: 12, marginTop: 12 }}
      >
        <Users size={13} /> View All Employees
      </button>
    </Card>
  );
}
