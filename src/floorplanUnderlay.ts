/**
 * Loading the architect's drawing that a floorplan page is built on.
 *
 * Both PDFs and images end up as one rasterized data URL: the sheet only ever needs
 * pixels, jsPDF can embed them directly, and the schematic file stays self-contained
 * instead of pointing at a file the user will eventually move. PDF rendering pulls in
 * pdfjs lazily so the main bundle is untouched for everyone who never opens a plan.
 */

import { PT_TO_MM, rotatedSquareFactor } from "./floorplan";

/** What the file picker accepts. DWG is deliberately absent — see importUnderlayFile. */
export const UNDERLAY_ACCEPT = "application/pdf,image/png,image/jpeg,image/webp,image/svg+xml,.pdf,.png,.jpg,.jpeg,.webp,.svg";

/** Long-edge cap for the rasterized underlay. An A1 plan at 2400 px still resolves
 *  individual room labels when zoomed, while keeping the data URL small enough that
 *  the autosave blob fits in localStorage. */
export const DEFAULT_MAX_LONG_EDGE_PX = 2400;

/** Warn above this — localStorage autosave is a ~5 MB budget for the whole project. */
export const UNDERLAY_SIZE_WARN_BYTES = 3_000_000;

export interface ImportedUnderlay {
  src: string;
  kind: "pdf" | "image";
  naturalWidthPx: number;
  naturalHeightPx: number;
  sourceName: string;
  /** 1-based, for PDFs. */
  pageNumber?: number;
  pageCount?: number;
  /** Physical size of the source, when it has one (PDF page boxes do). */
  naturalSizeMm?: { w: number; h: number };
  /** Approximate byte size of the data URL, so callers can warn about autosave. */
  approxBytes: number;
}

/** Rough decoded byte count of a data URL (base64 is 4/3 of the payload). */
export function dataUrlBytes(src: string): number {
  const comma = src.indexOf(",");
  if (comma < 0) return src.length;
  return Math.round((src.length - comma - 1) * 0.75);
}

/** Encode a canvas as PNG or JPEG, whichever is smaller. Architect drawings are line
 *  art, where PNG usually wins on both size and crispness; photographic scans are the
 *  case where JPEG takes over. */
function encodeCanvas(canvas: HTMLCanvasElement): string {
  const png = canvas.toDataURL("image/png");
  const jpeg = canvas.toDataURL("image/jpeg", 0.85);
  // Prefer PNG unless JPEG is meaningfully smaller — ringing around thin black lines is
  // the one artifact that makes a plan look wrong.
  return jpeg.length * 1.15 < png.length ? jpeg : png;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode this image file."));
    img.src = src;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

/** Load pdfjs on demand and point it at its worker bundle. */
async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  }
  return pdfjs;
}

/** Number of pages in a PDF, so the toolbar can offer a page switcher. */
export async function getPdfPageCount(file: File): Promise<number> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  try {
    const doc = await task.promise;
    return doc.numPages;
  } finally {
    // The loading task owns the worker — destroying it releases both.
    await task.destroy();
  }
}

async function renderPdfPage(file: File, pageNumber: number, maxLongEdgePx: number): Promise<ImportedUnderlay> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  try {
    const clampedPage = Math.min(Math.max(pageNumber, 1), doc.numPages);
    const page = await doc.getPage(clampedPage);
    // Scale 1 gives PDF user units (points), which carry the sheet's true physical size.
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(maxLongEdgePx / Math.max(base.width, base.height), 4);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create a canvas to render the PDF page.");
    // Plans are drawn on transparent backgrounds; paint paper white so the raster
    // doesn't turn into black-on-black in dark mode.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    const src = encodeCanvas(canvas);
    return {
      src,
      kind: "pdf",
      naturalWidthPx: canvas.width,
      naturalHeightPx: canvas.height,
      sourceName: file.name,
      pageNumber: clampedPage,
      pageCount: doc.numPages,
      naturalSizeMm: { w: base.width * PT_TO_MM, h: base.height * PT_TO_MM },
      approxBytes: dataUrlBytes(src),
    };
  } finally {
    await task.destroy();
  }
}

