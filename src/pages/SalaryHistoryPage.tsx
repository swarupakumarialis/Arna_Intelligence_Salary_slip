import React, { useMemo, useState } from 'react';
import { SalaryHistoryRecord } from '../types';
import { Eye, FileEdit, Copy, Download, Trash2, History, ArrowUpDown, X } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { TableToolbar, SearchInput } from '../components/ui/TableToolbar';
import { useCurrency } from '../contexts/CurrencyContext';

interface Props {
  records: SalaryHistoryRecord[];
  /** autoExport=true also regenerates + downloads the PDF once loaded. */
  onLoadRecord: (record: SalaryHistoryRecord, autoExport?: boolean) => void;
  onDelete: (record: SalaryHistoryRecord) => void;
}

export function SalaryHistoryPage({ records, onLoadRecord, onDelete }: Props) {
  const { format: fmt } = useCurrency();
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [oldestFirst, setOldestFirst] = useState(false);
  const [viewing, setViewing] = useState<SalaryHistoryRecord | null>(null);

  const months = useMemo(() => Array.from(new Set(records.map(r => r.month))), [records]);
  const years = useMemo(() => Array.from(new Set(records.map(r => r.year))).sort().reverse(), [records]);
  const employeeOptions = useMemo(() => {
    const seen = new Map<string, string>();
    records.forEach(r => seen.set(r.employeeId, r.employeeName));
    return Array.from(seen.entries());
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = records.filter(r => {
      if (monthFilter && r.month !== monthFilter) return false;
      if (yearFilter && r.year !== yearFilter) return false;
      if (employeeFilter && r.employeeId !== employeeFilter) return false;
      if (!q) return true;
      return (
        r.employeeName.toLowerCase().includes(q) ||
        r.employeeId.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q)
      );
    });
    // Records are stored newest-first already; reverse only when asked for oldest-first.
    if (oldestFirst) list = [...list].reverse();
    return list;
  }, [records, search, monthFilter, yearFilter, employeeFilter, oldestFirst]);

  const handleDelete = (record: SalaryHistoryRecord) => {
    if (!window.confirm(`Delete the ${record.month} ${record.year} salary record for ${record.employeeName}? This cannot be undone.`)) return;
    onDelete(record);
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Salary History" description="Every payslip you export is saved here automatically." />

      <TableToolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by employee or department…" />
        <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="field" style={{ flex: '0 1 150px' }}>
          <option value="">All Months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="field" style={{ flex: '0 1 120px' }}>
          <option value="">All Years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)} className="field" style={{ flex: '0 1 190px' }}>
          <option value="">All Employees</option>
          {employeeOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <button
          onClick={() => setOldestFirst(v => !v)}
          className="btn btn-secondary"
          style={{ fontSize: 12, flexShrink: 0 }}
          title={oldestFirst ? 'Currently oldest first' : 'Currently latest first'}
        >
          <ArrowUpDown size={13} /> {oldestFirst ? 'Oldest First' : 'Latest First'}
        </button>
      </TableToolbar>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><History size={24} /></div>
          <h2>{records.length === 0 ? 'No salary slips yet' : 'No records match your filters'}</h2>
          <p>{records.length === 0 ? 'Export a payslip from the Salary Generator and it will show up here automatically.' : 'Try clearing the search or filters above.'}</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', maxHeight: '64vh', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--clr-bg)' }}>
                  {['Employee', 'Employee Code', 'Month', 'Year', 'Net Pay', 'Generated Date', 'Status', 'Actions'].map((h, i) => (
                    <th key={h} style={{
                      textAlign: i === 4 ? 'right' : i === 7 ? 'center' : 'left',
                      padding: '11px 14px', fontSize: 10.5, fontWeight: 700, color: 'var(--clr-text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--clr-border)',
                      whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--clr-bg)', zIndex: 1,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(record => (
                  <tr key={record.id} className="data-row">
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--clr-text)', whiteSpace: 'nowrap' }}>{record.employeeName}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--clr-text-muted)', whiteSpace: 'nowrap' }}>{record.employeeId}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--clr-text)' }}>{record.month}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--clr-text)' }}>{record.year}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--clr-text)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(record.netSalary)}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--clr-text-muted)', whiteSpace: 'nowrap' }}>{record.generatedDate}</td>
                    <td style={{ padding: '10px 14px' }}><StatusBadge label={record.status} tone="success" /></td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                        <button onClick={() => setViewing(record)} title="View" className="btn-icon" style={{ border: 'none', cursor: 'pointer' }}><Eye size={13} /></button>
                        <button onClick={() => onLoadRecord(record, false)} title="Load into Generator" className="btn-icon" style={{ border: 'none', cursor: 'pointer' }}><FileEdit size={13} /></button>
                        <button onClick={() => onLoadRecord(record, true)} title="Download PDF" className="btn-icon" style={{ border: 'none', cursor: 'pointer' }}><Download size={13} /></button>
                        <button onClick={() => onLoadRecord(record, false)} title="Duplicate" className="btn-icon" style={{ border: 'none', cursor: 'pointer' }}><Copy size={13} /></button>
                        <button
                          onClick={() => handleDelete(record)}
                          title="Delete"
                          className="btn-icon"
                          style={{ border: 'none', cursor: 'pointer' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--clr-danger)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--clr-text-muted)'; }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewing && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setViewing(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', padding: '24px 26px', maxWidth: 480, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--clr-text)' }}>{viewing.employeeName}</div>
                <div style={{ fontSize: 12, color: 'var(--clr-text-muted)' }}>{viewing.month} {viewing.year} · {viewing.employeeId}</div>
              </div>
              <button onClick={() => setViewing(null)} className="btn-icon" style={{ border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 12 }}>
              {viewing.earnings.map(e => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <span style={{ color: 'var(--clr-text-muted)' }}>{e.name}</span>
                  <span style={{ fontWeight: 600, color: 'var(--clr-text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(e.amount)}</span>
                </div>
              ))}
              <div style={{ height: 1, background: 'var(--clr-border)', margin: '6px 0' }} />
              {viewing.deductions.map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <span style={{ color: 'var(--clr-text-muted)' }}>{d.name}</span>
                  <span style={{ fontWeight: 600, color: 'var(--clr-danger)', fontVariantNumeric: 'tabular-nums' }}>- {fmt(d.amount)}</span>
                </div>
              ))}
            </div>

            <div style={{ padding: '10px 12px', background: 'var(--clr-bg)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--clr-text)' }}>Net Salary</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--clr-text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(viewing.netSalary)}</span>
            </div>

            <div style={{ fontSize: 11, color: 'var(--clr-text-subtle)', lineHeight: 1.8 }}>
              Generated {viewing.generatedDate} at {viewing.generatedTime} · {viewing.companyName}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => { onLoadRecord(viewing, true); setViewing(null); }} className="btn btn-dark" style={{ fontSize: 12.5, flex: 1 }}>
                <Download size={13} /> Download PDF
              </button>
              <button onClick={() => setViewing(null)} className="btn btn-secondary" style={{ fontSize: 12.5 }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
