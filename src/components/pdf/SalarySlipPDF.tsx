import React from 'react';
import { SalaryData, TaxConfig } from '../../types';
import { BrandConfig } from '../../App';
import { formatCurrency, amountToWords } from '../../utils/currency';
import { PDFWatermark } from './PDFWatermark';
import { PDFHeader } from './PDFHeader';
import { PDFEmployeeInfo } from './PDFEmployeeInfo';
import { PDFSalaryTable } from './PDFSalaryTable';
import { PDFTotals } from './PDFTotals';
import { PDFFooter } from './PDFFooter';

interface Props {
  data: SalaryData;
  brand: BrandConfig;
  taxConfig?: TaxConfig;
  pdfRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Dedicated PDF rendering layer — a separate component tree from
 * SalarySlipPreview, built for one job: producing a correct, print-
 * ready A4 page for html2canvas to capture. It consumes the exact same
 * `data`/`brand`/`taxConfig` the live preview does (same business data,
 * same calculations — nothing here computes a number), but owns its
 * own layout entirely. See PDFHeader/PDFEmployeeInfo/PDFSalaryTable/
 * PDFTotals/PDFFooter/PDFWatermark for the individual sections.
 */
export function SalarySlipPDF({ data, brand, taxConfig, pdfRef }: Props) {
  const primary   = brand.primaryColour   || '#0F172A';
  const secondary = brand.secondaryColour || '#5EEAD4';

  const companyName    = brand.companyName    || 'Company Name';
  const companyAddress = brand.companyAddress || '';
  const logoSrc         = brand.logoDataUri    || null;

  const showLogo          = brand.showLogo          ?? true;
  const showCompanyName   = brand.showCompanyName   ?? true;
  const showCompanyAddr   = brand.showCompanyAddress ?? true;
  const showNameWatermark = brand.showNameWatermark ?? false;
  const showSignatory     = brand.showSignatory     ?? false;
  const showPoweredBy     = brand.showPoweredBy     ?? true;
  const showGeneratedDate = brand.showGeneratedDate ?? true;
  const showGeneratedTime = brand.showGeneratedTime ?? true;

  const contact = {
    gstin:   (brand.showGstin   ?? true) ? brand.gstin?.trim()   || undefined : undefined,
    pan:     (brand.showPan     ?? true) ? brand.pan?.trim()     || undefined : undefined,
    website: (brand.showWebsite ?? true) ? brand.website?.trim() || undefined : undefined,
    email:   (brand.showEmail   ?? true) ? brand.email?.trim()   || undefined : undefined,
    phone:   (brand.showPhone   ?? true) ? brand.phone?.trim()   || undefined : undefined,
  };

  /* ── Calculations (untouched — read-only consumption of totals) ── */
  const totalEarnings   = data.earnings.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const totalDeductions = data.deductions.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const netPay          = totalEarnings - totalDeductions;

  const currency = taxConfig?.currency || 'INR';
  const locale   = taxConfig?.locale   || 'en-IN';
  const fmt      = (n: number) => formatCurrency(n, currency, locale);
  const netPayWords = amountToWords(netPay, currency);

  const now = new Date();
  const generatedDate = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const generatedTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const formatDate = (d: string) => {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return d; }
  };

  return (
    <div
      ref={pdfRef}
      id="pdf-export-area"
      style={{
        width: '210mm',
        height: '297mm',
        padding: '10mm 12mm',
        boxSizing: 'border-box',
        fontFamily: "'Inter', 'Segoe UI', system-ui, Arial, sans-serif",
        fontSize: '9pt',
        lineHeight: 1.5,
        color: '#111827',
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <PDFWatermark show={showNameWatermark} companyName={companyName} primary={primary} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', zIndex: 1, minHeight: 0 }}>
        <PDFHeader
          logoSrc={logoSrc}
          showLogo={showLogo}
          companyName={companyName}
          showCompanyName={showCompanyName}
          companyAddress={companyAddress}
          showCompanyAddr={showCompanyAddr}
          contact={contact}
          month={data.salary.month}
          year={data.salary.year}
          primary={primary}
          secondary={secondary}
        />

        <PDFEmployeeInfo
          employeeName={data.employee.name}
          designation={data.employee.designation}
          department={data.employee.department}
          employeeId={data.employee.id}
          joiningDate={formatDate(data.employee.doj)}
          paidDays={Number(data.salary.paidDays) || 0}
          lopDays={Number(data.salary.lopDays) || 0}
          primary={primary}
          secondary={secondary}
        />

        <PDFSalaryTable earnings={data.earnings} deductions={data.deductions} fmt={fmt} primary={primary} />

        <PDFTotals totalEarnings={totalEarnings} totalDeductions={totalDeductions} netPay={netPay} fmt={fmt} primary={primary} />

        {/* Amount in Words — compact bordered row, not a large box */}
        <div style={{
          border: '1px solid #E2E8F0', borderRadius: 4, padding: '8px 14px', marginBottom: 9,
          display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '6.5pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94A3B8', flexShrink: 0 }}>
            Amount in Words
          </span>
          <span style={{ fontSize: '8.5pt', fontWeight: 600, color: '#1F2937' }}>{netPayWords}</span>
        </div>

        <PDFFooter
          showGeneratedDate={showGeneratedDate}
          showGeneratedTime={showGeneratedTime}
          generatedDate={generatedDate}
          generatedTime={generatedTime}
          showPoweredBy={showPoweredBy}
          contact={contact}
          showSignatory={showSignatory}
          signatoryName={brand.signatoryName || ''}
          signatoryTitle={brand.signatoryTitle || 'Authorised Signatory'}
          signatoryImageUri={brand.signatoryImageUri || null}
        />
      </div>
    </div>
  );
}
