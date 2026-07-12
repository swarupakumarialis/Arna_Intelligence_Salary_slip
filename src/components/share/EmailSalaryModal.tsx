import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mail, X, Loader2, Paperclip } from 'lucide-react';
import { buildEmailSubject, buildEmailBody } from './EmailTemplate';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  /** Looked up from the Employee Directory by the caller — may be empty if the record has no email on file, in which case the field is just left for manual entry. */
  employeeEmail: string;
  month: string;
  year: string | number;
  sending: boolean;
  onSend: (to: string, subject: string) => void;
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10.5, fontWeight: 600, color: 'var(--clr-text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5,
};

/**
 * "Email Employee" modal (Sprint 5.5) — collects/edits the recipient
 * and subject, previews the fixed body copy and the PDF that will be
 * attached, then hands {to, subject} to onSend. It does not generate
 * or fetch the PDF itself: App.tsx's handleEmailEmployee locates the
 * already-archived PDF for the current employee/month/year and calls
 * the backend email-send endpoint, which reads that stored file —
 * never regenerating it here or server-side.
 */
export function EmailSalaryModal({
  isOpen, onClose, employeeName, employeeEmail, month, year, sending, onSend,
}: Props) {
  const [to, setTo] = useState(employeeEmail);
  const [subject, setSubject] = useState(buildEmailSubject({ month, year }));

  /* Re-seed the fields from the current payslip context every time the
     modal opens, so switching employees/periods before opening it again
     doesn't leave stale text from a previous send. */
  useEffect(() => {
    if (!isOpen) return;
    setTo(employeeEmail);
    setSubject(buildEmailSubject({ month, year }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const canSend = to.trim().length > 0 && !sending;
  const body = buildEmailBody({ employeeName, month, year });

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
            <label style={labelStyle}>Message (preview)</label>
            <textarea
              className="field"
              value={body}
              readOnly
              rows={8}
              style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, background: 'var(--clr-bg)', color: 'var(--clr-text-muted)', cursor: 'default' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 7, alignItems: 'center', padding: '9px 11px', background: 'var(--clr-bg)', borderRadius: 8, fontSize: 11.5, color: 'var(--clr-text-subtle)' }}>
            <Paperclip size={13} style={{ flexShrink: 0 }} />
            <span>The stored salary slip PDF for {month} {year} will be attached automatically from the PDF Archive.</span>
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
