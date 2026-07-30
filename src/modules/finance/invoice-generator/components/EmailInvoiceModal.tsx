import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mail, X, Loader2, Paperclip } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  invoiceNumber: string;
  customerEmail: string;
  companyName: string;
  sending: boolean;
  onSend: (to: string, subject: string) => void;
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10.5, fontWeight: 600, color: 'var(--clr-text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5,
};

/** "Email Invoice" modal (Sprint 5) — the Invoice module's own
    independent counterpart to src/components/share/EmailSalaryModal.tsx
    (same layout/shape), collecting/editing the recipient and subject
    before handing {to, subject} to onSend. Does not generate or send
    anything itself — InvoiceGeneratorPage's handleSendEmail owns
    generating the PDF and calling the backend. */
export function EmailInvoiceModal({ isOpen, onClose, invoiceNumber, customerEmail, companyName, sending, onSend }: Props) {
  const [to, setTo] = useState(customerEmail);
  const [subject, setSubject] = useState(`Invoice ${invoiceNumber}${companyName ? ` from ${companyName}` : ''}`);

  useEffect(() => {
    if (!isOpen) return;
    setTo(customerEmail);
    setSubject(`Invoice ${invoiceNumber}${companyName ? ` from ${companyName}` : ''}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const canSend = to.trim().length > 0 && !sending;

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={() => !sending && onClose()}
    >
      <div
        style={{ background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: '100%', maxWidth: 440, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--clr-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: 'var(--clr-text)' }}>
            <Mail size={15} style={{ color: 'var(--arna-accent)' }} />
            Email Invoice
          </span>
          <button
            onClick={onClose}
            disabled={sending}
            aria-label="Close"
            style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: sending ? 'not-allowed' : 'pointer', color: '#64748B' }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Customer Email</label>
            <input
              type="email" className="field" value={to} onChange={e => setTo(e.target.value)}
              placeholder="customer@company.com" disabled={sending}
            />
          </div>

          <div>
            <label style={labelStyle}>Subject</label>
            <input type="text" className="field" value={subject} onChange={e => setSubject(e.target.value)} disabled={sending} />
          </div>

          <div style={{ display: 'flex', gap: 7, alignItems: 'center', padding: '9px 11px', background: 'var(--clr-bg)', borderRadius: 8, fontSize: 11.5, color: 'var(--clr-text-subtle)' }}>
            <Paperclip size={13} style={{ flexShrink: 0 }} />
            <span>Invoice {invoiceNumber} will be attached as a PDF, generated fresh from the current invoice data.</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--clr-border)', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} disabled={sending} className="btn btn-secondary" style={{ fontSize: 12.5 }}>Cancel</button>
          <button
            onClick={() => onSend(to.trim(), subject)}
            disabled={!canSend}
            className="btn btn-dark"
            style={{ fontSize: 12.5, opacity: canSend ? 1 : 0.6 }}
          >
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
            {sending ? 'Sending…' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
