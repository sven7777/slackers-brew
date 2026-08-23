// The one module that touches tesseract.js.
//
// Like pdfText.js it is imported DYNAMICALLY, and for a bigger reason: the OCR
// engine is WebAssembly and the English model a few MB, both fetched on first
// use. Nobody should pay that to look at their inventory — only the brewer who
// actually drops the hop list on the page does.
//
// It returns positioned WORDS, not a wall of text, because position is the whole
// point: on the spot hop list a price means nothing without the crop-year column
// it sits under. Confidence rides along per word so the review screen can flag
// what tesseract was unsure of.

import { createWorker } from "tesseract.js";

// Luminance below this becomes black, above it white. The spot hop list prints
// dark blue type on alternating GREEN and GREY row stripes, which tesseract
// reads badly — flattening each page to black-on-white more than doubled the
// prices it found on a sample page (8 → 19). Measured against neighbours: 140
// lost thin type, 200+ gained nothing.
const BINARIZE_THRESHOLD = 170;

// Flatten a page to pure black and white before reading it.
function binarize(canvas) {
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0);
  const image = ctx.getImageData(0, 0, out.width, out.height);
  const px = image.data;
  for (let i = 0; i < px.length; i += 4) {
    const luminance = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const value = luminance < BINARIZE_THRESHOLD ? 0 : 255;
    px[i] = px[i + 1] = px[i + 2] = value;
  }
  ctx.putImageData(image, 0, 0);
  return out;
}

// Flatten tesseract's block → paragraph → line → word tree into the flat,
// positioned shape spotHops.js parses.
function wordsOf(page) {
  const out = [];
  for (const block of page?.blocks || []) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        for (const word of line.words || []) {
          const { x0, y0, x1, y1 } = word.bbox || {};
          if (x0 == null) continue;
          out.push({ text: word.text, x0, y0, x1, y1, confidence: word.confidence });
        }
      }
    }
  }
  return out;
}

// Open one OCR engine for a whole document and read pages through it.
//
// The worker is deliberately reused across pages: starting it means loading the
// wasm and the language model, which is most of the wait — paying that per page
// would quadruple a four-page import. Always `close()` when done (a worker holds
// its wasm heap open).
export async function createReader({ onLoading } = {}) {
  onLoading?.();
  const worker = await createWorker("eng", 1);
  return {
    // `blocks: true` is what makes the positioned word tree available at all;
    // without it tesseract.js 5+ returns only the concatenated text.
    async read(canvas) {
      const { data } = await worker.recognize(binarize(canvas), {}, { blocks: true });
      return wordsOf(data);
    },
    close: () => worker.terminate(),
  };
}
