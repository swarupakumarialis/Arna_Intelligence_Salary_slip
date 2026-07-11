import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mail, X, Loader2, Info } from 'lucide-react';
import { buildEmailSubject, buildEmailBody } from './EmailTemplate';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  /** Looked up from the Employee Directory by the caller — may be empty if the record has no email on file, in which case the field is just left for manual entry. */
  employeeEmail: string;
  month: string;
  year: string | number;
  companyName: string;
  sending: boolean;
  onSend: (to: string, subject: string, message: string) => void;
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10.5, fontWeight: 600, color: 'var(--clr-text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5,
};

/**
 * "Email Employee" modal — collects/edits the recipient, subject, and
 * message, then hands them to onSend. It does not itself generate the
 * PDF or send anything; App.tsx owns that (see generateSalarySlipPdf +
 * handleEmailEmployee), keeping this component pure UI.
 */
export function EmailSalaryModal({
  isOpen, onClose, employeeName, employeeEmail, month, year, companyName, sending, onSend,
}: Props) {
  const [to, setTo] = useState(employeeEmail);
  const [subject, setSubject] = useState(buildEmailSubject({ month, year }));
  const [message, setMessage] = useState(buildEmailBody({ employeeName, month, year, companyName }));

  /* Re-seed the fields from the current payslip context every time the
     modal opens, so switching employees/periods before opening it again
     doesn't leave stale text from a previous send. */
  useEffect(() => {
    if (!isOpen) return;
    setTo(employeeEmail);
    setSubject(buildEmailSubject({ month, year }));
    setMessage(buildEmailBody({ employeeName, month, year, companyName }));
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
        style={{ background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: '100%', maxWidth: 480, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--clr-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: 'var(--clr-text)' }}>
            <Mail size={15} style={{ color: 'var(--arna-accent)' }} />
            Email Salary Slip
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
            <label style={labelStyle}>Employee Email</label>
            <input
              type="email"
              className="field"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="employee@company.com"
              disabled={sending}
            />
          </div>

          <div>
            <label style={labelStyle}>Subject</label>
            <input
              type="text"
              className="field"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              disabled={sending}
            />
          </div>

          <div>
            <label style={labelStyle}>Message</label>
            <textarea
              className="field"
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={8}
              style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
              disabled={sending}
            />
          </div>

          <div style={{ display: 'flex', gap: 7, padding: '9px 11px', background: 'var(--clr-bg)', borderRadius: 8, fontSize: 11, color: 'var(--clr-text-subtle)', lineHeight: 1.6 }}>
            <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>The salary slip PDF will download automatically and your email app will open pre-filled — browsers don't allow web pages to attach files to an email for you, so please attach the downloaded PDF before sending.</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--clr-border)', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} disabled={sending} className="btn btn-secondary" style={{ fontSize: 12.5 }}>Cancel</button>
          <button
            onClick={() => onSend(to.trim(), subject, message)}
            disabled={!canSend}
            className="btn btn-dark"
            style={{ fontSize: 12.5, opacity: canSend ? 1 : 0.6 }}
          >
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
            {sending ? 'Preparing…' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
