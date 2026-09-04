import { describe, it, expect } from "vitest";
import {
  buildFloorplanSchedule,
  buildLegendRows,
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
  AVG_GLYPH_WIDTH_FACTOR,
  PAGE_MARGIN_MM,
} from "../floorplan";
import type { FloorplanPage, FloorplanSymbol, FloorplanUnderlay } from "../types";

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

  it("lists one row per group with its symbol count", () => {
    const page = makePage({ groups, symbols });
    const rows = buildLegendRows(page);
    expect(rows.map((r) => r.label)).toEqual(["LS Gastro", "Subwoofer"]); // g3 has no symbols
    expect(rows[0].count).toBe(2);
    expect(rows[1].count).toBe(1);
  });

  it("includes empty groups when the box is set to show all", () => {
    const page = makePage({ groups, symbols, legend: { ...createDefaultLegend(paper), onlyUsedGroups: false } });
    expect(buildLegendRows(page).map((r) => r.label)).toEqual(["LS Gastro", "Subwoofer", "Unused"]);
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
