import React from 'react';
import { Minus, Plus, Maximize, Printer, Download, Loader2 } from 'lucide-react';

interface Props {
  zoomPct: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSetZoom: (pct: number) => void;
  onFitToScreen: () => void;
  /** Sprint 5 — Print/Download PDF are real actions now (see
      InvoiceGeneratorPage's handlePrint/handleDownload); both stay
      disabled until the invoice has been saved at least once
      (no invoiceNumber to print/download yet otherwise). */
  onPrint?: () => void;
  onDownload?: () => void;
  actionsDisabled?: boolean;
  downloading?: boolean;
}

const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200];

/** Zoom/view controls for the Invoice Preview (Sprint 3 zoom, Sprint 5
    Print/Download) — a module-local counterpart to
    components/preview/PreviewToolbar.tsx, reusing that component's CSS
    classes (.preview-toolbar*, already global, presentational-only
    styling) for visual consistency with the Salary Generator's Live
    Preview, without importing or modifying that component itself. */
export function PreviewToolbar({
  zoomPct, onZoomIn, onZoomOut, onSetZoom, onFitToScreen, onPrint, onDownload, actionsDisabled, downloading,
}: Props) {
  return (
    <div className="preview-toolbar">
      <button className="preview-toolbar-btn" onClick={onZoomOut} title="Zoom Out" aria-label="Zoom Out">
        <Minus size={13} />
      </button>
      <select
        className="preview-toolbar-zoom"
        value={ZOOM_PRESETS.includes(zoomPct) ? zoomPct : ''}
        onChange={e => onSetZoom(Number(e.target.value))}
        aria-label="Zoom level"
      >
        {!ZOOM_PRESETS.includes(zoomPct) && <option value="">{zoomPct}%</option>}
        {ZOOM_PRESETS.map(p => <option key={p} value={p}>{p}%</option>)}
      </select>
      <button className="preview-toolbar-btn" onClick={onZoomIn} title="Zoom In" aria-label="Zoom In">
        <Plus size={13} />
      </button>

      <div className="preview-toolbar-divider" />

      <button className="preview-toolbar-btn" onClick={onFitToScreen} title="Fit to Screen" aria-label="Fit to Screen">
        <Maximize size={13} />
      </button>

      <div className="preview-toolbar-divider" />

      <button
        className="preview-toolbar-btn" onClick={onPrint} disabled={actionsDisabled}
        title={actionsDisabled ? 'Save the invoice first' : 'Print Invoice'} aria-label="Print"
        style={{ cursor: actionsDisabled ? 'not-allowed' : 'pointer', opacity: actionsDisabled ? 0.45 : 1 }}
      >
        <Printer size={13} />
      </button>
      <button
        className="preview-toolbar-btn" onClick={onDownload} disabled={actionsDisabled || downloading}
        title={actionsDisabled ? 'Save the invoice first' : 'Download PDF'} aria-label="Download PDF"
        style={{ cursor: actionsDisabled ? 'not-allowed' : 'pointer', opacity: actionsDisabled ? 0.45 : 1 }}
      >
        {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
      </button>
    </div>
  );
}
