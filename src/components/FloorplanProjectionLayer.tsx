import { useMemo } from "react";
import {
  PROJECTION_IN_PICTURE_COLOR,
  PROJECTION_OK_COLOR,
  PROJECTION_WARN_COLOR,
  projectionCaption,
  projectionCaptionAnchorMm,
  inPictureLabel,
  sectionBoxMm,
  visibleProjections,
} from "../projection";
import ProjectionSectionSvg from "./ProjectionSectionSvg";
import { useT } from "../i18n";
import type { FloorplanPage, FloorplanProjection } from "../types";

/** With the coverage areas: above the covers, below the symbols, so the projector stays
 *  on top of its own cone. */
const PROJECTION_Z = 7;

interface Props {
  page: FloorplanPage;
  mmToPx: (mm: number) => number;
  sheetPx: { w: number; h: number };
  interactive: boolean;
  /** Symbols selected on the sheet — a projection shows its handles with its projector. */
  selectedSymbolIds: string[];
  onSelect: (projection: FloorplanProjection) => void;
  onMoveStart: (e: React.MouseEvent, projection: FloorplanProjection) => void;
  onTurnStart: (e: React.MouseEvent, projection: FloorplanProjection) => void;
  /** The section box on the sheet: moved by its body, widened by its corner. */
  onSectionMoveStart: (e: React.MouseEvent, projection: FloorplanProjection, at: { x: number; y: number }) => void;
  onSectionResizeStart: (e: React.MouseEvent, projection: FloorplanProjection, widthMm: number) => void;
}

/**
 * Projectors and their pictures. Deliberately little ink: the surface, the cone to it,
 * the stretch the projector may stand in, one line of caption. The numbers live in the
 * panel; the sheet only has to show at a glance whether the position works.
 */