async function rasterizeImage(file: File, maxLongEdgePx: number): Promise<ImportedUnderlay> {
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImageElement(dataUrl);
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  if (!naturalW || !naturalH) throw new Error("This image has no readable dimensions.");

  const scale = Math.min(maxLongEdgePx / Math.max(naturalW, naturalH), 1);
  // Small enough already and not an SVG → keep the original bytes, no re-encode.
  if (scale >= 1 && file.type !== "image/svg+xml") {
    return {
      src: dataUrl,
      kind: "image",
      naturalWidthPx: naturalW,
      naturalHeightPx: naturalH,
      sourceName: file.name,
      approxBytes: dataUrlBytes(dataUrl),
    };
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(naturalW * scale));
  canvas.height = Math.max(1, Math.round(naturalH * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create a canvas to resize the image.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const src = encodeCanvas(canvas);
  return {
    src,
    kind: "image",
    naturalWidthPx: canvas.width,
    naturalHeightPx: canvas.height,
    sourceName: file.name,
    approxBytes: dataUrlBytes(src),
  };
}

/** Load a small product shot for a legend row. Keeps transparency (PNG) so a product
 *  cut-out doesn't gain a white box on a colored legend, and caps the long edge so a
 *  handful of them can't bloat the saved project. */
export async function importLegendImage(file: File, maxLongEdgePx = 320): Promise<string> {
  if (!file.type.startsWith("image/") && !["png", "jpg", "jpeg", "webp", "svg"].includes(extensionOf(file.name))) {
    throw new Error("Pick an image file for the legend.");
  }
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImageElement(dataUrl);
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  const scale = Math.min(maxLongEdgePx / Math.max(naturalW, naturalH), 1);
  if (scale >= 1 && file.type !== "image/svg+xml") return dataUrl;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(naturalW * scale));
  canvas.height = Math.max(1, Math.round(naturalH * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create a canvas to resize the image.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

/** Import an uploaded picture as a plan symbol. Always rasterized to a square-fitting PNG
 *  (transparent background preserved), so an SVG, a photo and a logo all end up as the
 *  same kind of data URL — the one jsPDF can embed and the sheet can rotate. */
export async function importSymbolImage(file: File, maxEdgePx = 256): Promise<string> {
  if (!file.type.startsWith("image/") && !["png", "jpg", "jpeg", "webp", "svg"].includes(extensionOf(file.name))) {
    throw new Error("Pick an image file for the symbol.");
  }
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImageElement(dataUrl);
  // An SVG that carries only a viewBox reports no intrinsic size in Chromium; such a
  // picture fills the square rather than being rejected.
  const naturalW = img.naturalWidth || img.width || maxEdgePx;
  const naturalH = img.naturalHeight || img.height || maxEdgePx;
  // Square canvas with the picture contained and centered: a symbol slot is square, so a
  // square source maps onto it 1:1 and rotation about the center needs no re-fitting.
  const scale = Math.min(maxEdgePx / Math.max(naturalW, naturalH), 1);
  const w = Math.max(1, Math.round(naturalW * scale));
  const h = Math.max(1, Math.round(naturalH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = maxEdgePx;
  canvas.height = maxEdgePx;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create a canvas to resize the image.");
  ctx.drawImage(img, (maxEdgePx - w) / 2, (maxEdgePx - h) / 2, w, h);
  return canvas.toDataURL("image/png");
}


/** The same picture turned by `deg` clockwise, on a square canvas that fits the turned
 *  image. The PDF export needs real rotated pixels — jsPDF cannot rotate an image the way
 *  an SVG transform does on screen. */
export async function rotatedImageDataUrl(src: string, deg: number): Promise<string> {
  const norm = ((deg % 360) + 360) % 360;
  if (norm === 0) return src;
  const img = await loadImageElement(src);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const rad = (norm * Math.PI) / 180;
  const side = Math.max(1, Math.round(Math.max(w, h) * rotatedSquareFactor(norm)));
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create a canvas to rotate the image.");
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -w / 2, -h / 2);
  return canvas.toDataURL("image/png");
}

export interface ImportUnderlayOptions {
  /** 1-based page to rasterize from a PDF. Defaults to 1. */
  pageNumber?: number;
  maxLongEdgePx?: number;
}

/**
 * Turn a dropped or picked file into a floorplan underlay.
 *
 * Throws with a message meant for a toast when the format can't be used — notably DWG,
 * which is a proprietary binary format with no viable browser parser, and DXF, which
 * would need a vector renderer rather than this raster path.
 */
export async function importUnderlayFile(file: File, opts: ImportUnderlayOptions = {}): Promise<ImportedUnderlay> {
  const ext = extensionOf(file.name);
  const maxLongEdgePx = opts.maxLongEdgePx ?? DEFAULT_MAX_LONG_EDGE_PX;

  if (ext === "dwg") {
    throw new Error(
      "DWG can't be read in the browser. Export the drawing as PDF (best) or as an image from AutoCAD/BricsCAD and import that.",
    );
  }
  if (ext === "dxf") {
    throw new Error("DXF isn't supported as an underlay yet. Plot the drawing to PDF and import the PDF.");
  }
  if (ext === "pdf" || file.type === "application/pdf") {
    return renderPdfPage(file, opts.pageNumber ?? 1, maxLongEdgePx);
  }
  if (file.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "svg"].includes(ext)) {
    return rasterizeImage(file, maxLongEdgePx);
  }
  throw new Error(`Unsupported file type "${ext || file.type || "unknown"}". Use a PDF or an image.`);
}

/**
 * Fetch a remote image into a data URL so jsPDF can embed it. Draws through a canvas
 * with an anonymous CORS request; hosts that refuse CORS make this resolve to undefined
 * rather than throw, so a legend row simply prints without its picture. Capped to a few
 * seconds — an export must never hang on a slow image host.
 */
export function fetchImageAsDataUrl(url: string, timeoutMs = 4000): Promise<string | undefined> {
  if (url.startsWith("data:")) return Promise.resolve(url);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(undefined), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(undefined); return; }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        // Tainted canvas (no CORS) — nothing embeddable.
        resolve(undefined);
      }
    };
    img.onerror = () => { clearTimeout(timer); resolve(undefined); };
    img.src = url;
  });
}
