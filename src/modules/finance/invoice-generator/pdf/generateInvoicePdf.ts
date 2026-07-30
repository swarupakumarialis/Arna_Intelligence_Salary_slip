import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { KEEP_TOGETHER_ID } from './InvoicePdf';

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

export interface GeneratedInvoicePdf {
  pdf: jsPDF;
  blob: Blob;
  fileName: string;
}

/** Canvas-pixel [top, bottom] of the keep-together element (Summary +
    Footer), or null if it isn't present (defensive — every real
    InvoicePdf render includes it). Measured from the live DOM node
    before capture, then scaled by the same ratio html2canvas used
    between the node's actual size and the captured canvas's pixel
    size, so it lines up with canvas-space page-slice math below. */
function measureKeepTogetherRegion(node: HTMLElement, canvasHeight: number): { top: number; bottom: number } | null {
  const el = node.querySelector(`#${KEEP_TOGETHER_ID}`);
  if (!el) return null;
  const nodeRect = node.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const ratio = canvasHeight / node.scrollHeight;
  return {
    top: (elRect.top - nodeRect.top) * ratio,
    bottom: (elRect.bottom - nodeRect.top) * ratio,
  };
}

/**
 * Captures the off-screen InvoicePdf node into a PDF — the Invoice
 * module's own independent counterpart to App.tsx's
 * capturePdfDocument, deliberately not shared with it (per this
 * sprint's "keep the Invoice PDF completely independent" instruction).
 * Same html2canvas settings as the Salary export (scale/useCORS/
 * backgroundColor/onclone-strip-transform) for the same reasons, but
 * this one is NOT limited to a single A4 page: an invoice's item count
 * is unbounded (see InvoicePdf.tsx's comment), so the captured canvas
 * is sliced into as many 297mm-tall pages as it takes to show every
 * pixel — "no overflow, no clipped content" from the spec, satisfied
 * for any invoice length rather than assuming one page like the
 * (bounded-length) salary slip does.
 *
 * Sprint 7, Part 4 — "never split totals awkwardly across pages...
 * keep footer together": naive fixed-height slicing (page N = canvas
 * rows [N×pageHeight, (N+1)×pageHeight)) could previously cut straight
 * through the Summary/Footer block. Page boundaries are now adjusted
 * to end a page early — right before that block — whenever it would
 * otherwise straddle a boundary and it's short enough to fit whole on
 * a fresh page; CSS `break-inside: avoid` on the same block (see
 * InvoicePdf.tsx) gives Print the equivalent guarantee natively.
 */
export async function generateInvoicePdf(
  node: HTMLElement,
  invoiceNumber: string
): Promise<GeneratedInvoicePdf> {
  await document.fonts.ready;
  await new Promise(requestAnimationFrame);
  await new Promise(resolve => setTimeout(resolve, 100));

  const canvas = await html2canvas(node, {
    scale: 2.5,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    allowTaint: true,
    imageTimeout: 0,
    windowWidth: node.scrollWidth,
    windowHeight: node.scrollHeight,
    onclone: (clonedDoc) => {
      const area = clonedDoc.getElementById('invoice-pdf-area');
      if (area) {
        area.style.transform = 'none';
        area.style.margin = '0';
      }
    },
  });

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pdf.setProperties({ title: `Invoice ${invoiceNumber}`, creator: 'Arna Intelligence IntelliPayRoll', subject: 'Invoice' });

  const pxPerMm = canvas.width / A4_WIDTH_MM;
  const pageHeightPx = Math.round(A4_HEIGHT_MM * pxPerMm);
  const keepTogether = measureKeepTogetherRegion(node, canvas.height);

  let cursor = 0;
  let firstPage = true;
  while (cursor < canvas.height) {
    let sliceEnd = Math.min(cursor + pageHeightPx, canvas.height);

    if (keepTogether && keepTogether.top > cursor && keepTogether.top < sliceEnd && keepTogether.bottom > sliceEnd) {
      const regionHeight = keepTogether.bottom - keepTogether.top;
      // Only shrink this page if the region actually fits whole on a
      // fresh page — otherwise it's longer than one page regardless,
      // and letting it split is better than an empty/near-empty page.
      if (regionHeight <= pageHeightPx && keepTogether.top > cursor) {
        sliceEnd = keepTogether.top;
      }
    }

    const sliceHeightPx = sliceEnd - cursor;
    if (sliceHeightPx <= 0) break; // defensive — should be unreachable given the check above

    if (!firstPage) pdf.addPage();
    firstPage = false;

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeightPx;
    const ctx = sliceCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(canvas, 0, cursor, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
    }
    const imgData = sliceCanvas.toDataURL('image/jpeg', 1.0);
    const sliceHeightMm = sliceHeightPx / pxPerMm;
    pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, sliceHeightMm);

    cursor = sliceEnd;
  }

  const fileName = `${invoiceNumber}.pdf`;
  const blob = pdf.output('blob');
  return { pdf, blob, fileName };
}
