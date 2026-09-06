import { describe, it, expect } from "vitest";
import {
  buildFloorplanSchedule,
  buildLegendRows,
  isGroupVisible,
  computeCalibration,
  createDefaultDrawingBlock,
  createDefaultLegend,
  drawingAreaMm,
  fitRectInArea,
  formatScale,
  legendHeightMm,
  measureRealDistanceMm,
  nextSymbolLabel,
  paperMmToRealMm,
  realMmToPaperMm,
  renumberGroup,
  rescaleUnderlayForScale,
  sheetSizeMm,
  symbolLabelAnchor,
  underlayMmPerPx,
  wrapText,
  resolveFloorplanTokens,
  layoutDrawingBlock,
  layoutNote,
  nextRevisionIndex,
  formatPlanDate,
  matchPaperToSize,
  fillSheetPlacement,
  legendRowImage,
  coverageOutlineMm,
  coverageApertureDeg,
  coverageAnchorMm,
  coverageRotationDeg,
  coveragePointsOnSheet,
  coverageColor,
  isCoverageVisible,
  formatCoverageSpec,
  defaultCoverage,
  COVERAGE_MAX_RANGE_M,
  COVERAGE_MIN_RANGE_M,
  DEFAULT_COVERAGE_COLOR,
  coverageHorizontalPixels,
  coverageSceneWidthM,
  coveragePixelDensityAt,
  coverageDoriRangeM,
  effectiveRangeM,
  defaultCameraOptics,
  defaultCoverageForDevice,
  isCameraDeviceType,
  isAccessPointDeviceType,
  coverageOffersOptics,
  legendShowsRssiScale,
  FLOORPLAN_KIND_PRESETS,
  LEGEND_RSSI_GAP_MM,
  LEGEND_RSSI_TITLE_MM,
  LEGEND_RSSI_ROW_MM,
  rectFromDrag,
  legendDescriptionFor,
  legendInstallNoteFor,
  appendLegendNote,
  companyProfileLines,
  companyContactLine,
  planSymbolFor,
  symbolPolygon,
  symbolPrimitives,
  rotateVec,
  rotatedSquareFactor,
  symbolOutlineColor,
  symbolOutlineWidth,
  DEFAULT_SYMBOL_OUTLINE,
  DEFAULT_SYMBOL_OUTLINE_RATIO,
  FLOORPLAN_SYMBOL_SHAPE_LABELS,
  formatSymbolLabel,
  nextSeqInLine,
  renumberLine,
  linesOnPage,
  labelPlacementFor,
  effectiveLabelTemplate,
  defaultSymbolShapeFor,
  defaultSymbolColorFor,
  glyphColorOn,
  hasCompanyProfile,
  legendCompanyHeightMm,
  AVG_GLYPH_WIDTH_FACTOR,
  PAGE_MARGIN_MM,
} from "../floorplan";
import type { CoverageOptics, FloorplanCoverage, FloorplanPage, FloorplanSymbol, FloorplanUnderlay } from "../types";
import { DORI_PX_PER_M } from "../types";
import { FLOORPLAN_SYMBOL_SHAPES } from "../types";

const paper = { paperId: "iso-a1", orientation: "landscape" as const };

function makeUnderlay(over: Partial<FloorplanUnderlay> = {}): FloorplanUnderlay {
  return {
    src: "data:image/png;base64,xx",
    kind: "image",
    naturalWidthPx: 2000,
    naturalHeightPx: 1000,
    positionMm: { x: 100, y: 50 },
    sizeMm: { w: 400, h: 200 },
    ...over,
  };
}

function makeSymbol(over: Partial<FloorplanSymbol> & Pick<FloorplanSymbol, "id" | "groupId" | "label">): FloorplanSymbol {
  return { positionMm: { x: 0, y: 0 }, ...over };
}

function makePage(over: Partial<FloorplanPage> = {}): FloorplanPage {
  return {
    id: "floorplan-1",
    label: "Ground Floor",
    type: "floorplan",
    paperId: "iso-a1",
    orientation: "landscape",
    scaleDenominator: 50,
    groups: [],
    symbols: [],
    legend: createDefaultLegend(paper),
    drawingBlock: createDefaultDrawingBlock(paper),
    notes: [],
    masks: [],
    coverages: [],
    walls: [],
    showTitleBlock: false,
    symbolSizeMm: 6,
    labelSizeMm: 3.5,
    ...over,
  };
}

describe("scale conversion", () => {
  it("converts between paper mm and real-world mm at the drawing scale", () => {
    // 1:50 — 1 mm on paper is 50 mm on site
    expect(paperMmToRealMm(1, 50)).toBe(50);
    expect(paperMmToRealMm(120, 50)).toBe(6000); // 12 cm on paper = 6 m
    expect(realMmToPaperMm(6000, 50)).toBe(120);
    expect(realMmToPaperMm(6000, 100)).toBe(60);
  });

  it("formats the scale the way a title block spells it", () => {
    expect(formatScale(50)).toBe("1:50");
    expect(formatScale(100)).toBe("1:100");
  });

  it("measures a real-world distance between two sheet points", () => {
    // 3-4-5 triangle on paper → 5 mm → 250 mm on site at 1:50
    expect(measureRealDistanceMm({ x: 0, y: 0 }, { x: 3, y: 4 }, 50)).toBe(250);
  });

  it("treats a zero denominator as unmeasurable rather than dividing by zero", () => {
    expect(realMmToPaperMm(1000, 0)).toBe(0);
  });
});

describe("sheet geometry", () => {
  it("swaps the paper axes in landscape", () => {
    const portrait = sheetSizeMm({ paperId: "iso-a1", orientation: "portrait" });
    const landscape = sheetSizeMm(paper);
    expect(Math.round(portrait.w)).toBe(594);
    expect(Math.round(portrait.h)).toBe(841);
    expect(Math.round(landscape.w)).toBe(841);
    expect(Math.round(landscape.h)).toBe(594);
  });

  it("insets the drawing area by the page margin on all sides", () => {
    const area = drawingAreaMm(paper);
    const sheet = sheetSizeMm(paper);
    expect(area.x).toBeCloseTo(PAGE_MARGIN_MM);
    expect(area.w).toBeCloseTo(sheet.w - 2 * PAGE_MARGIN_MM);
    expect(area.h).toBeCloseTo(sheet.h - 2 * PAGE_MARGIN_MM);
  });

  it("centers an underlay in the drawing area and never overflows it", () => {
    const area = drawingAreaMm(paper);
    // A source that would be far wider than the sheet at its natural size
    const fitted = fitRectInArea(4000, 2000, area, { w: 2000, h: 1000 });
    expect(fitted.sizeMm.w).toBeLessThanOrEqual(area.w + 0.001);
    expect(fitted.sizeMm.h).toBeLessThanOrEqual(area.h + 0.001);
    // Aspect preserved
    expect(fitted.sizeMm.w / fitted.sizeMm.h).toBeCloseTo(2);
    // Centered
    expect(fitted.positionMm.x + fitted.sizeMm.w / 2).toBeCloseTo(area.x + area.w / 2);
    expect(fitted.positionMm.y + fitted.sizeMm.h / 2).toBeCloseTo(area.y + area.h / 2);
  });

  it("keeps a PDF page at its own physical size when it fits", () => {
    const area = drawingAreaMm(paper);
    // A4 landscape page dropped on an A1 sheet — no shrinking needed
    const fitted = fitRectInArea(1190, 842, area, { w: 297, h: 210 });
    expect(fitted.sizeMm.w).toBeCloseTo(297);
    expect(fitted.sizeMm.h).toBeCloseTo(210);
  });
});

