import React, { useMemo } from 'react';
import { Employee, SalaryHistoryRecord, ActivityLogEntry } from '../types';
import { SidebarKey } from '../components/layout/Sidebar';
import { LOP_DEDUCTION_ID } from '../utils/payroll';
import { getCurrentPeriodLabel } from '../utils/date';
import { useCurrency } from '../contexts/CurrencyContext';
import { WelcomeBanner } from '../components/dashboard/WelcomeBanner';
import { KpiCard } from '../components/dashboard/KpiCard';
import { QuickActionsPanel, QuickAction } from '../components/dashboard/QuickActionsPanel';
import { RecentActivityPanel } from '../components/dashboard/RecentActivityPanel';
import { PayrollSummaryPanel } from '../components/dashboard/PayrollSummaryPanel';
import { EmployeeDistributionPanel } from '../components/dashboard/EmployeeDistributionPanel';
import { RecentEmployeesPanel } from '../components/dashboard/RecentEmployeesPanel';
import {
  Users, UserCheck, Receipt, Wallet, Clock3, TrendingDown, Coins,
  Zap, FileSpreadsheet, Settings, History,
} from 'lucide-react';

interface Props {
  employees: Employee[];
  salaryHistory: SalaryHistoryRecord[];
  activityLog: ActivityLogEntry[];
  currentMonth: string;
  currentYear: string;
  onNavigate: (key: SidebarKey) => void;
  onOpenEmployeeMaster: () => void;
  onDeleteActivity: (id: string) => void;
}

export function DashboardPage({
  employees, salaryHistory, activityLog, currentMonth, currentYear,
  onNavigate, onOpenEmployeeMaster, onDeleteActivity,
}: Props) {
  const { format: fmt } = useCurrency();

  /* Every number below is derived from the same real employees /
     salaryHistory collections App.tsx already owns and passes down —
     nothing here is fabricated or hardcoded. */
  const metrics = useMemo(() => {
    const activeEmployees = employees.filter(e => e.status === 'Active');
    const thisPeriodRecords = salaryHistory.filter(r => r.month === currentMonth && r.year === currentYear);
    const generatedEmployeeIds = new Set(thisPeriodRecords.map(r => r.employeeId));
    const pendingCount = activeEmployees.filter(e => !generatedEmployeeIds.has(e.employeeId)).length;
    const estimatedPayroll = thisPeriodRecords.reduce((s, r) => s + r.netSalary, 0);
    const averageSalary = thisPeriodRecords.length > 0 ? estimatedPayroll / thisPeriodRecords.length : 0;
    const totalLop = thisPeriodRecords.reduce((s, r) => {
      const lopItem = r.deductions.find(d => d.id === LOP_DEDUCTION_ID);
      return s + (lopItem ? Number(lopItem.amount) || 0 : 0);
    }, 0);
    return { activeEmployees, thisPeriodRecords, pendingCount, estimatedPayroll, averageSalary, totalLop };
  }, [employees, salaryHistory, currentMonth, currentYear]);

  const quickActions: QuickAction[] = [
    { icon: Zap, label: 'Generate Salary', desc: 'Open the Salary Generator', onClick: () => onNavigate('generator') },
    { icon: Users, label: 'Employee Directory', desc: 'Manage the team roster', onClick: onOpenEmployeeMaster },
    { icon: FileSpreadsheet, label: 'Payroll Export', desc: 'Export a month to Excel', onClick: () => onNavigate('export') },
    { icon: Settings, label: 'Company Settings', desc: 'Branding & company details', onClick: () => onNavigate('settings') },
    { icon: History, label: 'Salary History', desc: 'Browse past payslips', onClick: () => onNavigate('history') },
  ];

  return (
    <div className="animate-fade-in-up">
      <WelcomeBanner periodLabel={getCurrentPeriodLabel()} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 26 }}>
        <KpiCard tone="primary" icon={Users} label="Total Employees" value={String(employees.length)} />
        <KpiCard tone="success" icon={UserCheck} label="Active Employees" value={String(metrics.activeEmployees.length)} />
        <KpiCard tone="info" icon={Receipt} label="Slips Generated" value={String(salaryHistory.length)} caption={`${metrics.thisPeriodRecords.length} this period`} />
        <KpiCard tone="primary" icon={Wallet} label="Estimated Payroll" value={fmt(metrics.estimatedPayroll)} caption="Net pay, this period" />
        <KpiCard tone="warning" icon={Clock3} label="Pending Salary Slips" value={String(metrics.pendingCount)} caption="Active employees, this period" />
        <KpiCard tone="info" icon={Coins} label="Average Salary" value={fmt(metrics.averageSalary)} caption="Per slip, this period" />
        <KpiCard tone="neutral" icon={TrendingDown} label="Total LOP Amount" value={fmt(metrics.totalLop)} caption="Deducted this period" />
      </div>

      <div style={{ marginBottom: 26 }}>
        <QuickActionsPanel actions={quickActions} />
      </div>

      <div className="dashboard-grid" style={{ marginBottom: 16 }}>
        <PayrollSummaryPanel records={salaryHistory} month={currentMonth} year={currentYear} fmt={fmt} />
        <EmployeeDistributionPanel employees={employees} />
      </div>

      <div className="dashboard-grid">
        <RecentActivityPanel activityLog={activityLog} onDeleteActivity={onDeleteActivity} />
        <RecentEmployeesPanel employees={employees} onOpenEmployeeMaster={onOpenEmployeeMaster} />
      </div>
    </div>
  );
}