export default function FloorplanProjectionLayer({
  page, mmToPx, sheetPx, interactive, selectedSymbolIds, onSelect, onMoveStart, onTurnStart, onSectionMoveStart, onSectionResizeStart,
}: Props) {
  const t = useT();
  const items = useMemo(
    () => visibleProjections(page),
    [page],
  );
  if (items.length === 0) return null;
  const px = (p: { x: number; y: number }) => `${mmToPx(p.x)},${mmToPx(p.y)}`;

  return (
    <svg
      className="absolute"
      width={sheetPx.w}
      height={sheetPx.h}
      style={{ left: 0, top: 0, zIndex: PROJECTION_Z, pointerEvents: "none", overflow: "visible" }}
    >
      <defs>
        <pattern id="projection-in-picture" patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={6} stroke={PROJECTION_IN_PICTURE_COLOR} strokeWidth={2} />
        </pattern>
      </defs>
      {items.map(({ projection, geometry: g }) => {
        const ok = g.result.issues.length === 0;
        const color = ok ? PROJECTION_OK_COLOR : PROJECTION_WARN_COLOR;
        const selected = selectedSymbolIds.includes(projection.symbolId);
        const [a, b] = g.pictureMm;
        const [sa, sb] = g.surfaceMm;
        const labelAt = projectionCaptionAnchorMm(projection, page.labelSizeMm * 1.6);
        // Tangent of the surface, for the band's end ticks and the turn handle.
        const len = Math.hypot(sb.x - sa.x, sb.y - sa.y) || 1;
        const tx = (sb.x - sa.x) / len, ty = (sb.y - sa.y) / len;
        const tick = 1.5;
        const turnAt = { x: sb.x + tx * 4, y: sb.y + ty * 4 };
        return (
          <g key={projection.id} data-projection-id={projection.id} data-projection-ok={ok ? "1" : "0"}>
            {g.distanceM > 0 && (
              <polygon
                points={`${px(g.lensMm)} ${px(a)} ${px(b)}`}
                fill={color}
                fillOpacity={0.1}
                stroke={color}
                strokeOpacity={0.7}
                strokeWidth={1}
              />
            )}
            {/* Where someone stands in the picture — the section's answer, seen from above. */}
            {g.inPictureMm && (
              <polygon
                points={g.inPictureMm.map(px).join(" ")}
                fill="url(#projection-in-picture)"
                fillOpacity={0.7}
                stroke={PROJECTION_IN_PICTURE_COLOR}
                strokeWidth={1}
                data-projection-in-picture={projection.id}
              >
                <title>{t("A person of the height set in the section stands in the picture here")}</title>
              </polygon>
            )}
            {g.bandMm && (
              <g stroke={PROJECTION_OK_COLOR} strokeWidth={1} strokeOpacity={0.9}>
                <line x1={mmToPx(g.bandMm[0].x)} y1={mmToPx(g.bandMm[0].y)} x2={mmToPx(g.bandMm[1].x)} y2={mmToPx(g.bandMm[1].y)} strokeDasharray="3 3" />
                {g.bandMm.map((p, i) => (
                  <line key={i} x1={mmToPx(p.x - tx * tick)} y1={mmToPx(p.y - ty * tick)} x2={mmToPx(p.x + tx * tick)} y2={mmToPx(p.y + ty * tick)} />
                ))}
              </g>
            )}
            {/* The surface: grabbed to put it on its wall. A wide transparent stroke under
                the visible line makes a 2 px target catchable. */}
            <line
              x1={mmToPx(sa.x)} y1={mmToPx(sa.y)} x2={mmToPx(sb.x)} y2={mmToPx(sb.y)}
              stroke="transparent"
              strokeWidth={12}
              style={{ pointerEvents: interactive ? "stroke" : "none", cursor: "move" }}
              data-projection-surface={projection.id}
              onMouseDown={(e) => {
                if (!interactive) return;
                e.stopPropagation();
                onSelect(projection);
                onMoveStart(e, projection);
              }}
            >
              <title>{t("Drag the picture to its wall")}</title>
            </line>
            <line x1={mmToPx(sa.x)} y1={mmToPx(sa.y)} x2={mmToPx(sb.x)} y2={mmToPx(sb.y)} stroke="#64748b" strokeWidth={2} />
            <line x1={mmToPx(a.x)} y1={mmToPx(a.y)} x2={mmToPx(b.x)} y2={mmToPx(b.y)} stroke="#111" strokeWidth={3} />
            <text
              x={mmToPx(labelAt.x)}
              y={mmToPx(labelAt.y)}
              fontSize={mmToPx(page.labelSizeMm * 0.85)}
              fill={ok ? "#111" : PROJECTION_WARN_COLOR}
              textAnchor={labelAt.align}
              dominantBaseline="middle"
              style={{ pointerEvents: "none", fontWeight: 600 }}
            >
              {projectionCaption(projection, g)}
            </text>
            {(() => {
              const box = sectionBoxMm(projection, g);
              if (!box) return null;
              const w = mmToPx(box.drawing.widthMm), h = mmToPx(box.drawing.heightMm);
              return (
                <g transform={`translate(${mmToPx(box.x)} ${mmToPx(box.y)})`} data-projection-section-box={projection.id}>
                  <rect
                    width={w}
                    height={h}
                    fill="#fff"
                    stroke={selected ? "#3b82f6" : "#111"}
                    strokeWidth={selected ? 1.5 : 0.75}
                    style={{ pointerEvents: interactive ? "auto" : "none", cursor: "move" }}
                    onMouseDown={(e) => {
                      if (!interactive) return;
                      e.stopPropagation();
                      onSelect(projection);
                      onSectionMoveStart(e, projection, { x: box.x, y: box.y });
                    }}
                  />
                  <g style={{ pointerEvents: "none" }}>
                    <ProjectionSectionSvg drawing={box.drawing} pxPerMm={mmToPx(1)} label={g.section ? inPictureLabel(g.section) : undefined} />
                  </g>
                  {selected && interactive && (
                    <rect
                      x={w - 5}
                      y={h - 5}
                      width={10}
                      height={10}
                      fill="#fff"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      style={{ pointerEvents: "auto", cursor: "ew-resize" }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        onSectionResizeStart(e, projection, box.drawing.widthMm);
                      }}
                    />
                  )}
                </g>
              );
            })()}
            {selected && interactive && (
              <circle
                cx={mmToPx(turnAt.x)}
                cy={mmToPx(turnAt.y)}
                r={5}
                fill="#fff"
                stroke="#3b82f6"
                strokeWidth={2}
                style={{ pointerEvents: "auto", cursor: "crosshair" }}
                data-projection-turn={projection.id}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onTurnStart(e, projection);
                }}
              >
                <title>{t("Drag to turn the picture — the projector swings round with it")}</title>
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}