describe("calibration", () => {
  it("resizes the underlay so a measured reference comes out at the drawing scale", () => {
    const underlay = makeUnderlay();
    // The user clicks two points 100 mm apart on paper and says they are 10 m apart.
    // At 1:50, 10 m must measure 200 mm on paper → the underlay has to double.
    const result = computeCalibration(underlay, { x: 150, y: 100 }, { x: 250, y: 100 }, 10_000, 50);
    expect(result).not.toBeNull();
    expect(result!.factor).toBeCloseTo(2);
    expect(result!.sizeMm.w).toBeCloseTo(800);
    expect(result!.sizeMm.h).toBeCloseTo(400);
  });

  it("keeps the midpoint of the two picked points fixed", () => {
    const underlay = makeUnderlay();
    const a = { x: 150, y: 100 };
    const b = { x: 250, y: 100 };
    const result = computeCalibration(underlay, a, b, 10_000, 50)!;
    const midBefore = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    // The picked midpoint sits at the same fraction of the underlay before and after.
    const fracBefore = (midBefore.x - underlay.positionMm.x) / underlay.sizeMm.w;
    const fracAfter = (midBefore.x - result.positionMm.x) / result.sizeMm.w;
    expect(fracAfter).toBeCloseTo(fracBefore);
    const fracBeforeY = (midBefore.y - underlay.positionMm.y) / underlay.sizeMm.h;
    const fracAfterY = (midBefore.y - result.positionMm.y) / result.sizeMm.h;
    expect(fracAfterY).toBeCloseTo(fracBeforeY);
  });

  it("reports real mm per source pixel after calibrating", () => {
    const underlay = makeUnderlay();
    const result = computeCalibration(underlay, { x: 150, y: 100 }, { x: 250, y: 100 }, 10_000, 50)!;
    // 800 mm of paper over 2000 px → 0.4 mm/px on paper → 20 mm/px on site at 1:50
    expect(result.mmPerPx).toBeCloseTo(20);
    // A calibrated underlay reports the same figure without re-measuring
    expect(underlayMmPerPx({ ...underlay, sizeMm: result.sizeMm }, 50)).toBeCloseTo(20);
  });

  it("refuses degenerate input instead of producing an infinite scale", () => {
    const underlay = makeUnderlay();
    expect(computeCalibration(underlay, { x: 10, y: 10 }, { x: 10, y: 10 }, 5000, 50)).toBeNull();
    expect(computeCalibration(underlay, { x: 0, y: 0 }, { x: 100, y: 0 }, 0, 50)).toBeNull();
    expect(computeCalibration({ ...underlay, sizeMm: { w: 0, h: 0 } }, { x: 0, y: 0 }, { x: 100, y: 0 }, 5000, 50)).toBeNull();
  });

  it("keeps the building's real size when the drawing scale changes", () => {
    const underlay = makeUnderlay();
    // 1:50 → 1:100 halves the drawing on paper
    const rescaled = rescaleUnderlayForScale(underlay, 50, 100);
    expect(rescaled.sizeMm.w).toBeCloseTo(200);
    expect(rescaled.sizeMm.h).toBeCloseTo(100);
    // Real mm per pixel is unchanged — the plan still covers the same building
    expect(underlayMmPerPx({ ...underlay, ...rescaled }, 100)).toBeCloseTo(underlayMmPerPx(underlay, 50)!);
  });
});

describe("symbol numbering", () => {
  it("continues the group's last number", () => {
    expect(nextSymbolLabel(["4.1", "4.2"])).toBe("4.3");
    expect(nextSymbolLabel(["SB.1"])).toBe("SB.2");
    expect(nextSymbolLabel(["5.9"])).toBe("5.10");
  });

  it("keeps zero padding", () => {
    expect(nextSymbolLabel(["LS-09"])).toBe("LS-10");
    expect(nextSymbolLabel(["LS-009"])).toBe("LS-010");
  });

  it("starts from the group's prefix when nothing is placed yet", () => {
    expect(nextSymbolLabel([], "SB.")).toBe("SB.1");
    expect(nextSymbolLabel([], "4.1")).toBe("4.1");
    expect(nextSymbolLabel([])).toBe("1");
  });

  it("skips numbers already taken after a manual rename", () => {
    expect(nextSymbolLabel(["1.1", "1.3", "1.2"])).toBe("1.4");
  });

  it("starts a numbered series from a label that ends in no number", () => {
    expect(nextSymbolLabel(["Sub left"])).toBe("Sub left 2");
    expect(nextSymbolLabel(["Sub left", "Sub left 2"])).toBe("Sub left 3");
  });

  it("renumbers a group sequentially from a start label", () => {
    const symbols = [
      makeSymbol({ id: "a", groupId: "g1", label: "x" }),
      makeSymbol({ id: "b", groupId: "g1", label: "y" }),
      makeSymbol({ id: "c", groupId: "g1", label: "z" }),
    ];
    expect(renumberGroup(symbols, "2.1").map((s) => s.label)).toEqual(["2.1", "2.2", "2.3"]);
    expect(renumberGroup(symbols, "SB.08").map((s) => s.label)).toEqual(["SB.08", "SB.09", "SB.10"]);
  });
});

describe("legend", () => {
  const groups = [
    { id: "g1", label: "LS Gastro", color: "#e11d1d", shape: "circle" as const, description: "Bose DM6SE" },
    { id: "g2", label: "Subwoofer", color: "#1d4ed8", shape: "circle" as const },
    { id: "g3", label: "Unused", color: "#000000", shape: "square" as const },
  ];
  const symbols = [
    makeSymbol({ id: "s1", groupId: "g1", label: "1.1" }),
    makeSymbol({ id: "s2", groupId: "g1", label: "1.2" }),
    makeSymbol({ id: "s3", groupId: "g2", label: "SB.1" }),
  ];

  it("lists one row per group with its symbol count, hiding unused groups when asked", () => {
    const page = makePage({ groups, symbols, legend: { ...createDefaultLegend(paper), onlyUsedGroups: true } });
    const rows = buildLegendRows(page);
    expect(rows.map((r) => r.label)).toEqual(["LS Gastro", "Subwoofer"]); // g3 has no symbols
    expect(rows[0].count).toBe(2);
    expect(rows[1].count).toBe(1);
  });

  it("lists every group by default — a group is created on purpose", () => {
    const page = makePage({ groups, symbols });
    expect(page.legend.onlyUsedGroups).toBe(false);
    expect(buildLegendRows(page).map((r) => r.label)).toEqual(["LS Gastro", "Subwoofer", "Unused"]);
  });

  it("stretches to a minimum height so it can cover the architect's legend", () => {
    const page = makePage({ groups, symbols });
    const rows = buildLegendRows(page);
    const natural = legendHeightMm(rows, page.legend);
    expect(legendHeightMm(rows, { ...page.legend, minHeightMm: natural + 40 })).toBeCloseTo(natural + 40);
    expect(legendHeightMm(rows, { ...page.legend, minHeightMm: 5 })).toBeCloseTo(natural);
  });

  it("prefers the uploaded image over the remote reference", () => {
    expect(legendRowImage({ imageSrc: "data:x", imageUrl: "https://img" })).toBe("data:x");
    expect(legendRowImage({ imageUrl: "https://img" })).toBe("https://img");
    expect(legendRowImage({})).toBeUndefined();
  });

  it("honors per-group hiding", () => {
    const page = makePage({ groups: [{ ...groups[0], hiddenInLegend: true }, groups[1]], symbols });
    expect(buildLegendRows(page).map((r) => r.label)).toEqual(["Subwoofer"]);
  });

  it("grows the box for images and notes", () => {
    const page = makePage({ groups, symbols });
    const rows = buildLegendRows(page);
    const plain = legendHeightMm(rows, { ...page.legend, showImages: false, notes: [] });
    const withImages = legendHeightMm(rows, { ...page.legend, showImages: true, notes: [] });
    const withNotes = legendHeightMm(rows, { ...page.legend, showImages: false, notes: ["a", "b"] });
    expect(withImages).toBeGreaterThan(plain);
    expect(withNotes).toBeGreaterThan(plain);
    // Blank note lines don't inflate the box
    expect(legendHeightMm(rows, { ...page.legend, showImages: false, notes: ["  ", ""] })).toBe(plain);
  });

  it("parks the default legend box inside the drawing area", () => {
    const legend = createDefaultLegend(paper);
    const area = drawingAreaMm(paper);
    expect(legend.positionMm.x).toBeGreaterThanOrEqual(area.x);
    expect(legend.positionMm.x + legend.widthMm).toBeLessThanOrEqual(area.x + area.w);
    expect(legend.positionMm.y).toBeGreaterThanOrEqual(area.y);
  });
});

