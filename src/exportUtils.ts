import { type ReactFlowInstance, getViewportForBounds } from "@xyflow/react";
import { toBlob, toSvg } from "html-to-image";
import { freezeSvgColors } from "./freezeSvgColors";
import { describeExportError, scrubXmlIllegalDom } from "./exportCapturePrep";
import { useSchematicStore } from "./store";
import { t } from "./i18n";

const EXPORT_PADDING = 40;

export interface RasterBudget {
  /** Longest allowed side of the output bitmap. */
  maxDimensionPx: number;
  /** Total allowed pixels of the output bitmap. */
  maxAreaPx: number;
}

// Image-download budget: caps the raster so a large capture can't demand a
// multi-gigapixel canvas — pixelRatio 4 over the full schematic bounds was
// allocating GBs and near-crashing 8GB machines (#383). Kept deliberately
// tighter than the PDF page budget (pdfExport.ts): full-schematic bounds are
// unbounded in a way paper sizes never are. The area cap additionally bounds
// captures big in BOTH dimensions (12000×12000 alone would be a 576MB bitmap).
const IMAGE_RASTER_BUDGET: RasterBudget = {
  maxDimensionPx: 12000,
  maxAreaPx: 64_000_000,
};

/** Largest pixelRatio that keeps a widthPx×heightPx capture inside the budget.
 *  One formula shared by image and PDF export — the budgets differ on purpose
 *  (see each budget's rationale), the math must not. May fall below 1 for
 *  outsized captures — downsampling the output is the point. */
export function capExportPixelRatio(
  target: number,
  widthPx: number,
  heightPx: number,
  budget: RasterBudget = IMAGE_RASTER_BUDGET,
): number {
  return Math.min(
    target,
    budget.maxDimensionPx / Math.max(widthPx, heightPx),
    Math.sqrt(budget.maxAreaPx / (widthPx * heightPx)),
  );
}

interface ExportOptions {
  pixelRatio?: number;
  format?: "png" | "svg";
  backgroundColor?: string;
}

export async function exportImage(
  reactFlowInstance: ReactFlowInstance,
  options: ExportOptions = {},
) {
  const {
    pixelRatio = 3,
    format = "png",
    backgroundColor = "#ffffff",
  } = options;

  const nodes = reactFlowInstance.getNodes();
  if (nodes.length === 0) return;

  const bounds = reactFlowInstance.getNodesBounds(nodes);

  // Target dimensions with padding
  const width = bounds.width + EXPORT_PADDING * 2;
  const height = bounds.height + EXPORT_PADDING * 2;

  // Compute viewport that fits all nodes into our export area
  const viewport = getViewportForBounds(bounds, width, height, 0.5, 2, 0);

  const viewportEl = document.querySelector(
    ".react-flow__viewport",
  ) as HTMLElement;
  if (!viewportEl) return;

  const effectivePixelRatio = capExportPixelRatio(pixelRatio, width, height);

  // Download from a Blob, never a base64 data URL: the URL doubles the image in
  // memory as a giant string, and Chrome silently drops data-URL downloads past
  // ~2MB — both bite on exactly the large schematics of #383.
  let blob: Blob | null;
  try {
    blob = await captureViewportBlob(viewportEl, {
      format,
      backgroundColor,
      width,
      height,
      pixelRatio: format === "svg" ? 1 : effectivePixelRatio,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    });
  } catch (err) {
    // Callers fire-and-forget exportImage: without this, a failed capture is
    // an unhandled rejection with no feedback at all.
    console.error(`${format.toUpperCase()} export failed:`, err);
    useSchematicStore
      .getState()
      .addToast(t("{format} export failed — {reason}", { format: format.toUpperCase(), reason: describeExportError(err) }), "error");
    return;
  }
  // canvas.toBlob resolves null when the browser can't encode the raster (iOS
  // Safari caps canvas area well below our own limits) — say so instead of a
  // silent no-op.
  if (!blob) {
    useSchematicStore
      .getState()
      .addToast(t("Export failed — the schematic is too large for this browser to render as an image."), "error");
    return;
  }

  // Trigger download
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `schematic.${format}`;
  link.href = url;
  link.click();
  // The click only queues the download; revoke after it has been picked up.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface ViewportCapture {
  format: "png" | "svg";
  backgroundColor: string;
  /** Output size in CSS px (before pixelRatio). */
  width: number;
  height: number;
  pixelRatio: number;
  /** CSS transform that puts the wanted part of the canvas at the output's top-left. */
  transform: string;
}

/** One frame, or a short timer when the tab is hidden — Chrome runs no animation frames
 *  in a background tab, and Claude's render_schematic usually runs in one. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (document.hidden) setTimeout(resolve, 16);
    else requestAnimationFrame(() => resolve());
  });
}

/**
 * Capture React Flow's viewport element as PNG or SVG — the core of the image download and
 * of Claude's render_schematic (renderSchematic.ts). Throws when html-to-image fails;
 * resolves null when the browser cannot encode a raster that large.
 */
export async function captureViewportBlob(viewportEl: HTMLElement, opts: ViewportCapture): Promise<Blob | null> {
  // Firefox returns `undefined` from getPropertyValue() for unrecognized CSS
  // properties, but html-to-image calls .trim() on the result without a null
  // check. Patch it to return '' instead while html-to-image runs.
  const origGetPropertyValue = CSSStyleDeclaration.prototype.getPropertyValue;
  CSSStyleDeclaration.prototype.getPropertyValue = function (prop) {
    return origGetPropertyValue.call(this, prop) ?? '';
  };
  // html-to-image waits for an animation frame after decoding each image; a hidden tab never
  // gets one, so the capture would hang there. Stand in with a timer while it runs.
  const origRaf = window.requestAnimationFrame;
  if (document.hidden) {
    window.requestAnimationFrame = (cb: FrameRequestCallback) =>
      window.setTimeout(() => cb(performance.now()), 16) as unknown as number;
  }

  // Force light-mode colors during capture — see [data-export-capturing] in index.css
  document.documentElement.setAttribute("data-export-capturing", "");
  let restoreColors = () => {};
  let restoreText = () => {};
  try {
    // Let the style override flush before html-to-image reads computed styles
    await nextFrame();
    await nextFrame();
    // Freeze var(--color-…) strokes to concrete colors so Chromium's html-to-image
    // clone keeps the connection lines (#173).
    restoreColors = freezeSvgColors(viewportEl);
    // XML-illegal characters in labels make the serialized SVG ill-formed; the
    // capture then rejects with a bare Event (see exportCapturePrep.ts).
    restoreText = scrubXmlIllegalDom(viewportEl);

    const captureOptions = {
      backgroundColor: opts.backgroundColor,
      width: opts.width,
      height: opts.height,
      pixelRatio: opts.pixelRatio,
      style: {
        width: `${opts.width}px`,
        height: `${opts.height}px`,
        transform: opts.transform,
      },
    };
    if (opts.format === "svg") {
      const dataUrl = await toSvg(viewportEl, captureOptions);
      const svgText = decodeURIComponent(
        dataUrl.replace(/^data:image\/svg\+xml;charset=utf-8,/, ""),
      );
      return new Blob([svgText], { type: "image/svg+xml" });
    }
    return await toBlob(viewportEl, captureOptions);
  } finally {
    restoreText();
    restoreColors();
    window.requestAnimationFrame = origRaf;
    CSSStyleDeclaration.prototype.getPropertyValue = origGetPropertyValue;
    document.documentElement.removeAttribute("data-export-capturing");
  }
}
