import React, { useMemo, useState } from 'react';
import { SalaryHistoryRecord } from '../types';
import { buildPayrollSummary, exportPayroll } from '../utils/payrollExport';
import { FileSpreadsheet, Download, Info, Users, Wallet, Banknote, ShieldCheck, HeartPulse, TrendingDown, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState } from '../components/ui/EmptyState';
import { useCurrency } from '../contexts/CurrencyContext';

interface Props {
  records: SalaryHistoryRecord[];
  defaultMonth: string;
  defaultYear: string;
  onExported: (month: string, year: string, format: 'xlsx' | 'csv') => void;
}

export function PayrollExportPage({ records, defaultMonth, defaultYear, onExported }: Props) {
  const { format: fmt } = useCurrency();
  const months = useMemo(() => Array.from(new Set(records.map(r => r.month))), [records]);
  const years = useMemo(() => Array.from(new Set(records.map(r => r.year))).sort().reverse(), [records]);

  const [month, setMonth] = useState(months.includes(defaultMonth) ? defaultMonth : (months[0] || defaultMonth));
  const [year, setYear] = useState(years.includes(defaultYear) ? defaultYear : (years[0] || defaultYear));

  const matching = useMemo(
    () => records.filter(r => r.month === month && r.year === year),
    [records, month, year]
  );
  const summary = useMemo(() => buildPayrollSummary(matching), [matching]);

  const handleExport = (format: 'xlsx' | 'csv') => {
    exportPayroll(matching, format, `Payroll_${month}_${year}`);
    onExported(month, year, format);
  };

  if (records.length === 0) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader title="Payroll Export" description="Export monthly payroll to Excel and CSV." />
        <Card>
          <EmptyState
            icon={FileSpreadsheet}
            title="Nothing to export yet"
            description="Generate at least one salary slip from the Salary Generator, and it'll be ready to export here."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader title="Payroll Export" description="Export monthly payroll to Excel and CSV." />

      {/* Filters */}
      <Card title="Select Pay Period" icon={<SlidersHorizontal size={13} />}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 420 }}>
          <div>
            <label className="field-label">Month</label>
            <select value={month} onChange={e => setMonth(e.target.value)} className="field">
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Year</label>
            <select value={year} onChange={e => setYear(e.target.value)} className="field">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Summary */}
      <Card title="Payroll Summary" icon={<Wallet size={13} />}>
        {matching.length === 0 ? (
          <EmptyState
            compact
            icon={Wallet}
            title="No records for this period"
            description={`No salary slips were generated for ${month} ${year}. Try a different month or year.`}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <StatCard icon={Users} label="Employees" value={String(summary.employeeCount)} />
            <StatCard icon={Wallet} label="Estimated Gross" value={fmt(summary.estimatedGross)} />
            <StatCard icon={Banknote} label="Estimated Net" value={fmt(summary.estimatedNet)} />
            <StatCard icon={ShieldCheck} label="Total PF" value={fmt(summary.totalPf)} />
            <StatCard icon={FileSpreadsheet} label="Total PT" value={fmt(summary.totalPt)} />
            <StatCard icon={HeartPulse} label="Total ESI" value={fmt(summary.totalEsi)} />
            <StatCard icon={TrendingDown} label="Total LOP" value={fmt(summary.totalLop)} />
          </div>
        )}
      </Card>

      {/* Export */}
      <Card title="Export" icon={<Download size={13} />}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <button
            onClick={() => handleExport('xlsx')}
            disabled={matching.length === 0}
            className="btn btn-dark"
            style={{ fontSize: 12.5, opacity: matching.length === 0 ? 0.5 : 1 }}
          >
            <Download size={14} /> Export Excel (.xlsx)
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={matching.length === 0}
            className="btn btn-secondary"
            style={{ fontSize: 12.5, opacity: matching.length === 0 ? 0.5 : 1 }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: 'var(--clr-bg)', borderRadius: 8, fontSize: 11, color: 'var(--clr-text-subtle)', lineHeight: 1.6 }}>
          <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>PF, PT, ESI, and TDS figures are calculated by matching deduction names (e.g. a row named "Provident Fund" counts toward PF). Unrecognised deductions are grouped under Other Deductions in the export.</span>
        </div>
      </Card>
    </div>
  );
}
