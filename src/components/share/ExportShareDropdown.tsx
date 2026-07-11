import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, Mail, Share2, ChevronRight, ChevronLeft } from 'lucide-react';
import { ShareSalaryMenu } from './ShareSalaryMenu';

interface Props {
  onDownloadPDF: () => void;
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
 * Dropdown next to the existing Export PDF button — the single entry
 * point for every way a generated salary slip can leave the app:
 * Download PDF (same action as the Export PDF button), Email Employee
 * (opens EmailSalaryModal), and Share (expands in place to
 * ShareSalaryMenu's Gmail/Outlook/Copy Link/Download options). Purely
 * presentational — every click just calls back into App.tsx, which
 * owns PDF generation, validation, and activity logging.
 */
export function ExportShareDropdown({ onDownloadPDF, onEmailEmployee, onGmail, onOutlook, disabled }: Props) {
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
        className="btn btn-secondary"
        style={{ fontSize: 12, opacity: disabled ? 0.5 : 1 }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Share2 size={13} /> Share <ChevronDown size={12} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
            width: 220, background: '#fff', border: '1px solid var(--clr-border)',
            borderRadius: 10, boxShadow: '0 12px 28px rgba(15,23,42,0.16)',
            padding: 6,
          }}
        >
          {!showShare ? (
            <>
              <button
                style={itemStyle}
                onClick={() => { close(); onDownloadPDF(); }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--clr-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Download size={14} style={{ color: 'var(--clr-text-muted)' }} />
                  Download PDF
                </span>
              </button>
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
                onDownloadPDF={() => { close(); onDownloadPDF(); }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
