import React from 'react';
import { InvoiceDetails } from '../../types';
import { StatusBadge, BadgeTone } from '../../../../components/ui/StatusBadge';

interface Props {
  companyName: string;
  companyAddress: string;
  logoDataUri: string | null;
  accentColor: string;
  invoice: InvoiceDetails;
}

/** Overdue reads as 'danger'; Partially Paid as 'warning'; Cancelled
    shares Draft's 'neutral' tone — same convention InvoiceHistoryPage's
    STATUS_TONE uses, kept in sync deliberately (both read the same
    INVOICE_STATUSES values). */
const STATUS_TONE: Record<InvoiceDetails['status'], BadgeTone> = {
  Draft: 'neutral', Sent: 'info', Paid: 'success', 'Partially Paid': 'warning', Overdue: 'danger', Cancelled: 'neutral',
};

/** Top-of-invoice band (Sprint 6 premium redesign): company identity
    (logo/name/address — the same BrandConfig every other document in
    this app already reads, via loadCompanySettings; see
    InvoicePreview.tsx) on the left, the "INVOICE" wordmark + a status
    badge on the right. Invoice Number/Date/Due Date/Terms moved out of
    this band into the new InvoiceMeta component, which InvoicePreview
    now renders side-by-side with Bill To — a two-column "info band"
    matching how Stripe/QuickBooks/FreshBooks lay out this section,
    rather than cramming meta into the header itself. */
export function InvoiceHeader({ companyName, companyAddress, logoDataUri, accentColor, invoice }: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 0 }}>
        {logoDataUri && (
          <img src={logoDataUri} alt={companyName} style={{ height: 46, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
        )}
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.015em', lineHeight: 1.3 }}>
            {companyName}
          </p>
          {companyAddress && (
            <p style={{ fontSize: 10.5, color: '#64748B', margin: '5px 0 0', whiteSpace: 'pre-line', lineHeight: 1.6, maxWidth: 280 }}>
              {companyAddress}
            </p>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <p style={{ fontSize: 26, fontWeight: 800, color: accentColor, margin: 0, letterSpacing: '0.04em' }}>INVOICE</p>
        <StatusBadge label={invoice.status} tone={STATUS_TONE[invoice.status]} />
      </div>
    </div>
  );
}
