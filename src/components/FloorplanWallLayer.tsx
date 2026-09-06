import { realMmToPaperMm, type Vec2 } from "../floorplan";
import { wallAttenuationDb } from "../wifiCoverage";
import { useT } from "../i18n";
import {
  WALL_MATERIAL_COLORS,
  WALL_MATERIAL_LABELS,
  type FloorplanPage,
  type FloorplanWall,
} from "../types";

/** Above the covers and the coverage areas, below the symbols: a wall is part of the
 *  building, so it belongs under the equipment but over the erased underlay. */
const WALL_Z = 8;

interface Props {
  page: FloorplanPage;
  mmToPx: (mm: number) => number;
  sheetPx: { w: number; h: number };
  interactive: boolean;
  selectedId: string | null;
  /** Vertices placed so far while the wall tool is running, plus the cursor. */
  drawing?: { pointsMm: Vec2[]; cursorMm: Vec2 } | null;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

/**
 * Walls on the plan: the building's own geometry, and what the Wi-Fi heatmap attenuates
 * through.
 *
 * Drawn at their real thickness — a 100 mm stud partition really is thinner on the sheet
 * than a 240 mm brick wall, because both are converted through the drawing scale. That
 * makes a mistyped thickness visible instead of hiding it in a number field.
 */
export default function FloorplanWallLayer({
  page, mmToPx, sheetPx, interactive, selectedId, drawing, onSelect, onContextMenu,
}: Props) {
  const t = useT();
  const walls = page.walls ?? [];
  if (walls.length === 0 && !drawing) return null;

  /** Real thickness → stroke width in screen px, with a floor so a thin wall stays
   *  clickable at a zoomed-out view. */
  const strokePx = (wall: FloorplanWall) =>
    Math.max(1.5, mmToPx(realMmToPaperMm(wall.thicknessMm, page.scaleDenominator)));

  const polyline = (pts: readonly Vec2[]) =>
    pts.map((p) => `${mmToPx(p.x).toFixed(2)},${mmToPx(p.y).toFixed(2)}`).join(" ");

  return (
    <svg
      className="absolute"
      width={sheetPx.w}
      height={sheetPx.h}
      style={{ left: 0, top: 0, zIndex: WALL_Z, pointerEvents: "none", overflow: "visible" }}
    >
      {walls.map((wall) => {
        if (wall.hidden) return null;
        if (wall.pointsMm.length < 2) return null;
        const isSel = selectedId === wall.id;
        const color = WALL_MATERIAL_COLORS[wall.material];
        const width = strokePx(wall);
        return (
          <g key={wall.id}>
            {/* A wider transparent line under the visible one, so a thin wall can still
                be grabbed without having to hit it exactly. */}
            <polyline
              points={polyline(wall.pointsMm)}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(width, 10)}
              strokeLinecap="butt"
              strokeLinejoin="miter"
              style={{
                pointerEvents: interactive ? "stroke" : "none",
                cursor: interactive && !wall.locked ? "pointer" : "default",
              }}
              onMouseDown={(e) => {
                if (!interactive) return;
                e.stopPropagation();
                onSelect(wall.id);
              }}
              onContextMenu={(e) => {
                if (!interactive) return;
                e.preventDefault();
                e.stopPropagation();
                onSelect(wall.id);
                onContextMenu(e, wall.id);
              }}
            >
              <title>
                {[
                  wall.label,
                  t(WALL_MATERIAL_LABELS[wall.material]),
                  `${wall.thicknessMm} mm`,
                  `${wallAttenuationDb(wall, page.heatmap?.band ?? "5").toFixed(1)} dB`,
                ].filter(Boolean).join(" · ")}
              </title>
            </polyline>
            <polyline
              points={polyline(wall.pointsMm)}
              fill="none"
              stroke={color}
              strokeWidth={width}
              strokeLinecap="butt"
              strokeLinejoin="miter"
              opacity={0.9}
              style={{ pointerEvents: "none" }}
            />
            {isSel && (
              <polyline
                points={polyline(wall.pointsMm)}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={width + 3}
                strokeDasharray="6 4"
                strokeLinecap="butt"
                opacity={0.9}
                style={{ pointerEvents: "none" }}
              />
            )}
          </g>
        );
      })}

      {/* The run being drawn: what is fixed, plus a rubber band to the cursor. */}
      {drawing && drawing.pointsMm.length > 0 && (
        <g style={{ pointerEvents: "none" }}>
          <polyline
            points={polyline(drawing.pointsMm)}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={3}
            strokeLinejoin="miter"
          />
          <polyline
            points={polyline([drawing.pointsMm[drawing.pointsMm.length - 1], drawing.cursorMm])}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="5 4"
          />
          {drawing.pointsMm.map((p, i) => (
            <circle key={i} cx={mmToPx(p.x)} cy={mmToPx(p.y)} r={3} fill="#3b82f6" />
          ))}
        </g>
      )}
    </svg>
  );
}
