import { useMemo } from "react";
import {
  coverageAnchorMm,
  coverageColor,
  coverageLabelAnchorMm,
  coveragePathD,
  coveragePointsOnSheet,
  coverageRotationDeg,
  formatCoverageSpec,
  isCoverageVisible,
  DEFAULT_COVERAGE_OPACITY,
  realMmToPaperMm,
  type Vec2,
} from "../floorplan";
import { useT } from "../i18n";
import type { FloorplanCoverage, FloorplanPage } from "../types";

/** Above the white covers (5, or 6 while one is selected) so an area is never whited out,
 *  and below the symbols (10) so a device always stays on top of its own area. */
const COVERAGE_Z = 7;

interface Props {
  page: FloorplanPage;
  /** Paper mm → screen px at the current zoom. */
  mmToPx: (mm: number) => number;
  /** Sheet size in px, so the overlay covers exactly the paper. */
  sheetPx: { w: number; h: number };
  /** Only the select tool grabs areas; every other tool clicks straight through them. */
  interactive: boolean;
  selectedId: string | null;
  /** The area being aimed right now, drawn with its handle lit. */
  aimingId: string | null;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onMoveStart: (e: React.MouseEvent, coverage: FloorplanCoverage) => void;
  onAimStart: (e: React.MouseEvent, coverage: FloorplanCoverage) => void;
}

/**
 * What the cameras see and what the detectors reach, drawn under the symbols.
 *
 * One SVG over the whole sheet rather than a div per area: the shapes are wedges, rings
 * and corridors, and a filled path is the only honest way to draw a 90° sector. The
 * overlay itself never takes the pointer — only the filled paths do — so clicking bare
 * paper still deselects, and placing a symbol inside a detection area works normally.
 *
 * Areas are drawn largest first. A big room detector would otherwise sit on top of the
 * small curtain lens inside it and make the smaller one unclickable.
 */
export default function FloorplanCoverageLayer({
  page, mmToPx, sheetPx, interactive, selectedId, aimingId,
  onSelect, onContextMenu, onMoveStart, onAimStart,
}: Props) {
  const t = useT();
  const visible = useMemo(() => {
    const areas = (page.coverages ?? []).filter((c) => isCoverageVisible(c, page.groups));
    // Sort by drawn extent, biggest at the back. Ties keep their document order.
    return areas
      .map((c, i) => ({ c, i, reach: c.rangeM }))
      .sort((a, b) => b.reach - a.reach || a.i - b.i)
      .map((e) => e.c);
  }, [page.coverages, page.groups]);

  if (visible.length === 0) return null;

  return (
    <svg
      className="absolute"
      width={sheetPx.w}
      height={sheetPx.h}
      style={{ left: 0, top: 0, zIndex: COVERAGE_Z, pointerEvents: "none", overflow: "visible" }}
    >
      {visible.map((coverage) => {
        const points = coveragePointsOnSheet(coverage, page);
        if (points.length < 3) return null;
        const fill = coverageColor(coverage, page.groups);
        const isSel = selectedId === coverage.id;
        const isAiming = aimingId === coverage.id;
        const opacity = coverage.opacity ?? DEFAULT_COVERAGE_OPACITY;
        const outline = coverage.showOutline !== false;
        const anchor = coverageAnchorMm(coverage, page.symbols);
        const turn = coverageRotationDeg(coverage, page.symbols);
        const rPaper = realMmToPaperMm(coverage.rangeM * 1000, page.scaleDenominator);
        const handle = handlePosMm(anchor, rPaper, turn);
        const labelAt = coverageLabelAnchorMm(coverage, page);
        const grabbable = interactive && !coverage.locked;

        return (
          <g key={coverage.id}>
            <path
              d={coveragePathD(points, mmToPx)}
              fill={fill}
              fillOpacity={opacity}
              stroke={isSel ? "#3b82f6" : outline ? fill : "none"}
              strokeOpacity={isSel ? 1 : 0.85}
              strokeWidth={isSel ? 1.5 : outline ? 1 : 0}
              strokeDasharray={isSel ? "4 3" : undefined}
              style={{
                pointerEvents: interactive ? "auto" : "none",
                cursor: grabbable ? (coverage.symbolId ? "pointer" : "move") : "default",
              }}
              onMouseDown={(e) => {
                if (!interactive) return;
                e.stopPropagation();
                onSelect(coverage.id);
                if (!coverage.locked) onMoveStart(e, coverage);
              }}
              onContextMenu={(e) => {
                if (!interactive) return;
                e.preventDefault();
                e.stopPropagation();
                onSelect(coverage.id);
                onContextMenu(e, coverage.id);
              }}
            >
              <title>{[coverage.label, formatCoverageSpec(coverage)].filter(Boolean).join(" · ")}</title>
            </path>

            {/* The caption sits outside the fill, upright — a plan is read from one side. */}
            {coverage.label && (
              <text
                x={mmToPx(labelAt.x)}
                y={mmToPx(labelAt.y)}
                fontSize={mmToPx(page.labelSizeMm * 0.85)}
                fill="#111"
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ pointerEvents: "none", fontWeight: 600 }}
              >
                {coverage.label}
              </text>
            )}

            {/* Aim handle at the far edge: one drag sets both direction and reach, which is
                how a detector is actually adjusted — point it, then dial in the range. */}
            {(isSel || isAiming) && grabbable && (
              <circle
                cx={mmToPx(handle.x)}
                cy={mmToPx(handle.y)}
                r={5}
                fill={isAiming ? "#3b82f6" : "#fff"}
                stroke="#3b82f6"
                strokeWidth={2}
                style={{ pointerEvents: "auto", cursor: "crosshair" }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onAimStart(e, coverage);
                }}
              >
                <title>{t("Drag to set range and direction")}</title>
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** The handle's spot: on the far edge, along the direction the area faces. */
function handlePosMm(anchor: Vec2, rPaper: number, turnDeg: number): Vec2 {
  const rad = (turnDeg * Math.PI) / 180;
  return { x: anchor.x + rPaper * Math.cos(rad), y: anchor.y + rPaper * Math.sin(rad) };
}
