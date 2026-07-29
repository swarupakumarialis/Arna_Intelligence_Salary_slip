import React from 'react';
import { Minus, Plus, Maximize, Printer, Download } from 'lucide-react';

interface Props {
  zoomPct: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSetZoom: (pct: number) => void;
  onFitToScreen: () => void;
}

const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200];

/** Zoom/view controls for the Invoice Preview (Sprint 3) — a module-
    local counterpart to components/preview/PreviewToolbar.tsx, reusing
    that component's CSS classes (.preview-toolbar*, already global,
    presentational-only styling) for visual consistency with the
    Salary Generator's Live Preview, without importing or modifying
    that component itself. Print/Download are permanent disabled
    placeholders this sprint — no PDF generation exists yet. */
export function PreviewToolbar({ zoomPct, onZoomIn, onZoomOut, onSetZoom, onFitToScreen }: Props) {
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

      <button className="preview-toolbar-btn" disabled title="Print (coming soon)" aria-label="Print" style={{ cursor: 'not-allowed', opacity: 0.45 }}>
        <Printer size={13} />
      </button>
      <button className="preview-toolbar-btn" disabled title="Download PDF (coming soon)" aria-label="Download PDF" style={{ cursor: 'not-allowed', opacity: 0.45 }}>
        <Download size={13} />
      </button>
    </div>
  );
}
