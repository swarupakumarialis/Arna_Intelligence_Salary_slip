import React from 'react';
import { Minus, Plus, StretchHorizontal, RectangleVertical, RotateCcw, Expand, Shrink } from 'lucide-react';

interface Props {
  zoomPct: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSetZoom: (pct: number) => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  onReset: () => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
}

const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200];

/** Zoom/view controls for the Live Preview — Figma/Acrobat-style compact
    icon toolbar. Purely presentational; App.tsx owns all zoom state and
    the actual scale math (see handleZoomIn/Out/etc.). */
export function PreviewToolbar({
  zoomPct, onZoomIn, onZoomOut, onSetZoom, onFitWidth, onFitPage, onReset, onFullscreen, isFullscreen,
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

      <button className="preview-toolbar-btn" onClick={onFitWidth} title="Fit Width" aria-label="Fit Width">
        <StretchHorizontal size={13} />
      </button>
      <button className="preview-toolbar-btn" onClick={onFitPage} title="Fit Page" aria-label="Fit Page">
        <RectangleVertical size={13} />
      </button>
      <button className="preview-toolbar-btn" onClick={onReset} title="Reset Zoom (100%)" aria-label="Reset Zoom">
        <RotateCcw size={13} />
      </button>

      <div className="preview-toolbar-divider" />

      <button
        className="preview-toolbar-btn"
        onClick={onFullscreen}
        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
      >
        {isFullscreen ? <Shrink size={13} /> : <Expand size={13} />}
      </button>
    </div>
  );
}
