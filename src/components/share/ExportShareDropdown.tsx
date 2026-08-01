import React, { useEffect, useRef, useState } from 'react';
import { Mail, Share2, ChevronRight, ChevronLeft } from 'lucide-react';
import { ShareSalaryMenu } from './ShareSalaryMenu';

interface Props {
  onEmailEmployee: () => void;
  onGmail: () => void;
  onOutlook: () => void;
  disabled?: boolean;
}

const itemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 9, width: '100%',
  padding: '8px 12px', border: 'none', background: 'transparent',
  fontSize: 12.5, fontWeight: 600, color: 'var(--clr-text)',
  textAlign: 'left', cursor: 'pointer', borderRadius: 8,
  transition: 'background 150ms',
};

/**
 * Dropdown next to the existing Export PDF button — every way a
 * generated salary slip can leave the app besides that direct
 * download: Email Employee (opens EmailSalaryModal) and Share (expands
 * in place to ShareSalaryMenu's Gmail/Outlook/Copy Link options). No
 * "Download PDF" item here (Sprint 5.5) — it duplicated the adjacent
 * Export PDF button. Purely presentational — every click just calls
 * back into App.tsx, which owns PDF generation, validation, and
 * activity logging.
 */
export function ExportShareDropdown({ onEmailEmployee, onGmail, onOutlook, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowShare(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const close = () => { setOpen(false); setShowShare(false); };

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={disabled}
        className="btn-icon"
        title="Share"
        aria-label="Share"
        style={{
          width: 36, height: 36, border: '1px solid var(--clr-border)', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--clr-surface)', opacity: disabled ? 0.5 : 1,
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Share2 size={15} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: 0, right: 'calc(100% + 8px)', zIndex: 50,
            width: 220, background: '#fff', border: '1px solid var(--clr-border)',
            borderRadius: 10, boxShadow: '0 12px 28px rgba(15,23,42,0.16)',
            padding: 6,
          }}
        >
          {!showShare ? (
            <>
              <button
                style={itemStyle}
                onClick={() => { close(); onEmailEmployee(); }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--clr-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Mail size={14} style={{ color: 'var(--arna-accent)' }} />
                  Email Employee
                </span>
              </button>
              <button
                style={itemStyle}
                onClick={() => setShowShare(true)}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--clr-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Share2 size={14} style={{ color: 'var(--arna-accent)' }} />
                  Share
                </span>
                <ChevronRight size={13} style={{ color: 'var(--clr-text-subtle)' }} />
              </button>
            </>
          ) : (
            <>
              <button
                style={{ ...itemStyle, color: 'var(--clr-text-muted)', fontSize: 11.5 }}
                onClick={() => setShowShare(false)}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--clr-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ChevronLeft size={13} />
                  Share via
                </span>
              </button>
              <div style={{ height: 1, background: 'var(--clr-border)', margin: '4px 0' }} />
              <ShareSalaryMenu
                onGmail={() => { close(); onGmail(); }}
                onOutlook={() => { close(); onOutlook(); }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
