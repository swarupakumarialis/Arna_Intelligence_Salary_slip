import React from 'react';
import { PDFContactLine, PDFContactLineProps } from './PDFContactLine';

interface Props {
  showGeneratedDate: boolean;
  showGeneratedTime: boolean;
  generatedDate: string;
  generatedTime: string;
  showPoweredBy: boolean;
  contact: PDFContactLineProps;
  /* Authorised signature — not explicitly called out in this footer
     spec, but it's an existing Company Settings feature (showSignatory)
     that must keep working; dropping it silently would be a feature
     regression, not a rendering change. */
  showSignatory: boolean;
  signatoryName: string;
  signatoryTitle: string;
  signatoryImageUri: string | null;
}

const LINE = '#E2E8F0';

/** Top separator → computer-generated note (+ signature, if enabled) →
    bottom metadata line with generated date/time. Small gray type throughout. */
export function PDFFooter({
  showGeneratedDate, showGeneratedTime, generatedDate, generatedTime, showPoweredBy,
  contact, showSignatory, signatoryName, signatoryTitle, signatoryImageUri,
}: Props) {
  return (
    <div style={{ marginTop: 'auto', flexShrink: 0 }}>
      <div style={{ height: 1, backgroundColor: LINE, marginBottom: 8 }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: '6.5pt', color: '#94A3B8', fontStyle: 'italic', lineHeight: 1.5 }}>
            This is a computer-generated salary slip and does not require a physical signature.
          </div>
          {(showGeneratedDate || showGeneratedTime) && (
            <div style={{ fontSize: '6.5pt', color: '#94A3B8', fontWeight: 500, marginTop: 4 }}>
              {showGeneratedDate && `Generated ${generatedDate}`}
              {showGeneratedDate && showGeneratedTime && ' · '}
              {showGeneratedTime && generatedTime}
            </div>
          )}
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
            <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 4, width: 150 }}>
              {signatoryName && <div style={{ fontSize: '7pt', fontWeight: 700, color: '#1F2937' }}>{signatoryName}</div>}
              <div style={{ fontSize: '6.5pt', color: '#6B7280' }}>{signatoryTitle}</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <PDFContactLine {...contact} />
        {showPoweredBy && (
          <div style={{ fontSize: '6pt', color: '#CBD5E1', letterSpacing: '0.03em', flexShrink: 0 }}>
            Powered by ARNA Salary Slip Generator
          </div>
        )}
      </div>
    </div>
  );
}
