import React from 'react';
import { PDFContactLine, PDFContactLineProps } from './PDFContactLine';

interface Props {
  logoSrc: string | null;
  showLogo: boolean;
  companyName: string;
  showCompanyName: boolean;
  companyAddress: string;
  showCompanyAddr: boolean;
  contact: PDFContactLineProps;
  month: string;
  year: string | number;
  primary: string;
  secondary: string;
}

/**
 * Three-column header: logo (20%) | identity + contact (55%) | pay
 * period (25%). Pure flexbox — no absolute positioning — so it lays
 * out the same way regardless of which engine renders it.
 */
/** Truncates plain text with a JS-computed ellipsis rather than the CSS
    `overflow:hidden` + `text-overflow:ellipsis`/`-webkit-line-clamp`
    combo — html2canvas measures clipped/ellipsis boxes inconsistently
    with the live DOM, which was slicing the tops off the company name
    and address in the exported PDF even though the same CSS looked
    fine on screen. Truncating the string itself sidesteps that
    entirely: the rendered box only ever needs to fit text that's
    already short enough, so there's nothing left for either engine to
    clip. */
function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars - 1).trimEnd()}…` : text;
}

export function PDFHeader({
  logoSrc, showLogo, companyName, showCompanyName,
  companyAddress, showCompanyAddr, contact, month, year, primary, secondary,
}: Props) {
  /* Company name never wraps or overflows its column: font size steps
     down for longer names, and a hard character cap is the guarantee
     even if a name is long enough to need every step. */
  const nameLen = companyName.length;
  const nameFontSize =
    nameLen > 55 ? 13 : nameLen > 45 ? 15 : nameLen > 36 ? 17 : nameLen > 28 ? 19 : nameLen > 20 ? 21 : 23;
  const nameDisplay = truncate(companyName, 60);

  const addressJoined = companyAddress
    .split(/\n+/)
    .map(s => s.trim())
    .filter(Boolean)
    .join(', ');
  const addressDisplay = truncate(addressJoined, 120);

  return (
    <div style={{ display: 'flex', width: '100%', alignItems: 'flex-start', paddingTop: 2, paddingBottom: 9 }}>

      {/* LEFT 20% — logo, fixed box so no rendering engine has to guess its
          size. Wide (not square) to match the logo artwork's real aspect
          ratio — a horizontal icon + wordmark lockup, roughly 3.15:1. A
          square box would constrain it to its width, letterboxing most
          of the box empty and rendering the logo much smaller than
          necessary (this was the earlier bug). */}
      <div style={{ flex: '0 0 20%', display: 'flex', alignItems: 'flex-start', minWidth: 0 }}>
        {showLogo && logoSrc && (
          <img src={logoSrc} alt={companyName} style={{ width: 128, height: 41, objectFit: 'contain', objectPosition: 'left center', display: 'block' }} />
        )}
      </div>

      {/* CENTER 55% — name, address, contact metadata */}
      <div style={{ flex: '0 0 55%', minWidth: 0, paddingRight: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {showCompanyName && (
          <div style={{
            fontSize: nameFontSize, fontWeight: 700, color: primary,
            lineHeight: 1.4, letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
          }}>
            {nameDisplay}
          </div>
        )}
        {showCompanyAddr && addressDisplay && (
          <div style={{
            fontSize: '7.5pt', color: '#64748B', lineHeight: 1.55,
            wordBreak: 'break-word', overflowWrap: 'anywhere',
          }}>
            {addressDisplay}
          </div>
        )}
        <PDFContactLine {...contact} />
      </div>

      {/* RIGHT 25% — Salary Slip label + pay period, right aligned */}
      <div style={{ flex: '0 0 25%', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <div style={{
          fontSize: '9pt', fontWeight: 800, color: primary,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          paddingBottom: 4, marginBottom: 6,
          borderBottom: `2px solid ${secondary}`,
        }}>
          Salary Slip
        </div>
        <div style={{ fontSize: '11pt', fontWeight: 700, color: '#111827', textAlign: 'right' }}>
          {month} {year}
        </div>
        <div style={{ fontSize: '6.5pt', color: '#9CA3AF', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginTop: 2, textAlign: 'right' }}>
          Pay Period
        </div>
      </div>
    </div>
  );
}