describe("schedule", () => {
  it("reports each symbol's position in real-world metres from the drawing area corner", () => {
    const area = drawingAreaMm(paper);
    const page = makePage({
      groups: [{ id: "g1", label: "LS Gastro", color: "#e11d1d", shape: "circle" }],
      symbols: [
        makeSymbol({ id: "s1", groupId: "g1", label: "1.1", positionMm: { x: area.x + 100, y: area.y + 60 }, deviceNodeId: "device-3" }),
      ],
    });
    const rows = buildFloorplanSchedule(page, (id) => (id === "device-3" ? "Bose DM6SE 1" : undefined));
    expect(rows).toHaveLength(1);
    // 100 mm on paper at 1:50 = 5 m
    expect(rows[0].xM).toBeCloseTo(5);
    expect(rows[0].yM).toBeCloseTo(3);
    expect(rows[0].deviceLabel).toBe("Bose DM6SE 1");
    expect(rows[0].groupLabel).toBe("LS Gastro");
  });

  it("leaves the device column blank for symbols with no linked device", () => {
    const page = makePage({
      groups: [{ id: "g1", label: "LS", color: "#e11d1d", shape: "circle" }],
      symbols: [makeSymbol({ id: "s1", groupId: "g1", label: "1.1" })],
    });
    expect(buildFloorplanSchedule(page, () => undefined)[0].deviceLabel).toBe("");
  });
});

describe("symbol label placement", () => {
  it("offsets the number clear of the symbol by default", () => {
    const symbol = makeSymbol({ id: "s1", groupId: "g1", label: "1.1", positionMm: { x: 100, y: 100 } });
    const anchor = symbolLabelAnchor(symbol, 6);
    expect(anchor.x).toBeGreaterThan(100 + 3); // past the symbol's radius
    expect(anchor.y).toBe(100);
  });

  it("honors a dragged label offset", () => {
    const symbol = makeSymbol({ id: "s1", groupId: "g1", label: "1.1", positionMm: { x: 100, y: 100 }, labelOffsetMm: { x: -12, y: -8 } });
    expect(symbolLabelAnchor(symbol, 6)).toEqual({ x: 88, y: 92 });
  });
});

describe("text wrapping", () => {
  it("breaks on width and keeps explicit newlines", () => {
    // 20 mm at 2.8 mm caps ≈ 12 chars per line
    const lines = wrapText("Mount on the ceiling\nsecond paragraph", 20, 2.8);
    expect(lines.length).toBeGreaterThan(2);
    expect(lines).toContain("second");
    expect(lines.join(" ")).toContain("Mount on the");
  });

  it("hard-splits a word longer than the line so nothing escapes the box", () => {
    const lines = wrapText("Supercalifragilistic", 10, 2.8);
    expect(lines.every((l) => l.length <= Math.floor(10 / (2.8 * AVG_GLYPH_WIDTH_FACTOR)))).toBe(true);
    expect(lines.join("")).toBe("Supercalifragilistic");
  });

  it("keeps a blank line for an empty paragraph", () => {
    expect(wrapText("a\n\nb", 50, 3)).toEqual(["a", "", "b"]);
  });
});

describe("drawing block", () => {
  const ctx = {
    titleBlock: { showName: "Cafe & Bar Celona", venue: "Nikolaiort 6, Osnabrück", designer: "SP", engineer: "JL", date: "04.09.26", drawingTitle: "Loudspeaker layout", company: "FACE GmbH", revision: "A" },
    page: { label: "Erdgeschoss", scaleDenominator: 50, paperId: "iso-a1", orientation: "landscape" as const },
    projectName: "CBC Osnabrück",
  };

  it("resolves title block, page and sheet tokens", () => {
    expect(resolveFloorplanTokens("{{showName}} · {{scale}} · {{pageLabel}}", ctx)).toBe("Cafe & Bar Celona · 1:50 · Erdgeschoss");
    expect(resolveFloorplanTokens("{{sheetSize}}", ctx)).toBe("841 × 594 mm (A1)");
    expect(resolveFloorplanTokens("{{ designer }}/{{engineer}}", ctx)).toBe("SP/JL");
    expect(resolveFloorplanTokens("{{projectName}}", ctx)).toBe("CBC Osnabrück");
  });

  it("leaves an unknown token visible instead of swallowing it", () => {
    expect(resolveFloorplanTokens("{{nope}}", ctx)).toBe("{{nope}}");
  });

  it("stacks revisions → disclaimer → title → fields → footer and sizes the box", () => {
    const block = createDefaultDrawingBlock(paper);
    block.revisions = [
      { index: "A", date: "01.09.26", description: "First issue" },
      { index: "B", date: "04.09.26", description: "Speakers moved" },
    ];
    block.disclaimer = "All dimensions to be verified on site.";
    const layout = layoutDrawingBlock(block, ctx, { hasLogo: true });
    expect(layout.sections.map((s) => s.kind)).toEqual(["revisions", "disclaimer", "title", "fields", "footer"]);
    // Sections tile the block with no gaps
    let y = 0;
    for (const s of layout.sections) { expect(s.yMm).toBeCloseTo(y); y += s.heightMm; }
    expect(layout.heightMm).toBeCloseTo(y);
    // Newest revision prints first
    expect(layout.revisionRows[0].index).toBe("B");
    expect(layout.title).toBe("Erdgeschoss");
    expect(layout.subtitle).toBe("Loudspeaker layout");
  });

  it("omits empty sections", () => {
    const block = { ...createDefaultDrawingBlock(paper), revisions: [], disclaimer: "", showLogo: false, showNorthArrow: false, subtitle: "" };
    const layout = layoutDrawingBlock(block, ctx, { hasLogo: false });
    expect(layout.sections.map((s) => s.kind)).toEqual(["title", "fields"]);
    expect(layout.showFooter).toBe(false);
  });

  it("lays wide fields across both columns and pairs the rest", () => {
    const block = createDefaultDrawingBlock(paper);
    const layout = layoutDrawingBlock(block, ctx, { hasLogo: false });
    const project = layout.fieldCells.find((c) => c.field.label === "Project")!;
    const scale = layout.fieldCells.find((c) => c.field.label === "Scale")!;
    const sheet = layout.fieldCells.find((c) => c.field.label === "Sheet")!;
    expect(project.wMm).toBeCloseTo(layout.innerWMm);
    expect(scale.yMm).toBeCloseTo(sheet.yMm); // same row
    expect(scale.xMm).toBeLessThan(sheet.xMm);
    expect(scale.lines).toEqual(["1:50"]);
  });

  it("parks the default block inside the drawing area", () => {
    const block = createDefaultDrawingBlock(paper);
    const area = drawingAreaMm(paper);
    // With a logo and a real client address the block is still expected to fit.
    const h = layoutDrawingBlock(block, ctx, { hasLogo: true }).heightMm;
    expect(block.positionMm.x).toBeGreaterThanOrEqual(area.x);
    expect(block.positionMm.x + block.widthMm).toBeLessThanOrEqual(area.x + area.w);
    expect(block.positionMm.y + h).toBeLessThanOrEqual(area.y + area.h + 0.01);
  });

  it("advances the revision index like a plan set does", () => {
    expect(nextRevisionIndex([])).toBe("A");
    expect(nextRevisionIndex([{ index: "A", date: "", description: "" }])).toBe("B");
    expect(nextRevisionIndex([{ index: "Z", date: "", description: "" }])).toBe("ZA");
    expect(nextRevisionIndex([{ index: "01", date: "", description: "" }])).toBe("02");
    expect(nextRevisionIndex([{ index: "09", date: "", description: "" }])).toBe("10");
  });

  it("stamps dates the German way", () => {
    expect(formatPlanDate(new Date(2026, 8, 4))).toBe("04.09.26");
  });
});

