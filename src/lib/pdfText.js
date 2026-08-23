// The one module that touches pdf.js.
//
// It is imported DYNAMICALLY by the price-import UI (never at app start), so
// pdf.js and its worker land in their own chunk: a brewer who never uploads a
// price list never downloads a PDF parser. Keep it that way — a static import of
// this file from anywhere in the app tree undoes that.
//
// Two kinds of PDF arrive here, and telling them apart decides the whole import:
// a vendor list exported from Excel carries real text, which comes out exactly;
// a list printed from a screenshot carries only page images, so there is nothing
// to extract and it has to be read by OCR instead. `hasText` is that test.

import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { groupIntoLines } from "./pdfLines";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// pdf.js takes ownership of the buffer it is handed (it transfers it to the
// worker, leaving the original detached). Every entry point therefore parses a
// COPY, so the caller can read the same file twice — which the hop list does,
// once to check for text and again to render its pages for OCR.
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

// PDF → one canvas per page, for display and for OCR. `scale` trades resolution
// for time and memory; the hop list's prices need ~2x to read cleanly.
export async function renderPdfPages(data, { scale = 2, onProgress } = {}) {
  const task = open(data);
  const doc = await task.promise;
  try {
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport }).promise;
      pages.push({ pageNumber: n, canvas });
      page.cleanup();
      onProgress?.(n, doc.numPages);
    }
    return pages;
  } finally {
    task.destroy();
  }
}
