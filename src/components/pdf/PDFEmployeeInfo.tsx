import React from 'react';

interface Props {
  employeeName: string;
  designation: string;
  department: string;
  employeeId: string;
  joiningDate: string;
  paidDays: number;
  lopDays: number;
  primary: string;
  secondary: string;
}

function Section({ title, rows, primary, secondary, labelWidth, borderLeft }: {
  title: string;
  rows: [string, string][];
  primary: string;
  secondary: string;
  labelWidth: number;
  borderLeft?: string;
}) {
  return (
    <div style={{ flex: 1, padding: '9px 14px', borderLeft }}>
      <div style={{
        fontSize: '7pt', fontWeight: 700, color: primary,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        marginBottom: 7, paddingBottom: 5,
        borderBottom: `1.5px solid ${secondary}`,
      }}>
        {title}
      </div>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', marginBottom: 3, alignItems: 'baseline' }}>
          <span style={{ width: labelWidth, flexShrink: 0, fontSize: '7.5pt', color: '#9CA3AF', lineHeight: 1.5 }}>{label}</span>
          <span style={{ fontSize: '7.5pt', color: '#D1D5DB', marginRight: 7, lineHeight: 1.5 }}>:</span>
          <span style={{ fontSize: '8pt', fontWeight: 600, color: '#1F2937', flex: 1, lineHeight: 1.5, wordBreak: 'break-word' }}>{value || '—'}</span>
        </div>
      ))}
    </div>
  );
}

/** Two bordered, equal-width sections — Employee Details | Employment Details. */
export function PDFEmployeeInfo({
  employeeName, designation, department, employeeId, joiningDate, paidDays, lopDays, primary, secondary,
}: Props) {
  return (
    <div style={{ display: 'flex', marginBottom: 9, border: '1px solid #E2E8F0', borderRadius: 4 }}>
      <Section
        title="Employee Details"
        primary={primary}
        secondary={secondary}
        labelWidth={78}
        rows={[
          ['Name', employeeName],
          ['Designation', designation],
          ['Department', department],
        ]}
      />
      <Section
        title="Employment Details"
        primary={primary}
        secondary={secondary}
        labelWidth={100}
        borderLeft="1px solid #E2E8F0"
        rows={[
          ['Employee ID', employeeId],
          ['Date of Joining', joiningDate],
          ['Paid Days', String(paidDays)],
          ['LOP Days', String(lopDays)],
        ]}
      />
    </div>
  );
}