describe("notes", () => {
  it("wraps a note to its width and reports its height", () => {
    const note = { id: "n1", positionMm: { x: 0, y: 0 }, widthMm: 30, text: "DM6SE: mount on the ceiling, cable 5 cm from the wall.", fontSizeMm: 2.8, boxed: true };
    const layout = layoutNote(note);
    expect(layout.lines.length).toBeGreaterThan(1);
    expect(layout.heightMm).toBeCloseTo(layout.lines.length * layout.lineHeightMm + 3);
  });
});

describe("sheet adopts the plan's format", () => {
  it("recognises standard sizes in either orientation, with plotter tolerance", () => {
    // A1 portrait as a PDF page box: 594.0 × 840.9 mm (points rounding)
    expect(matchPaperToSize(594.0, 840.9)).toEqual({ paperId: "iso-a1", orientation: "portrait" });
    expect(matchPaperToSize(841, 594)).toEqual({ paperId: "iso-a1", orientation: "landscape" });
    expect(matchPaperToSize(297, 420)).toEqual({ paperId: "iso-a3", orientation: "portrait" });
    expect(matchPaperToSize(279.4, 431.8)).toEqual({ paperId: "tabloid", orientation: "portrait" });
  });

  it("falls back to a custom sheet of exactly the source size", () => {
    const choice = matchPaperToSize(700, 500);
    expect(choice.paperId).toBe("custom");
    expect(choice.orientation).toBe("landscape");
    expect(choice.customWidthIn! * 25.4).toBeCloseTo(500);
    expect(choice.customHeightIn! * 25.4).toBeCloseTo(700);
    const sheet = sheetSizeMm({ paperId: "custom", orientation: "landscape", customWidthIn: choice.customWidthIn, customHeightIn: choice.customHeightIn });
    expect(sheet.w).toBeCloseTo(700);
    expect(sheet.h).toBeCloseTo(500);
  });

  it("covers the sheet 1:1 when the source has the sheet's aspect, else fits it inside", () => {
    const portraitA1 = { paperId: "iso-a1", orientation: "portrait" as const };
    const sheet = sheetSizeMm(portraitA1);
    // A PDF page rendered at 1683 × 2384 px (A1 portrait)
    const exact = fillSheetPlacement(portraitA1, { naturalWidthPx: 1683, naturalHeightPx: 2384 });
    expect(exact.positionMm).toEqual({ x: 0, y: 0 });
    expect(exact.sizeMm.w).toBeCloseTo(sheet.w);
    expect(exact.sizeMm.h).toBeCloseTo(sheet.h);
    // A square scan is fitted, not stretched
    const fitted = fillSheetPlacement(portraitA1, { naturalWidthPx: 1000, naturalHeightPx: 1000 });
    expect(fitted.sizeMm.w).toBeCloseTo(fitted.sizeMm.h);
    expect(fitted.sizeMm.w).toBeCloseTo(sheet.w);
    expect(fitted.positionMm.y).toBeGreaterThan(0);
  });
});

describe("masks", () => {
  it("normalizes a drag in any direction into a top-left rect clamped to the sheet", () => {
    const r = rectFromDrag({ x: 300, y: 200 }, { x: 100, y: 50 }, paper);
    expect(r.positionMm).toEqual({ x: 100, y: 50 });
    expect(r.sizeMm).toEqual({ w: 200, h: 150 });
    const clamped = rectFromDrag({ x: -20, y: 10 }, { x: 5000, y: 20 }, paper);
    expect(clamped.positionMm.x).toBe(0);
    expect(clamped.positionMm.x + clamped.sizeMm.w).toBeCloseTo(sheetSizeMm(paper).w);
  });
});

describe("drawing block min height", () => {
  it("gives the extra height to the title band and shifts the sections below", () => {
    const ctx = {
      titleBlock: { showName: "", venue: "", designer: "", engineer: "", date: "", drawingTitle: "", company: "", revision: "" },
      page: { label: "EG", scaleDenominator: 50, paperId: "iso-a1", orientation: "portrait" as const },
      projectName: "",
    };
    const block = createDefaultDrawingBlock(paper);
    const natural = layoutDrawingBlock(block, ctx, { hasLogo: false });
    const stretched = layoutDrawingBlock({ ...block, minHeightMm: natural.heightMm + 50 }, ctx, { hasLogo: false });
    expect(stretched.heightMm).toBeCloseTo(natural.heightMm + 50);
    const t0 = natural.sections.find((s) => s.kind === "title")!;
    const t1 = stretched.sections.find((s) => s.kind === "title")!;
    expect(t1.heightMm).toBeCloseTo(t0.heightMm + 50);
    const f0 = natural.sections.find((s) => s.kind === "fields")!;
    const f1 = stretched.sections.find((s) => s.kind === "fields")!;
    expect(f1.yMm).toBeCloseTo(f0.yMm + 50);
    expect(stretched.fieldCells[0].yMm).toBeCloseTo(natural.fieldCells[0].yMm + 50);
  });
});

describe("legend text from the device library", () => {
  it("joins manufacturer, model and the fixed cable spec", () => {
    expect(legendDescriptionFor({ manufacturer: "Bose Professional", modelNumber: "DesignMax DM6SE", installCable: "Kabel aus Decke: 2x2,5 mm²" }))
      .toBe("Bose Professional DesignMax DM6SE | Kabel aus Decke: 2x2,5 mm²");
    expect(legendDescriptionFor({ manufacturer: "Bose", model: "MB210" })).toBe("Bose MB210");
    expect(legendDescriptionFor({ label: "Sub links", installCable: "2x4 mm²" })).toBe("Sub links | 2x4 mm²");
    expect(legendDescriptionFor({})).toBeUndefined();
  });

  it("prefixes the installation note with the model", () => {
    expect(legendInstallNoteFor({ modelNumber: "DM6SE", installNotes: "Montage an der Decke." })).toBe("DM6SE: Montage an der Decke.");
    expect(legendInstallNoteFor({ modelNumber: "DM6SE" })).toBeUndefined();
  });

  it("appends a note once", () => {
    expect(appendLegendNote(undefined, "a")).toEqual(["a"]);
    expect(appendLegendNote(["a"], "a")).toEqual(["a"]);
    expect(appendLegendNote(["a", ""], "b")).toEqual(["a", "b"]);
    expect(appendLegendNote(["a"], undefined)).toEqual(["a"]);
  });
});

