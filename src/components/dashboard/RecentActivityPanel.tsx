import React from 'react';
import { ActivityLogEntry, ActivityType } from '../../types';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import {
  Receipt, UserPlus, UserCog, UserMinus, Trash2, FileSpreadsheet, Settings, Activity, Send,
} from 'lucide-react';

interface Props {
  activityLog: ActivityLogEntry[];
  onDeleteActivity: (id: string) => void;
}

const ACTIVITY_META: Record<ActivityType, { icon: React.ComponentType<{ size?: number }>; label: string; color: string }> = {
  salary_generated:          { icon: Receipt,          label: 'Salary slip generated',    color: 'var(--arna-teal)' },
  employee_added:            { icon: UserPlus,         label: 'Employee added',           color: 'var(--brand-primary)' },
  employee_updated:          { icon: UserCog,          label: 'Employee updated',         color: 'var(--brand-primary)' },
  employee_deleted:          { icon: UserMinus,        label: 'Employee removed',         color: 'var(--clr-danger)' },
  salary_deleted:            { icon: Trash2,           label: 'Salary record deleted',    color: 'var(--clr-danger)' },
  payroll_exported:          { icon: FileSpreadsheet,  label: 'Payroll exported',         color: 'var(--arna-teal)' },
  company_settings_changed:  { icon: Settings,         label: 'Company settings updated', color: 'var(--arna-amber)' },
  salary_shared:             { icon: Send,             label: 'Salary slip shared',       color: 'var(--arna-accent)' },
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Live feed of everything logActivity() has recorded — salary
    generation, directory changes, exports, settings changes. Reads
    activityLog exactly as App.tsx already maintains it; nothing here
    invents an event type or a record. */
export function RecentActivityPanel({ activityLog, onDeleteActivity }: Props) {
  return (
    <Card title="Recent Activity" icon={<Activity size={13} />}>
      {activityLog.length === 0 ? (
        <EmptyState
          compact
          icon={Activity}
          title="No activity yet"
          description="Generate a salary slip or add an employee and it will show up here."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {activityLog.slice(0, 12).map(entry => {
            const meta = ACTIVITY_META[entry.type];
            const Icon = meta.icon;
            return (
              <div key={entry.id} className="data-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 6px', borderRadius: 8, borderBottom: '1px solid var(--clr-border)' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: 'var(--clr-bg)', color: meta.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={13} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--clr-text)' }}>
                    {meta.label} — <span style={{ fontWeight: 700 }}>{entry.employeeName}</span>
                  </div>
                  {entry.detail && (
                    <div style={{ fontSize: 11, color: 'var(--clr-text-muted)' }}>{entry.detail}</div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--clr-text-subtle)', flexShrink: 0 }}>{timeAgo(entry.timestamp)}</div>
                <button
                  onClick={() => onDeleteActivity(entry.id)}
                  title="Delete activity"
                  className="btn-icon"
                  style={{ border: 'none', cursor: 'pointer', flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--clr-danger)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--clr-text-muted)'; }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
