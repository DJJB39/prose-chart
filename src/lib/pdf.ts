// PDF export — block-aware pagination.
//
// Rasterising the whole report at once and slicing the canvas at pixel rows
// slices charts across page breaks. Instead we capture each top-level child
// of the report article as its own canvas, then bin-pack the resulting
// blocks onto A4 pages. A block that fits gets appended to the current page;
// a block that doesn't starts a new page.
//
// Fidelity rules:
//   - waits for document.fonts.ready before capture
//   - scale 2 for crisp lines at print resolution
//   - background matches the current --paper token (light or ink theme)
//   - foreignObject disabled so oklch resolution matches the browser paint

import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const MARGIN_PT = 36;

function currentPaperColor(): string {
  if (typeof window === "undefined") return "#faf9f6";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim();
  return v || "#faf9f6";
}

async function captureBlock(el: HTMLElement, paper: string): Promise<HTMLCanvasElement> {
  return html2canvas(el, {
    backgroundColor: paper,
    scale: 2,
    useCORS: true,
    logging: false,
    foreignObjectRendering: false,
    windowWidth: el.scrollWidth,
  });
}

function canvasSlice(canvas: HTMLCanvasElement, y: number, h: number, paper: string): HTMLCanvasElement {
  const slice = document.createElement("canvas");
  slice.width = canvas.width;
  slice.height = Math.ceil(h);
  const ctx = slice.getContext("2d")!;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, slice.width, slice.height);
  ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
  return slice;
}

export async function exportReportToPdf(node: HTMLElement, filename = "veritas-report.pdf") {
  if (typeof document === "undefined") return;
  if (document.fonts && "ready" in document.fonts) {
    await document.fonts.ready;
  }
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  const paper = currentPaperColor();

  // Each direct child of the article is a "block" we refuse to split.
  const blocks = Array.from(node.children).filter((c): c is HTMLElement => c instanceof HTMLElement);
  const canvases = await Promise.all(blocks.map((el) => captureBlock(el, paper)));

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const printableWidth = A4_WIDTH_PT - MARGIN_PT * 2;
  const printableHeight = A4_HEIGHT_PT - MARGIN_PT * 2;

  // Scale all blocks to fit the printable width — same pxPerPt for all so
  // relative sizing matches the on-screen layout.
  const widestPx = Math.max(...canvases.map((c) => c.width));
  const pxPerPt = widestPx / printableWidth;
  const pageBudgetPx = printableHeight * pxPerPt;

  let pageIdx = 0;
  let yCursorPx = 0; // top of the next block, in pixel units on the current page

  function newPage(first = false) {
    if (!first) pdf.addPage();
    pdf.setFillColor(paper);
    pdf.rect(0, 0, A4_WIDTH_PT, A4_HEIGHT_PT, "F");
    yCursorPx = 0;
    pageIdx++;
  }

  newPage(true);

  const drawSlice = (slice: HTMLCanvasElement, atYPx: number) => {
    const img = slice.toDataURL("image/png");
    const heightPt = slice.height / pxPerPt;
    const widthPt = slice.width / pxPerPt;
    pdf.addImage(
      img, "PNG",
      MARGIN_PT, MARGIN_PT + atYPx / pxPerPt,
      widthPt, heightPt,
      undefined, "FAST",
    );
  };

  for (const canvas of canvases) {
    const blockHeightPx = canvas.height;
    const remainingPx = pageBudgetPx - yCursorPx;

    if (blockHeightPx <= pageBudgetPx) {
      // Fits on some page. If not on the current one, start a new page.
      if (blockHeightPx > remainingPx) newPage();
      drawSlice(canvas, yCursorPx);
      yCursorPx += blockHeightPx;
    } else {
      // Rare: a single block taller than a page. Split across pages, but
      // start on a fresh page so we don't crowd the previous section.
      if (yCursorPx > 0) newPage();
      let drawn = 0;
      while (drawn < blockHeightPx) {
        const remaining = pageBudgetPx - yCursorPx;
        const take = Math.min(remaining, blockHeightPx - drawn);
        const slice = canvasSlice(canvas, drawn, take, paper);
        drawSlice(slice, yCursorPx);
        drawn += take;
        yCursorPx += take;
        if (drawn < blockHeightPx) newPage();
      }
    }
  }

  pdf.save(filename);
}