describe("company block", () => {
  const face = { name: "FACE GmbH", addressLines: ["Musterstraße 1", "", "49074 Osnabrück"], phone: "0541 123", email: "info@face-gmbh.com", web: "www.face-gmbh.com", logo: "data:image/png;base64,x" };

  it("knows when there is something to print", () => {
    expect(hasCompanyProfile(null)).toBe(false);
    expect(hasCompanyProfile({ name: " ", addressLines: [""] })).toBe(false);
    expect(hasCompanyProfile({ name: "FACE", addressLines: [] })).toBe(true);
    expect(hasCompanyProfile({ name: "", addressLines: [], logo: "data:x" })).toBe(true);
  });

  it("lists name, address and a joined contact line, skipping blanks", () => {
    expect(companyContactLine(face)).toBe("Tel. 0541 123 · info@face-gmbh.com · www.face-gmbh.com");
    expect(companyProfileLines(face)).toEqual(["FACE GmbH", "Musterstraße 1", "49074 Osnabrück", "Tel. 0541 123 · info@face-gmbh.com · www.face-gmbh.com"]);
  });

  it("adds its height to the legend unless switched off", () => {
    const page = makePage({ groups: [{ id: "g1", label: "LS", color: "#e11d1d", shape: "circle" }] });
    const rows = buildLegendRows(page);
    const without = legendHeightMm(rows, page.legend);
    expect(legendHeightMm(rows, page.legend, face)).toBeCloseTo(without + legendCompanyHeightMm(face));
    expect(legendHeightMm(rows, { ...page.legend, showCompany: false }, face)).toBeCloseTo(without);
    expect(legendHeightMm(rows, page.legend, { name: "", addressLines: [] })).toBeCloseTo(without);
  });

  it("resolves the company tokens in the drawing block", () => {
    const ctx = {
      titleBlock: { showName: "", venue: "", designer: "", engineer: "", date: "", drawingTitle: "", company: "", revision: "" },
      page: { label: "EG", scaleDenominator: 50, paperId: "iso-a1", orientation: "portrait" as const },
      projectName: "",
      company: face,
    };
    expect(resolveFloorplanTokens("{{companyName}}", ctx)).toBe("FACE GmbH");
    expect(resolveFloorplanTokens("{{companyAddress}}", ctx)).toBe("Musterstraße 1\n49074 Osnabrück");
    expect(resolveFloorplanTokens("{{companyContact}}", { ...ctx, company: null })).toBe("");
  });
});

