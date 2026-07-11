import React from 'react';

/* Small inline icons for the GSTIN/PAN/Website/Email/Phone metadata
   line — shared between PDFHeader and PDFFooter since both render the
   identical bar per the spec, just in two different places on the page. */
const IcoGstin = () => (
  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/>
  </svg>
);
const IcoPan = () => (
  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="9" cy="12" r="2.5"/><line x1="14" y1="9" x2="19" y2="9"/><line x1="14" y1="12" x2="19" y2="12"/><line x1="14" y1="15" x2="17" y2="15"/>
  </svg>
);
const IcoWeb = () => (
  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);
const IcoEmail = () => (
  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>
);
const IcoPhone = () => (
  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.37 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l1.62-.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

export interface PDFContactLineProps {
  gstin?: string;
  pan?: string;
  website?: string;
  email?: string;
  phone?: string;
}

const Chip = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
    <span style={{ color: '#9CA3AF', display: 'flex', alignItems: 'center' }}>{icon}</span>
    <strong style={{ color: '#64748B', fontWeight: 600 }}>{label}:</strong>
    <span style={{ color: '#94A3B8' }}>{value}</span>
  </span>
);

const Pipe = () => (
  <span style={{ color: '#D1D5DB', padding: '0 6px', userSelect: 'none', lineHeight: 1 }}>|</span>
);

/** GSTIN | PAN | Website | Email | Phone — one row, empty fields auto-hidden. */
export function PDFContactLine({ gstin, pan, website, email, phone }: PDFContactLineProps) {
  const chips: React.ReactNode[] = [];
  if (gstin)   chips.push(<Chip icon={<IcoGstin />} label="GSTIN" value={gstin} />);
  if (pan)     chips.push(<Chip icon={<IcoPan />} label="PAN" value={pan} />);
  if (website) chips.push(<Chip icon={<IcoWeb />} label="Web" value={website} />);
  if (email)   chips.push(<Chip icon={<IcoEmail />} label="Email" value={email} />);
  if (phone)   chips.push(<Chip icon={<IcoPhone />} label="Ph" value={phone} />);

  if (chips.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '6.5pt', minWidth: 0 }}>
      {chips.map((chip, i) => (
        <React.Fragment key={i}>{i > 0 && <Pipe />}{chip}</React.Fragment>
      ))}
    </div>
  );
}
