import React from 'react';
import { LayoutDashboard, Receipt, Users, History, FileSpreadsheet, Settings, FolderOpen, Calculator, FileText } from 'lucide-react';

export type SidebarKey = 'dashboard' | 'generator' | 'directory' | 'history' | 'export' | 'documents' | 'taxcenter' | 'settings' | 'invoice-generator' | 'invoice-history';

interface NavItem {
  key: SidebarKey;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface Props {
  activeKey: SidebarKey;
  onNavigate: (key: SidebarKey) => void;
  /** Display label for the employee directory item (white-label aware). */
  teamDirectoryLabel: string;
}

/**
 * Left navigation. Presentational only — App.tsx owns what each key
 * does (show the existing Salary Generator screen, open the existing
 * Employee Master modal, or switch the visible page). Grouped into
 * labelled sections (Sprint 4 polish) purely for scannability — the
 * SidebarKey contract and every existing destination are unchanged.
 */
export function Sidebar({ activeKey, onNavigate, teamDirectoryLabel }: Props) {
  const groups: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Payroll',
      items: [
        { key: 'generator', label: 'Salary Generator', icon: Receipt },
        { key: 'history', label: 'Salary History', icon: History },
        { key: 'export', label: 'Payroll Export', icon: FileSpreadsheet },
        { key: 'taxcenter', label: 'Tax Center', icon: Calculator },
      ],
    },
    {
      label: 'Finance',
      items: [
        { key: 'invoice-generator', label: 'Invoice Generator', icon: FileText },
        { key: 'invoice-history', label: 'Invoice History', icon: History },
      ],
    },
    {
      label: 'Organisation',
      items: [
        { key: 'directory', label: teamDirectoryLabel, icon: Users },
        { key: 'documents', label: 'Documents', icon: FolderOpen },
        { key: 'settings', label: 'Company Settings', icon: Settings },
      ],
    },
  ];

  return (
    <nav className="app-sidebar" aria-label="Primary">
      {groups.map(group => (
        <div key={group.label} className="sidebar-group">
          <div className="sidebar-group-label">{group.label}</div>
          {group.items.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`sidebar-link${activeKey === key ? ' active' : ''}`}
              onClick={() => onNavigate(key)}
              aria-current={activeKey === key ? 'page' : undefined}
            >
              <Icon size={16} />
              <span className="sidebar-link-label">{label}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
