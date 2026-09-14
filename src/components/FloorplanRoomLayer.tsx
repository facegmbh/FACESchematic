import { useMemo } from "react";
import { polygonAreaMm2 } from "../floorplanRooms";
import { paperMmToRealMm } from "../floorplan";
import type { FloorplanPage, FloorplanRoom } from "../types";

/** Über dem Lux-Raster, unter den Wänden: der Raumumriss ordnet das Bild, ohne die
 *  Zeichnung des Architekten zu verdecken. */
const ROOM_Z = 7;

interface Props {
  page: FloorplanPage;
  mmToPx: (mm: number) => number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

/**
 * Die Raumumrisse.
 *
 * Bewusst zurückhaltend gezeichnet: eine gestrichelte Linie und der Name mit Fläche. Der
 * Raum ist kein Gestaltungselement des Plans, sondern die Bezugsfläche der Rechnung — er
 * soll erkennbar sein und sonst nichts an sich ziehen. Gefüllt wird nicht, weil darunter
 * das Lux-Raster liegt, das die eigentliche Aussage trägt.
 */
export default function FloorplanRoomLayer({ page, mmToPx, selectedId, onSelect }: Props) {
  // Auf page.rooms selbst hören, nicht auf ein frisch erzeugtes Rückfall-Array: `?? []`
  // liefert bei jedem Render eine neue Referenz und würde das Memo wertlos machen.
  const labels = useMemo(
    () => (page.rooms ?? []).map((room) => ({ room, ...roomLabel(room, page.scaleDenominator) })),
    [page.rooms, page.scaleDenominator],
  );
  if (labels.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 overflow-visible"
      style={{ zIndex: ROOM_Z, pointerEvents: "none" }}
    >
      {labels.map(({ room, centroid, areaM2 }) => {
        if (room.hidden || room.pointsMm.length < 3) return null;
        const selected = room.id === selectedId;
        const points = room.pointsMm.map((p) => `${mmToPx(p.x)},${mmToPx(p.y)}`).join(" ");
        return (
          <g key={room.id}>
            <polygon
              points={points}
              fill="transparent"
              stroke={selected ? "#0ea5e9" : "#64748b"}
              strokeWidth={selected ? 2 : 1}
              strokeDasharray="6 4"
              style={{ pointerEvents: onSelect ? "auto" : "none", cursor: onSelect ? "pointer" : undefined }}
              onClick={onSelect ? () => onSelect(room.id) : undefined}
            />
            <text
              x={mmToPx(centroid.x)}
              y={mmToPx(centroid.y)}
              textAnchor="middle"
              fill={selected ? "#0ea5e9" : "#64748b"}
              style={{ fontSize: Math.max(9, mmToPx(3)), pointerEvents: "none", userSelect: "none" }}
            >
              {room.name}
              <tspan x={mmToPx(centroid.x)} dy="1.2em" style={{ fontSize: Math.max(8, mmToPx(2.4)) }}>
                {areaM2.toFixed(1)} m² · {(room.heightMm / 1000).toFixed(2)} m
              </tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Schwerpunkt und Grundfläche — wohin die Beschriftung gehört und was sie sagt. */
function roomLabel(room: FloorplanRoom, scaleDenominator: number) {
  const pts = room.pointsMm;
  let x = 0;
  let y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  const n = Math.max(1, pts.length);
  const realMm2 = polygonAreaMm2(pts) * scaleDenominator * scaleDenominator;
  return {
    // Das arithmetische Mittel der Ecken, nicht der Flächenschwerpunkt: bei einem
    // L-Raum kann der Flächenschwerpunkt außerhalb liegen, das Eckenmittel deutlich
    // seltener — und für eine Beschriftung reicht "ungefähr in der Mitte".
    centroid: { x: x / n, y: y / n },
    areaM2: realMm2 / 1e6,
    perimeterRealM: paperMmToRealMm(1, scaleDenominator) / 1000,
  };
}