describe("plan symbols from the library", () => {
  it("takes the template's own symbol when it has one", () => {
    const sym = planSymbolFor({ planSymbol: { shape: "square", color: "#1d4ed8", glyph: "Sub" }, deviceType: "speaker", templateId: "t1" });
    expect(sym).toEqual({ shape: "square", color: "#1d4ed8", glyph: "Su" }); // glyph capped at two chars
  });

  it("derives shape from the device type and a stable color from the id otherwise", () => {
    expect(defaultSymbolShapeFor("speaker")).toBe("circle");
    expect(defaultSymbolShapeFor("subwoofer")).toBe("square");
    expect(defaultSymbolShapeFor("microphone")).toBe("triangle");
    expect(defaultSymbolShapeFor("display")).toBe("display");
    expect(defaultSymbolShapeFor("projector")).toBe("projector");
    expect(defaultSymbolShapeFor("ptz-camera")).toBe("camera");
    expect(defaultSymbolShapeFor("rack")).toBe("rack");
    expect(defaultSymbolShapeFor("video-wall-controller")).toBe("display");
    expect(defaultSymbolShapeFor("studio-monitor")).toBe("diamond");
    expect(defaultSymbolColorFor("face-0015")).toBe(defaultSymbolColorFor("face-0015"));
    const sym = planSymbolFor({ deviceType: "subwoofer", templateId: "face-0015" });
    expect(sym.shape).toBe("square");
    expect(sym.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(sym.glyph).toBeUndefined();
  });

  it("draws every shape from primitives that fit the symbol square", () => {
    for (const shape of FLOORPLAN_SYMBOL_SHAPES) {
      const prims = symbolPrimitives(shape, 6);
      expect(prims.length).toBeGreaterThan(0);
      for (const p of prims) {
        const pts = p.kind === "polygon" ? p.points : p.kind === "line" ? [p.from, p.to] : [{ x: p.center.x - p.r, y: p.center.y - p.r }, { x: p.center.x + p.r, y: p.center.y + p.r }];
        for (const q of pts) {
          expect(Math.abs(q.x)).toBeLessThanOrEqual(3.0001);
          expect(Math.abs(q.y)).toBeLessThanOrEqual(3.0001);
        }
      }
    }
    // The abstract shapes keep their old outline; pictograms carry a body in the group color.
    expect(symbolPrimitives("circle", 6)).toEqual([{ kind: "circle", center: { x: 0, y: 0 }, r: 3, fill: "color" }]);
    expect(symbolPrimitives("square", 6)).toEqual([{ kind: "polygon", points: symbolPolygon("square", 6), fill: "color" }]);
    expect(symbolPrimitives("projector", 6).some((p) => p.kind === "polygon" && p.fill === "color")).toBe(true);
    expect(symbolPrimitives("rack", 6).filter((p) => p.kind === "line")).toHaveLength(2);
    expect(FLOORPLAN_SYMBOL_SHAPES.every((sh) => FLOORPLAN_SYMBOL_SHAPE_LABELS[sh])).toBe(true);
  });

  it("turns a point clockwise about the origin, and leaves 0° alone", () => {
    const p = { x: 3, y: 0 };
    expect(rotateVec(p, 0)).toBe(p);
    const q = rotateVec(p, 90);
    expect(q.x).toBeCloseTo(0, 6);
    expect(q.y).toBeCloseTo(3, 6);
    const r = rotateVec(p, 180);
    expect(r.x).toBeCloseTo(-3, 6);
    expect(r.y).toBeCloseTo(0, 6);
    // Turning a pictogram turns every one of its parts, so the picture stays whole.
    const turned = symbolPrimitives("projector", 6).map((prim) =>
      prim.kind === "line" ? rotateVec(prim.from, 90) : prim.kind === "circle" ? rotateVec(prim.center, 90) : rotateVec(prim.points[0], 90),
    );
    expect(turned).toHaveLength(symbolPrimitives("projector", 6).length);
  });

  it("carries a model's uploaded symbol picture onto the group and the legend", () => {
    const png = "data:image/png;base64,AAAA";
    const sym = planSymbolFor({ planSymbol: { shape: "square", imageSrc: png }, templateId: "t1" });
    expect(sym.imageSrc).toBe(png);
    expect(planSymbolFor({ deviceType: "speaker", templateId: "t1" }).imageSrc).toBeUndefined();

    const page = makePage({
      groups: [{ id: "g1", label: "LS", color: "#e11d1d", shape: "circle", symbolImageSrc: png }],
      symbols: [makeSymbol({ id: "s1", groupId: "g1", label: "1.1" })],
    });
    expect(buildLegendRows(page)[0].symbolImageSrc).toBe(png);
  });

  it("grows a turned square by cos+sin so a rotated picture keeps its scale", () => {
    expect(rotatedSquareFactor(0)).toBeCloseTo(1, 6);
    expect(rotatedSquareFactor(90)).toBeCloseTo(1, 6);
    expect(rotatedSquareFactor(45)).toBeCloseTo(Math.SQRT2, 6);
  });

  it("scales the outline with the drawn size and switches it off at zero", () => {
    // Default: a fraction of the symbol size, so a 12 px chip and a 6 mm print match.
    expect(symbolOutlineWidth({}, 6, 6)).toBeCloseTo(6 * DEFAULT_SYMBOL_OUTLINE_RATIO, 6);
    expect(symbolOutlineWidth({}, 12, 6)).toBeCloseTo(12 * DEFAULT_SYMBOL_OUTLINE_RATIO, 6);
    // An explicit width is given in paper mm and converted to the caller's unit.
    expect(symbolOutlineWidth({ outlineWidthMm: 0.5 }, 6, 6)).toBeCloseTo(0.5, 6);
    expect(symbolOutlineWidth({ outlineWidthMm: 0.5 }, 60, 6)).toBeCloseTo(5, 6);
    // Zero means no outline at all, on screen and on paper alike.
    expect(symbolOutlineWidth({ outlineWidthMm: 0 }, 60, 6)).toBe(0);
    expect(symbolOutlineColor({})).toBe(DEFAULT_SYMBOL_OUTLINE);
    expect(symbolOutlineColor({ outlineColor: "#ff0000" })).toBe("#ff0000");
  });

  it("carries a model's outline onto the group", () => {
    const sym = planSymbolFor({ planSymbol: { shape: "square", outlineColor: "#112233", outlineWidthMm: 0 }, templateId: "t1" });
    expect(sym.outlineColor).toBe("#112233");
    expect(sym.outlineWidthMm).toBe(0);
    expect(planSymbolFor({ deviceType: "speaker", templateId: "t1" }).outlineColor).toBeUndefined();
  });

  it("takes a switched-off layer out of the legend but leaves it in the project", () => {
    const page = makePage({
      groups: [
        { id: "g1", label: "Lautsprecher", color: "#e11d1d", shape: "circle" as const },
        { id: "g2", label: "Video", color: "#1d4ed8", shape: "diamond" as const, hidden: true },
      ],
      symbols: [
        makeSymbol({ id: "s1", groupId: "g1", label: "1" }),
        makeSymbol({ id: "s2", groupId: "g2", label: "2" }),
      ],
    });
    expect(buildLegendRows(page).map((r) => r.label)).toEqual(["Lautsprecher"]);
    // The symbols are still there — a layer is switched off, not deleted.
    expect(page.symbols).toHaveLength(2);
    expect(isGroupVisible(page.groups[0])).toBe(true);
    expect(isGroupVisible(page.groups[1])).toBe(false);
    expect(isGroupVisible(undefined)).toBe(false);
  });

  it("picks a readable glyph color", () => {
    expect(glyphColorOn("#facc15")).toBe("#000000");
    expect(glyphColorOn("#1d4ed8")).toBe("#ffffff");
  });
});

describe("loudspeaker numbering", () => {
  it("composes line.speaker labels and drops the separator when there is no line", () => {
    expect(formatSymbolLabel("{{line}}.{{n}}", { line: "4", n: 2 })).toBe("4.2");
    expect(formatSymbolLabel("{{line}}.{{n}}", { line: "SB", n: 1 })).toBe("SB.1");
    expect(formatSymbolLabel("{{line}}.{{n}}", { n: 7 })).toBe("7");
    expect(formatSymbolLabel("{{group}} {{n}}", { n: 3, group: "Sub" })).toBe("Sub 3");
  });

  it("numbers per line, one past the highest in use", () => {
    const syms = [{ lineNo: "4", seq: 1 }, { lineNo: "4", seq: 3 }, { lineNo: "5", seq: 1 }];
    expect(nextSeqInLine(syms, "4")).toBe(4);
    expect(nextSeqInLine(syms, "5")).toBe(2);
    expect(nextSeqInLine(syms, "9")).toBe(1);
    expect(nextSeqInLine(syms, undefined)).toBe(1);
  });

  it("renumbers a line in placement order without touching other lines", () => {
    const syms = [
      makeSymbol({ id: "a", groupId: "g", label: "4.3", lineNo: "4", seq: 3 }),
      makeSymbol({ id: "b", groupId: "g", label: "5.1", lineNo: "5", seq: 1 }),
      makeSymbol({ id: "c", groupId: "g", label: "4.7", lineNo: "4", seq: 7 }),
    ];
    const out = renumberLine(syms, "4", "{{line}}.{{n}}", () => undefined);
    expect(out.map((s) => s.label)).toEqual(["4.1", "5.1", "4.2"]);
    expect(linesOnPage(out)).toEqual([{ lineNo: "4", count: 2 }, { lineNo: "5", count: 1 }]);
  });

  it("uses the kind's template unless the page overrides it", () => {
    expect(effectiveLabelTemplate({ kind: "loudspeaker" })).toBe("{{line}}.{{n}}");
    expect(effectiveLabelTemplate({})).toBe("{{n}}");
    expect(effectiveLabelTemplate({ kind: "loudspeaker", labelTemplate: "L{{line}}-{{n}}" })).toBe("L{{line}}-{{n}}");
  });

  it("places labels clear of the symbol on every side with a sensible alignment", () => {
    const e = labelPlacementFor("e", 6, 3.5);
    expect(e.labelOffsetMm.x).toBeGreaterThan(3);
    expect(e.labelAlign).toBe("start");
    const w = labelPlacementFor("w", 6, 3.5);
    expect(w.labelOffsetMm.x).toBeLessThan(-3);
    expect(w.labelAlign).toBe("end");
    const n = labelPlacementFor("n", 6, 3.5);
    expect(n.labelOffsetMm.y).toBeLessThan(-3);
    expect(n.labelAlign).toBe("middle");
  });
});

describe("coverage areas", () => {
  /** A 12 m reach at 1:50 is 240 mm of paper — the bridge every shape is measured by. */
  const scale = 50;

  function makeCoverage(over: Partial<FloorplanCoverage> = {}): FloorplanCoverage {
    return { id: "c1", shape: "sector", positionMm: { x: 0, y: 0 }, rangeM: 12, apertureDeg: 90, ...over };
  }

  it("measures a sector's reach through the drawing scale, not the paper", () => {
    const wedge = makeCoverage();
    const at50 = coverageOutlineMm(wedge, 50);
    const at100 = coverageOutlineMm(wedge, 100);
    // 12 m = 12000 real mm → 240 paper mm at 1:50, 120 mm at 1:100.
    expect(Math.hypot(at50[1].x, at50[1].y)).toBeCloseTo(240, 5);
    expect(Math.hypot(at100[1].x, at100[1].y)).toBeCloseTo(120, 5);
  });

  it("opens a sector symmetrically about the direction it faces, starting at the device", () => {
    const pts = coverageOutlineMm(makeCoverage({ apertureDeg: 90 }), scale);
    // First point is the apex — the device itself.
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    const angles = pts.slice(1).map((p) => (Math.atan2(p.y, p.x) * 180) / Math.PI);
    expect(Math.min(...angles)).toBeCloseTo(-45, 5);
    expect(Math.max(...angles)).toBeCloseTo(45, 5);
  });

  it("drops the apex once a sector has opened all the way round", () => {
    const ring = coverageOutlineMm(makeCoverage({ apertureDeg: 360 }), scale);
    // No point sits at the centre, or the ring would close through the device.
    expect(ring.every((p) => Math.hypot(p.x, p.y) > 1)).toBe(true);
    // And it does not double back on its own first point.
    expect(Math.hypot(ring[0].x - ring[ring.length - 1].x, ring[0].y - ring[ring.length - 1].y)).toBeGreaterThan(1);
  });

  it("clamps the aperture to something drawable", () => {
    expect(coverageApertureDeg({ apertureDeg: 0 })).toBe(1);
    expect(coverageApertureDeg({ apertureDeg: 999 })).toBe(360);
    expect(coverageApertureDeg({ apertureDeg: undefined })).toBe(90);
    expect(coverageApertureDeg({ apertureDeg: NaN })).toBe(90);
  });

  it("draws a circle centred on the device and a corridor reaching away from it", () => {
    const ring = coverageOutlineMm(makeCoverage({ shape: "circle", rangeM: 8 }), scale);
    for (const p of ring) expect(Math.hypot(p.x, p.y)).toBeCloseTo(160, 5);

    const corridor = coverageOutlineMm(makeCoverage({ shape: "rect", rangeM: 15, widthM: 2 }), scale);
    expect(corridor).toHaveLength(4);
    // 15 m deep = 300 mm, 2 m wide = 40 mm, i.e. ±20 mm about the axis.
    expect(corridor.map((p) => p.x)).toEqual([0, 300, 300, 0]);
    expect(corridor.map((p) => p.y)).toEqual([-20, -20, 20, 20]);
  });

  it("keeps a mistyped range inside what a device could plausibly reach", () => {
    const tiny = coverageOutlineMm(makeCoverage({ shape: "circle", rangeM: 0 }), scale);
    expect(Math.hypot(tiny[0].x, tiny[0].y)).toBeCloseTo((COVERAGE_MIN_RANGE_M * 1000) / scale, 5);
    const huge = coverageOutlineMm(makeCoverage({ shape: "circle", rangeM: 99999 }), scale);
    expect(Math.hypot(huge[0].x, huge[0].y)).toBeCloseTo((COVERAGE_MAX_RANGE_M * 1000) / scale, 5);
  });

  it("anchors to its symbol and adds the device's own aim to its offset", () => {
    const symbols = [makeSymbol({ id: "s1", groupId: "g", label: "K1", positionMm: { x: 100, y: 60 }, rotationDeg: 90 })];
    const anchored = makeCoverage({ symbolId: "s1", rotationDeg: 10, positionMm: { x: 0, y: 0 } });
    expect(coverageAnchorMm(anchored, symbols)).toEqual({ x: 100, y: 60 });
    expect(coverageRotationDeg(anchored, symbols)).toBe(100);
    // Free-standing areas keep their own position and facing.
    const free = makeCoverage({ positionMm: { x: 20, y: 30 }, rotationDeg: 45 });
    expect(coverageAnchorMm(free, symbols)).toEqual({ x: 20, y: 30 });
    expect(coverageRotationDeg(free, symbols)).toBe(45);
  });

  it("falls back to its own position when the symbol it pointed at is gone", () => {
    const orphan = makeCoverage({ symbolId: "deleted", positionMm: { x: 7, y: 9 }, rotationDeg: 30 });
    expect(coverageAnchorMm(orphan, [])).toEqual({ x: 7, y: 9 });
    expect(coverageRotationDeg(orphan, [])).toBe(30);
  });

  it("places a turned area on the sheet where the device points", () => {
    const symbols = [makeSymbol({ id: "s1", groupId: "g", label: "K1", positionMm: { x: 100, y: 100 }, rotationDeg: 90 })];
    const page = makePage({ symbols, scaleDenominator: scale });
    const pts = coveragePointsOnSheet(makeCoverage({ symbolId: "s1", rangeM: 5, apertureDeg: 90 }), page);
    // Apex on the device; a camera aimed at 90° looks down the sheet, so the wedge is below it.
    expect(pts[0]).toEqual({ x: 100, y: 100 });
    expect(Math.max(...pts.map((p) => p.y))).toBeGreaterThan(100);
    expect(pts.every((p) => p.y >= 99.99)).toBe(true);
  });

  it("takes its color from the group unless it carries its own", () => {
    const groups = [{ id: "g1", color: "#ff0000" }];
    expect(coverageColor(makeCoverage({ groupId: "g1" }), groups)).toBe("#ff0000");
    expect(coverageColor(makeCoverage({ groupId: "g1", color: "#00ff00" }), groups)).toBe("#00ff00");
    expect(coverageColor(makeCoverage(), groups)).toBe(DEFAULT_COVERAGE_COLOR);
  });

  it("switches off with its group's layer, and on its own", () => {
    const groups = [{ id: "g1", hidden: true }, { id: "g2" }];
    expect(isCoverageVisible(makeCoverage({ groupId: "g1" }), groups)).toBe(false);
    expect(isCoverageVisible(makeCoverage({ groupId: "g2" }), groups)).toBe(true);
    expect(isCoverageVisible(makeCoverage({ groupId: "g2", hidden: true }), groups)).toBe(false);
    // No group at all is always shown; a group that no longer exists is orphaned, not hidden.
    expect(isCoverageVisible(makeCoverage(), groups)).toBe(true);
    expect(isCoverageVisible(makeCoverage({ groupId: "gone" }), groups)).toBe(true);
  });

  it("reads out the way a datasheet states it", () => {
    expect(formatCoverageSpec(makeCoverage({ rangeM: 12, apertureDeg: 90 }))).toBe("12.0 m / 90°");
    expect(formatCoverageSpec(makeCoverage({ shape: "circle", rangeM: 8 }))).toBe("R 8.0 m");
    expect(formatCoverageSpec(makeCoverage({ shape: "rect", rangeM: 15, widthM: 2 }))).toBe("15.0 × 2.0 m");
  });

  it("gives each shape the field that shape needs", () => {
    expect(defaultCoverage("sector").apertureDeg).toBe(90);
    expect(defaultCoverage("sector").widthM).toBeUndefined();
    expect(defaultCoverage("rect").widthM).toBe(2);
    expect(defaultCoverage("circle").apertureDeg).toBeUndefined();
  });
});

describe("camera optics — reach from the lens", () => {
  function optics(over: Partial<CoverageOptics> = {}): CoverageOptics {
    return { megapixels: 4, aspectRatio: 16 / 9, dori: "recognise", ...over };
  }
  function camera(over: Partial<FloorplanCoverage> = {}): FloorplanCoverage {
    return { id: "c1", shape: "sector", positionMm: { x: 0, y: 0 }, rangeM: 12, apertureDeg: 90, optics: optics(), ...over };
  }

  it("derives the horizontal pixel count from megapixels and aspect ratio", () => {
    // w × h = MP and w ÷ h = aspect → w = √(MP · aspect). A "2 MP" 16:9 sensor is
    // 1920 px wide in reality; the derivation lands within a few percent of that.
    expect(coverageHorizontalPixels(optics({ megapixels: 2 }))).toBeCloseTo(1885.6, 1);
    expect(coverageHorizontalPixels(optics({ megapixels: 8 }))).toBeCloseTo(3771.2, 1);
    // A 4:3 sensor of the same megapixel count is narrower.
    expect(coverageHorizontalPixels(optics({ megapixels: 4, aspectRatio: 4 / 3 })))
      .toBeLessThan(coverageHorizontalPixels(optics({ megapixels: 4, aspectRatio: 16 / 9 })));
  });

  it("measures the scene the way a field of view actually opens", () => {
    // At 90° the half-angle is 45°, tan = 1, so the scene is exactly twice the distance.
    expect(coverageSceneWidthM(90, 10)).toBeCloseTo(20, 6);
    expect(coverageSceneWidthM(60, 10)).toBeCloseTo(2 * 10 * Math.tan(Math.PI / 6), 6);
  });

  it("hits the DORI density it was asked for, exactly at the drawn range", () => {
    // The range is defined as the distance where density still equals the requirement,
    // so measuring density back at that range has to return the requirement.
    for (const dori of ["detect", "observe", "recognise", "identify"] as const) {
      const o = optics({ dori });
      const range = coverageDoriRangeM(o, 90);
      expect(coveragePixelDensityAt(o, 90, range)).toBeCloseTo(DORI_PX_PER_M[dori], 4);
    }
  });

  it("reaches half as far for each doubling of the required density", () => {
    const o = optics();
    const observe = coverageDoriRangeM(optics({ dori: "observe" }), 90);
    const recognise = coverageDoriRangeM(optics({ dori: "recognise" }), 90);
    const identify = coverageDoriRangeM(optics({ dori: "identify" }), 90);
    expect(recognise).toBeCloseTo(observe / 2, 4);
    expect(identify).toBeCloseTo(recognise / 2, 4);
    // And the numbers are the ones a CCTV table gives: 4 MP at 90° recognises to ~11 m.
    expect(coverageDoriRangeM(o, 90)).toBeCloseTo(10.7, 1);
  });

  it("shortens the reach as the lens widens and lengthens it with more megapixels", () => {
    const narrow = coverageDoriRangeM(optics(), 30);
    const wide = coverageDoriRangeM(optics(), 120);
    expect(narrow).toBeGreaterThan(wide);

    const small = coverageDoriRangeM(optics({ megapixels: 2 }), 90);
    const big = coverageDoriRangeM(optics({ megapixels: 8 }), 90);
    expect(big).toBeGreaterThan(small);
    // Four times the pixels is twice the width, so twice the reach.
    expect(big).toBeCloseTo(small * 2, 4);
  });

  it("draws a camera at its computed reach and ignores the typed one", () => {
    // rangeM stays 12 in the record but must not be what gets drawn.
    const cam = camera({ rangeM: 12 });
    expect(effectiveRangeM(cam)).toBeCloseTo(10.7, 1);
    expect(effectiveRangeM(cam)).not.toBeCloseTo(12, 1);
    // Drop the optics and the typed reach takes over again.
    expect(effectiveRangeM({ ...cam, optics: undefined })).toBe(12);
  });

  it("re-computes the reach when the opening angle changes, with nothing written back", () => {
    const at90 = effectiveRangeM(camera({ apertureDeg: 90 }));
    const at45 = effectiveRangeM(camera({ apertureDeg: 45 }));
    expect(at45).toBeGreaterThan(at90);
    // The outline follows, which is the whole point — no stale rangeM can survive.
    const wedge90 = coverageOutlineMm(camera({ apertureDeg: 90 }), 50);
    const wedge45 = coverageOutlineMm(camera({ apertureDeg: 45 }), 50);
    expect(Math.hypot(wedge45[1].x, wedge45[1].y)).toBeGreaterThan(Math.hypot(wedge90[1].x, wedge90[1].y));
  });

  it("reads out as the lens rather than as a bare distance", () => {
    expect(formatCoverageSpec(camera({ apertureDeg: 90 }))).toBe("4 MP · 90° · 10.7 m (recognise)");
    expect(formatCoverageSpec(camera({ optics: undefined, rangeM: 12 }))).toBe("12.0 m / 90°");
  });

  it("keeps a camera's reach inside the same bounds as any other area", () => {
    // A pinhole-narrow lens on a huge sensor must not run off the sheet.
    const absurd = camera({ apertureDeg: 1, optics: optics({ megapixels: 64, dori: "detect" }) });
    expect(effectiveRangeM(absurd)).toBeLessThanOrEqual(COVERAGE_MAX_RANGE_M);
    const ultrawide = camera({ apertureDeg: 360, optics: optics({ megapixels: 0.3, dori: "identify" }) });
    expect(effectiveRangeM(ultrawide)).toBeGreaterThanOrEqual(COVERAGE_MIN_RANGE_M);
  });

  it("gives an access point a circle, not a wedge — it radiates all round", () => {
    // The bug this guards: a U7 Pro used to arrive with a 90° camera-style sector.
    expect(isAccessPointDeviceType("access-point")).toBe(true);
    expect(isAccessPointDeviceType("network-wifi")).toBe(true);
    expect(isAccessPointDeviceType("ip-camera")).toBe(false);

    const ap = defaultCoverageForDevice("access-point");
    expect(ap.shape).toBe("circle");
    expect(ap.apertureDeg).toBeUndefined();
    expect(ap.optics).toBeUndefined();
  });

  it("draws a wall-mounted access point as a wide sector, not a circle", () => {
    // A U7 Pro Wall or an in-wall unit throws into the room; only a ceiling unit is
    // all round. The mount comes off the model, not out of a guess.
    const wall = defaultCoverageForDevice("access-point", { mount: "wall" });
    expect(wall.shape).toBe("sector");
    expect(wall.apertureDeg).toBe(120);
    const ceiling = defaultCoverageForDevice("access-point", { mount: "ceiling" });
    expect(ceiling.shape).toBe("circle");
  });

  it("starts an access point's circle at the reach its own radio gives it", () => {
    const withRange = defaultCoverageForDevice("access-point", { rangeM: 24 });
    expect(withRange.shape).toBe("circle");
    expect(withRange.rangeM).toBe(24);
    // A detector's supplied reach is honoured too, and it stays a wedge.
    const det = defaultCoverageForDevice("motion-detector", { rangeM: 15 });
    expect(det.shape).toBe("sector");
    expect(det.rangeM).toBe(15);
  });

  it("gives a camera device a computing area and a detector a measured one", () => {
    expect(isCameraDeviceType("ip-camera")).toBe(true);
    expect(isCameraDeviceType("ptz-camera")).toBe(true);
    expect(isCameraDeviceType("motion-detector")).toBe(false);
    expect(isCameraDeviceType(undefined)).toBe(false);

    expect(defaultCoverageForDevice("ip-camera").optics).toEqual(defaultCameraOptics());
    expect(defaultCoverageForDevice("motion-detector").optics).toBeUndefined();
    expect(defaultCoverageForDevice(undefined).optics).toBeUndefined();
  });
});

describe("the Wi-Fi coverage plan type", () => {
  it("numbers access points AP1, AP2 … and carries the German presets", () => {
    const preset = FLOORPLAN_KIND_PRESETS.wifi;
    expect(preset.labelTemplate).toBe("AP{{n}}");
    expect(formatSymbolLabel(preset.labelTemplate, { n: 3 })).toBe("AP3");
    expect(effectiveLabelTemplate({ kind: "wifi" })).toBe("AP{{n}}");
    expect(preset.drawingSubtitle).toBe("WLAN-Ausleuchtung");
    expect(preset.legendTitle).toMatch(/WLAN-AUSLEUCHTUNG/);
    expect(preset.revisionHeaders[0]).toBe("INDEX");
  });

  it("prints the signal colour key on a coverage plan whose heatmap is on", () => {
    const legend = createDefaultLegend(paper);
    const heatOn = { visible: true, band: "5" as const, pathLossExponent: 2.6, opacity: 0.5, gridMm: 2.5 };
    expect(legendShowsRssiScale({ legend, kind: "wifi", heatmap: heatOn })).toBe(true);
    // Heatmap off: nothing to key.
    expect(legendShowsRssiScale({ legend, kind: "wifi", heatmap: { ...heatOn, visible: false } })).toBe(false);
    // A loudspeaker plan with a heatmap on is not a coverage plan and gets no key by default …
    expect(legendShowsRssiScale({ legend, kind: "loudspeaker", heatmap: heatOn })).toBe(false);
    // … but an explicit choice always wins, in either direction.
    expect(legendShowsRssiScale({ legend: { ...legend, showRssiScale: true }, kind: "generic" })).toBe(true);
    expect(legendShowsRssiScale({ legend: { ...legend, showRssiScale: false }, kind: "wifi", heatmap: heatOn })).toBe(false);
  });

  it("grows the legend by exactly the colour key's rows", () => {
    const legend = createDefaultLegend(paper);
    const base = legendHeightMm([], legend, null, 0, 0);
    const withKey = legendHeightMm([], legend, null, 0, 6);
    expect(withKey - base).toBeCloseTo(LEGEND_RSSI_GAP_MM + LEGEND_RSSI_TITLE_MM + 6 * LEGEND_RSSI_ROW_MM, 6);
  });
});

describe("which areas offer the camera-optics control", () => {
  it("hides it on an access point — it has no lens — and on a detector", () => {
    const plain = { optics: undefined };
    expect(coverageOffersOptics(plain, "access-point")).toBe(false);
    expect(coverageOffersOptics(plain, "network-wifi")).toBe(false);
    expect(coverageOffersOptics(plain, "motion-detector")).toBe(false);
  });

  it("keeps it for a camera and for a free-standing area", () => {
    const plain = { optics: undefined };
    expect(coverageOffersOptics(plain, "ip-camera")).toBe(true);
    expect(coverageOffersOptics(plain, "ptz-camera")).toBe(true);
    // Free-standing: it may well be a camera nobody has picked yet.
    expect(coverageOffersOptics(plain, undefined)).toBe(true);
  });

  it("never hides the only way out of an optics state", () => {
    // Anchored to an AP yet carrying optics (a leftover): the control must stay so it
    // can be switched off.
    expect(coverageOffersOptics({ optics: defaultCameraOptics() }, "access-point")).toBe(true);
  });
});
