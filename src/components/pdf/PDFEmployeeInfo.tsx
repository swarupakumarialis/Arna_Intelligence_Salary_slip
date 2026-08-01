import React from 'react';

interface Props {
  employeeName: string;
  designation: string;
  department: string;
  employeeId: string;
  joiningDate: string;
  paidDays: number;
  lopDays: number;
  bankName: string;
  bankAccount: string;
  ifscCode: string;
  primary: string;
  secondary: string;
}

/** Masks all but the last 4 digits of a bank account number for
    display on the payslip — same convention as the Invoice module's
    own maskAccountNumber (invoiceSettingsStore.ts), duplicated here
    rather than cross-imported since Salary and Invoice are kept
    independent of each other elsewhere in this app. Exported so
    SalarySlipPDF.tsx can reuse it for the Company Bank Details block
    without a third copy. */
export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  const masked = '•'.repeat(digits.length - 4) + digits.slice(-4);
  return (masked.match(/.{1,4}/g) ?? [masked]).join(' ');
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

/** Three bordered, equal-width sections — Employee Details | Employment
    Details | Bank Details. Bank Details shows blank ("—") rows rather
    than hiding the section when an employee has no bank details on
    file, matching Employee/Employment Details' own "—" fallback for
    any empty value. */
export function PDFEmployeeInfo({
  employeeName, designation, department, employeeId, joiningDate, paidDays, lopDays,
  bankName, bankAccount, ifscCode, primary, secondary,
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
        labelWidth={82}
        borderLeft="1px solid #E2E8F0"
        rows={[
          ['Employee ID', employeeId],
          ['Date of Joining', joiningDate],
          ['Paid Days', String(paidDays)],
          ['LOP Days', String(lopDays)],
        ]}
      />
      <Section
        title="Bank Details"
        primary={primary}
        secondary={secondary}
        labelWidth={54}
        borderLeft="1px solid #E2E8F0"
        rows={[
          ['Bank', bankName],
          ['A/C No.', maskAccountNumber(bankAccount)],
          ['IFSC', ifscCode],
        ]}
      />
    </div>
  );
}
