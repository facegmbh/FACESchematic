import { useMemo } from "react";
import {
  PROJECTION_OK_COLOR,
  PROJECTION_WARN_COLOR,
  projectionCaption,
  projectionCaptionAnchorMm,
  visibleProjections,
} from "../projection";
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
}

/**
 * Projectors and their pictures. Deliberately little ink: the surface, the cone to it,
 * the stretch the projector may stand in, one line of caption. The numbers live in the
 * panel; the sheet only has to show at a glance whether the position works.
 */
export default function FloorplanProjectionLayer({
  page, mmToPx, sheetPx, interactive, selectedSymbolIds, onSelect, onMoveStart, onTurnStart,
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
