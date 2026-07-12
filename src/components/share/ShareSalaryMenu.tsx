import React from 'react';
import { Send, Link2, Sparkles } from 'lucide-react';

interface Props {
  onGmail: () => void;
  onOutlook: () => void;
  disabled?: boolean;
}

const itemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
  padding: '8px 12px', border: 'none', background: 'transparent',
  fontSize: 12.5, fontWeight: 600, color: 'var(--clr-text)',
  textAlign: 'left', cursor: 'pointer', borderRadius: 8,
  transition: 'background 150ms',
};

/**
 * Future-ready share channels for a generated salary slip. Gmail and
 * Outlook open that provider's web compose window pre-filled with the
 * recipient/subject/body (same template as EmailSalaryModal) — like
 * mailto, neither web compose API can accept a file attachment from a
 * page, so both trigger a PDF download first, same as the email modal.
 * "Copy Secure Link" is a deliberate placeholder: sharing a private
 * payslip via a link needs a backend to host it behind auth (Google
 * Drive integration is planned for Sprint 5.6) — it's disabled rather
 * than faked. No "Download PDF" item here (Sprint 5.5) — it duplicated
 * the adjacent Export PDF button.
 */
export function ShareSalaryMenu({ onGmail, onOutlook, disabled }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <button
        style={itemStyle}
        disabled={disabled}
        onClick={onGmail}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--clr-hover)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <Send size={14} style={{ color: 'var(--arna-accent)' }} />
        Gmail
      </button>
      <button
        style={itemStyle}
        disabled={disabled}
        onClick={onOutlook}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--clr-hover)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <Send size={14} style={{ color: 'var(--arna-accent)' }} />
        Outlook
      </button>
      <div
        style={{ ...itemStyle, cursor: 'not-allowed', color: 'var(--clr-text-subtle)', justifyContent: 'space-between' }}
        title="Sharing a private payslip via link needs a backend — coming in a future sprint."
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Link2 size={14} />
          Copy Secure Link
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 700, color: 'var(--clr-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <Sparkles size={10} /> Soon
        </span>
      </div>
    </div>
  );
}
