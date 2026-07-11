import React from 'react';
import { SalaryData, TaxConfig } from '../types';
import { formatCurrency, amountToWords } from '../utils/currency';
import { withAlpha } from '../utils/color';
import { BrandConfig } from '../App';

/* ── Inline SVG icons for employee info + contact bar ─────────── */
const IconUser = ({ c }: { c: string }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconBriefcase = ({ c }: { c: string }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
  </svg>
);
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

interface Props {
  data: SalaryData;
  previewRef: React.RefObject<HTMLDivElement | null>;
  taxConfig?: TaxConfig;
  brand: BrandConfig;
}

/* Structural lines/dividers are neutral gray, not brand-coloured — this
   is what actually reads as "minimal corporate" instead of "colourful":
   the brand colours are reserved for text, thin accents, and the one
   deliberate highlight (Net Pay), never for large fills. */
const LINE = '#E2E8F0';
const LINE_SOFT = '#EEF1F5';
const HEADER_BG = '#F8FAFC';

export function SalarySlipPreview({ data, previewRef, taxConfig, brand }: Props) {

  /* ── Brand tokens — the only two colours this document uses ──── */
  const primary   = brand.primaryColour   || '#0F172A';
  const secondary = brand.secondaryColour || '#5EEAD4';

  /* ── Company identity ─────────────────────────────────────── */
  const companyName    = brand.companyName    || 'Company Name';
  const companyAddress = brand.companyAddress || '';
  const logoSrc         = brand.logoDataUri    || null;

  /* ── 13 granular display flags ────────────────────────────── */
  const showLogo          = brand.showLogo          ?? true;
  const showCompanyName   = brand.showCompanyName   ?? true;
  const showCompanyAddr   = brand.showCompanyAddress ?? true;
  const showGstin         = brand.showGstin         ?? true;
  const showPan           = brand.showPan           ?? true;
  const showWebsite       = brand.showWebsite       ?? true;
  const showEmail         = brand.showEmail         ?? true;
  const showPhone         = brand.showPhone         ?? true;
  const showNameWatermark = brand.showNameWatermark ?? false;
  const showSignatory     = brand.showSignatory     ?? false;
  const showPoweredBy     = brand.showPoweredBy     ?? true;
  const showGeneratedDate = brand.showGeneratedDate ?? true;
  const showGeneratedTime = brand.showGeneratedTime ?? true;

  const signatoryName     = brand.signatoryName     || '';
  const signatoryTitle    = brand.signatoryTitle    || 'Authorised Signatory';
  const signatoryImageUri = brand.signatoryImageUri || null;

  /* ── Contact row: only show field when flag is ON and value exists */
  const hasGstin   = showGstin   && !!brand.gstin?.trim();
  const hasPan     = showPan     && !!brand.pan?.trim();
  const hasWebsite = showWebsite && !!brand.website?.trim();
  const hasEmail   = showEmail   && !!brand.email?.trim();
  const hasPhone   = showPhone   && !!brand.phone?.trim();
  const hasContact = hasGstin || hasPan || hasWebsite || hasEmail || hasPhone;

  const companyAddressJoined = companyAddress
    .split(/\n+/)
    .map(s => s.trim())
    .filter(Boolean)
    .join(', ');

  /* ── Calculations (untouched) ─────────────────────────────── */
  const totalEarnings   = data.earnings.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const totalDeductions = data.deductions.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const netPay          = totalEarnings - totalDeductions;

  const currency    = taxConfig?.currency || 'INR';
  const locale      = taxConfig?.locale   || 'en-IN';
  const fmt         = (n: number) => formatCurrency(n, currency, locale);
  const netPayWords = amountToWords(netPay, currency);

  const now   = new Date();
  const today = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const time  = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const formatDate = (d: string) => {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return d; }
  };

  /* ── Company name — never wraps. Font steps down for long legal
     names; whiteSpace:nowrap + ellipsis is the hard guarantee even a
     stepped scale can't fully promise on its own. */
  const nameLen = companyName.length;
  const companyNameFontSize =
    nameLen > 55 ? 14 : nameLen > 45 ? 16 : nameLen > 36 ? 18 : nameLen > 28 ? 20 : nameLen > 20 ? 22 : 24;

  /* ── Watermark — one centred mark using the uploaded logo (falls
     back to company initials), not tiled text. Scaled proportionally
     via objectFit so it never distorts, and kept to ~4.5% opacity so
     it sits behind content without ever competing with it. */
  const companyInitials = companyName
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4) || 'CO';

  /* ── Table rows ───────────────────────────────────────────── */
  const dataRows = Math.max(data.earnings.length, data.deductions.length);
  const minRows  = Math.max(dataRows, 8);

  /* Dynamic row sizing — the table has a fixed height budget on the
     page regardless of how many earnings/deductions exist. Rather
     than let extra rows overflow past the page (invisibly clipped by
     the page's overflow:hidden) or truncate real data, row padding
     and font size step down as row count grows, so 15-20 line items
     still fit within the same table area a typical 8-row payslip does. */
  const rowPadY        = dataRows > 16 ? 3   : dataRows > 12 ? 5    : dataRows > 9 ? 7    : 8;
  const cellFontSize   = dataRows > 16 ? '6.5pt' : dataRows > 12 ? '7pt' : dataRows > 9 ? '7.5pt' : '8pt';
  const cellLineHeight = dataRows > 12 ? 1.3 : 1.45;

  const rowBg = (idx: number): string => (idx % 2 === 1 ? '#FAFBFC' : '#FFFFFF');

  /* ── Shared tokens ────────────────────────────────────────── */
  const FONT = "'Inter', 'Segoe UI', system-ui, Arial, sans-serif";

  const cellSt: React.CSSProperties = {
    padding: `${rowPadY}px 12px`,
    fontSize: cellFontSize,
    lineHeight: cellLineHeight,
    verticalAlign: 'middle',
    color: '#1F2937',
    fontVariantNumeric: 'tabular-nums',
  };

  const ContactChip = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <span style={{ color: '#9CA3AF', display: 'flex', alignItems: 'center' }}>{icon}</span>
      <strong style={{ color: '#64748B', fontWeight: 600 }}>{label}:</strong>
      <span style={{ color: '#94A3B8' }}>{value}</span>
    </span>
  );

  const Pipe = () => (
    <span style={{ color: '#D1D5DB', padding: '0 6px', userSelect: 'none', lineHeight: 1 }}>|</span>
  );

  /* ─────────────────────────────────────────────────────────── */

  return (
    <div
      ref={previewRef}
      id="printable-area"
      style={{
        width: '210mm',
        height: '297mm',
        padding: '10mm 12mm',
        boxSizing: 'border-box',
        fontFamily: FONT,
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

      {/* ══ WATERMARK — single centred mark, logo or initials ═══ */}
      {showNameWatermark && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 2, userSelect: 'none', overflow: 'hidden',
        }}>
          {logoSrc ? (
            <img src={logoSrc} alt="" style={{ width: '60%', height: '60%', objectFit: 'contain', opacity: 0.045 }} />
          ) : (
            <div style={{ fontSize: 190, fontWeight: 800, color: primary, opacity: 0.045, letterSpacing: '0.03em', lineHeight: 1 }}>
              {companyInitials}
            </div>
          )}
        </div>
      )}

      {/* ══ CONTENT LAYER ══════════════════════════════════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', zIndex: 3, minHeight: 0 }}>

        {/* ── HEADER ───────────────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          paddingBottom: 9, flexShrink: 0,
        }}>

          {/* Left ~64%: logo + name + address */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 64%', minWidth: 0, paddingRight: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {showLogo && logoSrc && (
                <img src={logoSrc} alt={companyName} style={{ width: 92, height: 44, objectFit: 'contain', flexShrink: 0, display: 'block' }} />
              )}
              {showCompanyName && (
                <div style={{
                  fontSize: companyNameFontSize,
                  fontWeight: 700,
                  color: primary,
                  lineHeight: 1.2,
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                }}>
                  {companyName}
                </div>
              )}
            </div>
            {showCompanyAddr && companyAddressJoined && (
              <div style={{
                fontSize: '7.5pt', color: '#64748B', lineHeight: 1.55,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                overflow: 'hidden', wordBreak: 'break-word',
              }}>
                {companyAddressJoined}
              </div>
            )}
          </div>

          {/* Right ~36%: Salary Slip label + period */}
          <div style={{ flex: '0 0 36%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{
              fontSize: '9pt', fontWeight: 800, color: primary,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              paddingBottom: 4, marginBottom: 7,
              borderBottom: `2px solid ${secondary}`,
            }}>
              Salary Slip
            </div>
            <div style={{ fontSize: '11pt', fontWeight: 700, color: '#111827', textAlign: 'right' }}>
              {data.salary.month} {data.salary.year}
            </div>
            <div style={{ fontSize: '6.5pt', color: '#9CA3AF', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginTop: 2, textAlign: 'right' }}>
              Pay Period
            </div>
          </div>
        </div>

        {/* ── EMPLOYEE INFORMATION — two equal columns, label:value ── */}
        <div style={{ display: 'flex', marginBottom: 9, flexShrink: 0, border: `1px solid ${LINE}`, borderRadius: 4 }}>
          {([
            {
              title: 'Employee Details',
              Icon: IconUser,
              rows: [
                ['Name', data.employee.name],
                ['Designation', data.employee.designation],
                ['Department', data.employee.department],
              ] as [string, string][],
              lw: 78,
            },
            {
              title: 'Employment Details',
              Icon: IconBriefcase,
              rows: [
                ['Employee ID', data.employee.id],
                ['Date of Joining', formatDate(data.employee.doj)],
                ['Paid Days', String(data.salary.paidDays)],
                ['LOP Days', String(data.salary.lopDays)],
              ] as [string, string][],
              lw: 100,
            },
          ]).map((card, ci) => (
            <div key={card.title} style={{
              flex: 1, padding: '9px 14px',
              borderLeft: ci > 0 ? `1px solid ${LINE}` : undefined,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: '7pt', fontWeight: 700, color: primary,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                marginBottom: 7, paddingBottom: 5,
                borderBottom: `1.5px solid ${secondary}`,
              }}>
                <card.Icon c={primary} />
                {card.title}
              </div>
              {card.rows.map(([label, value]) => (
                <div key={label} style={{ display: 'flex', marginBottom: 3, alignItems: 'baseline' }}>
                  <span style={{ width: card.lw, flexShrink: 0, fontSize: '7.5pt', color: '#9CA3AF', lineHeight: 1.5 }}>{label}</span>
                  <span style={{ fontSize: '7.5pt', color: '#D1D5DB', marginRight: 7, lineHeight: 1.5 }}>:</span>
                  <span style={{ fontSize: '8pt', fontWeight: 600, color: '#1F2937', flex: 1, lineHeight: 1.5 }}>{value || '—'}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* ── EARNINGS / DEDUCTIONS TABLE ─────────────────────── */}
        <div style={{
          flex: 1, marginBottom: 9,
          border: `1px solid ${LINE}`, borderRadius: 4, overflow: 'hidden',
          display: 'flex', flexDirection: 'column', minHeight: 0,
        }}>
          {/* Header — light gray, bold, no dark fill */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 104px 1fr 104px', backgroundColor: HEADER_BG, borderBottom: `1px solid ${LINE}`, flexShrink: 0 }}>
            {([
              { label: 'Description', align: 'left' as const },
              { label: 'Amount', align: 'right' as const },
              { label: 'Description', align: 'left' as const, div: true },
              { label: 'Amount', align: 'right' as const },
            ]).map((col, i) => (
              <div key={i} style={{
                padding: '7px 12px', fontSize: '7pt', fontWeight: 700, color: primary,
                textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: col.align,
                borderLeft: col.div ? `1px solid ${LINE}` : undefined,
              }}>
                {i === 0 ? 'Earnings' : i === 2 ? 'Deductions' : col.label}
              </div>
            ))}
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {Array.from({ length: minRows }).map((_, idx) => {
              const e = data.earnings[idx];
              const d = data.deductions[idx];
              return (
                <div key={idx} style={{
                  display: 'grid', gridTemplateColumns: '1fr 104px 1fr 104px',
                  backgroundColor: rowBg(idx),
                  borderBottom: `1px solid ${LINE_SOFT}`,
                }}>
                  <div style={cellSt}>{e?.name || ''}</div>
                  <div style={{ ...cellSt, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', color: e?.amount ? '#111827' : 'transparent' }}>
                    {e?.amount ? fmt(e.amount) : '·'}
                  </div>
                  <div style={{ ...cellSt, borderLeft: `1px solid ${LINE_SOFT}` }}>{d?.name || ''}</div>
                  <div style={{ ...cellSt, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', color: d?.amount ? '#111827' : 'transparent' }}>
                    {d?.amount ? fmt(d.amount) : '·'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── TOTALS — one elegant row; Net Pay gets a brand border +
             light brand tint instead of a solid dark block ────────── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 9, flexShrink: 0 }}>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', border: `1px solid ${LINE}`, borderRadius: 4 }}>
            <span style={{ fontSize: '7.5pt', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Earnings</span>
            <span style={{ fontSize: '10pt', fontWeight: 800, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmt(totalEarnings)}</span>
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', border: `1px solid ${LINE}`, borderRadius: 4 }}>
            <span style={{ fontSize: '7.5pt', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Deductions</span>
            <span style={{ fontSize: '10pt', fontWeight: 800, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmt(totalDeductions)}</span>
          </div>
          <div style={{
            flex: 1.3, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 16px', border: `1.5px solid ${primary}`, borderRadius: 4,
            backgroundColor: withAlpha(primary, '08'),
          }}>
            <span style={{ fontSize: '8pt', fontWeight: 800, color: primary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Net Pay</span>
            <span style={{ fontSize: '15pt', fontWeight: 800, color: primary, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{fmt(netPay)}</span>
          </div>
        </div>

        {/* ── AMOUNT IN WORDS — subtle bordered strip, one line ── */}
        <div style={{
          border: `1px solid ${LINE}`, borderRadius: 4, padding: '8px 14px', marginBottom: 9,
          display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '6.5pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94A3B8', flexShrink: 0 }}>
            Amount in Words
          </span>
          <span style={{ fontSize: '8.5pt', fontWeight: 600, color: '#1F2937' }}>{netPayWords}</span>
        </div>

        {/* ── FOOTER ──────────────────────────────────────────── */}
        <div style={{ marginTop: 'auto', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 8 }}>
            <div style={{ fontSize: '6.5pt', color: '#94A3B8', fontStyle: 'italic', lineHeight: 1.5 }}>
              This is a computer-generated salary slip and does not require a physical signature.
            </div>
            {showSignatory && (
              <div style={{ flexShrink: 0, textAlign: 'center' }}>
                <div style={{
                  width: 150, height: 46, border: `1px solid ${LINE}`, borderRadius: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: '#FAFBFC', overflow: 'hidden',
                }}>
                  {signatoryImageUri
                    ? <img src={signatoryImageUri} alt="Signature" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    : <span style={{ fontSize: '6.5pt', color: '#D1D5DB', fontStyle: 'italic', userSelect: 'none' }}>Signature</span>}
                </div>
                <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 4, width: 150, marginTop: 0 }}>
                  {signatoryName && <div style={{ fontSize: '7pt', fontWeight: 700, color: '#1F2937' }}>{signatoryName}</div>}
                  <div style={{ fontSize: '6.5pt', color: '#6B7280' }}>{signatoryTitle}</div>
                </div>
              </div>
            )}
          </div>

          <div style={{ height: 1, backgroundColor: LINE, marginBottom: 6 }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            {hasContact ? (() => {
              const chips: React.ReactNode[] = [];
              if (hasGstin)   chips.push(<ContactChip icon={<IcoGstin />} label="GSTIN" value={brand.gstin!} />);
              if (hasPan)     chips.push(<ContactChip icon={<IcoPan />} label="PAN" value={brand.pan!} />);
              if (hasWebsite) chips.push(<ContactChip icon={<IcoWeb />} label="Web" value={brand.website!} />);
              if (hasEmail)   chips.push(<ContactChip icon={<IcoEmail />} label="Email" value={brand.email!} />);
              if (hasPhone)   chips.push(<ContactChip icon={<IcoPhone />} label="Ph" value={brand.phone!} />);
              return (
                <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '6.5pt', minWidth: 0 }}>
                  {chips.map((chip, i) => (
                    <React.Fragment key={i}>{i > 0 && <Pipe />}{chip}</React.Fragment>
                  ))}
                </div>
              );
            })() : <span />}

            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              {(showGeneratedDate || showGeneratedTime) && (
                <div style={{ fontSize: '6.5pt', color: '#94A3B8', fontWeight: 500 }}>
                  {showGeneratedDate && `Generated ${today}`}
                  {showGeneratedDate && showGeneratedTime && ' · '}
                  {showGeneratedTime && time}
                </div>
              )}
              {showPoweredBy && (
                <div style={{ fontSize: '6pt', color: '#CBD5E1', marginTop: 2, letterSpacing: '0.03em' }}>
                  Powered by ARNA Salary Slip Generator
                </div>
              )}
            </div>
          </div>
        </div>

      </div>{/* /content layer */}
    </div>
  );
}
