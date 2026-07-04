// PDF export — the acceptance gate for Phase 1.
//
// html2canvas-pro rasterises the report node. We then paginate that canvas
// onto A4 portrait pages in jsPDF, preserving margins and never slicing a
// KPI or chart across a page boundary is enforced upstream by CSS
// break-inside: avoid on report blocks.
//
// Fidelity rules baked in:
//   - waits for document.fonts.ready before capture
//   - scale 2 for crisp lines at print resolution
//   - #faf9f6 paper background matches the on-screen tone exactly
//   - foreignObject disabled so oklch resolution matches the browser paint

import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const MARGIN_PT = 36; // ~12.7mm — editorial breathing room, standard book margin

function currentPaperColor(): string {
  if (typeof window === "undefined") return "#faf9f6";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim();
  return v || "#faf9f6";
}

export async function exportReportToPdf(node: HTMLElement, filename = "veritas-report.pdf") {
  if (typeof document === "undefined") return;

  // Wait for web fonts so Instrument Serif + Inter Tight render, not fallback.
  if (document.fonts && "ready" in document.fonts) {
    await document.fonts.ready;
  }
  // One frame for any pending layout/animation settle.
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  const canvas = await html2canvas(node, {
    backgroundColor: PAPER,
    scale: 2,
    useCORS: true,
    logging: false,
    // html2canvas-pro handles oklch natively when foreignObject is off.
    foreignObjectRendering: false,
    windowWidth: node.scrollWidth,
  });

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

  const printableWidth = A4_WIDTH_PT - MARGIN_PT * 2;
  const printableHeight = A4_HEIGHT_PT - MARGIN_PT * 2;

  // Scale the captured canvas to fit the printable width.
  const pxPerPt = canvas.width / printableWidth;
  const pageHeightPx = printableHeight * pxPerPt;

  const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) pdf.addPage();

    // Slice out the pixel band for this page and draw it.
    const sliceHeight = Math.min(pageHeightPx, canvas.height - page * pageHeightPx);
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = Math.ceil(sliceHeight);
    const ctx = sliceCanvas.getContext("2d")!;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(
      canvas,
      0,
      page * pageHeightPx,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight,
    );

    const imgData = sliceCanvas.toDataURL("image/png");
    const renderedHeightPt = sliceHeight / pxPerPt;

    // Fill the whole page with paper first (edge-to-edge), so any anti-aliased
    // fringe outside the image band still reads as paper, not white.
    pdf.setFillColor(PAPER);
    pdf.rect(0, 0, A4_WIDTH_PT, A4_HEIGHT_PT, "F");

    pdf.addImage(
      imgData,
      "PNG",
      MARGIN_PT,
      MARGIN_PT,
      printableWidth,
      renderedHeightPt,
      undefined,
      "FAST",
    );
  }

  pdf.save(filename);
}
