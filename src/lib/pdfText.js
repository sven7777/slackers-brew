// The one module that touches pdf.js.
//
// It is imported DYNAMICALLY by the price-import UI (never at app start), so
// pdf.js and its worker land in their own chunk: a brewer who never uploads a
// price list never downloads a PDF parser. Keep it that way — a static import of
// this file from anywhere in the app tree undoes that.
//
// Two kinds of PDF arrive here, and telling them apart decides the whole import:
// a vendor list exported from Excel carries real text, which comes out exactly;
// a list printed from a screenshot carries none, and has to be rasterized and
// read by OCR instead. `hasText` is that test.

import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { groupIntoLines } from "./pdfLines";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// pdf.js takes ownership of the buffer it is handed (it transfers it to the
// worker, leaving the original detached). Every entry point therefore parses a
// COPY, so the caller can read the same file twice — which the hop list does,
// once to check for text and again to rasterize it.
const copyOf = (data) => new Uint8Array(data instanceof Uint8Array ? data : new Uint8Array(data));

// Returns the LOADING TASK, not the document: tearing down a parse means
// destroying the task (which shuts down its worker), and only the task can do
// that — the document proxy has no destroy() in pdf.js 6.
function open(data) {
  return pdfjs.getDocument({ data: copyOf(data), isEvalSupported: false });
}

// PDF → { lines, pageCount, hasText }. Lines are rebuilt from positioned text
// items by pdfLines.js; a scanned/printed PDF yields none.
export async function extractPdfLines(data) {
  const task = open(data);
  const doc = await task.promise;
  try {
    const lines = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const items = content.items
        .filter((it) => typeof it.str === "string")
        .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width }));
      lines.push(...groupIntoLines(items));
      page.cleanup();
    }
    return { lines, pageCount: doc.numPages, hasText: lines.some((l) => l.trim() !== "") };
  } finally {
    task.destroy();
  }
}

// How big to rasterize for OCR. The hop list's table is drawn as VECTORS — the
// only bitmap on the page is the banner — so there is no source resolution to
// lose by scaling up, and OCR accuracy follows type size directly. 4× a letter
// page is ~2450×3170, which puts the table's text around 30px tall.
export const OCR_SCALE = 4;

// Rasterize each page and hand it to `onPage`, one at a time.
//
// Pages are built and released one by one on purpose: a page at OCR_SCALE is
// ~30MB of canvas, and holding a whole document of them at once is how a laptop
// runs out of memory mid-import. Only the small previews are kept and returned.
//
// ⚠️ `intent: "print"` is not incidental. pdf.js's default display path drives
// itself with requestAnimationFrame, which a BACKGROUND TAB never fires — so a
// brewer who switched tabs while a four-page list was being read would wait
// forever on a render that silently never resolves. The print path runs straight
// through. (That is exactly how this was found: rendering hung indefinitely in
// an inactive tab and finished in 2s in an active one.)
export async function renderPdfPages(data, { scale = OCR_SCALE, previewWidth = 1600, onPage } = {}) {
  const task = open(data);
  const doc = await task.promise;
  try {
    const previews = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, viewport, intent: "print" }).promise;

      previews.push(downscale(canvas, previewWidth));
      await onPage?.({ pageNumber: n, pageCount: doc.numPages, canvas });

      // Let this page's canvas go before the next one is built.
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }
    return previews;
  } finally {
    task.destroy();
  }
}

// A small JPEG copy of a page, for showing the brewer what a price was read
// from. Full-resolution data URLs would be tens of megabytes.
function downscale(canvas, width) {
  if (canvas.width <= width) return canvas.toDataURL("image/jpeg", 0.75);
  const small = document.createElement("canvas");
  small.width = width;
  small.height = Math.round((canvas.height * width) / canvas.width);
  const ctx = small.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, small.width, small.height);
  return small.toDataURL("image/jpeg", 0.75);
}
