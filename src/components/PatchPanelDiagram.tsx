import { memo } from "react";
import { SIGNAL_LABELS } from "../types";
import { ConnectorIcon } from "./connectorIcons";
import type { DiagramFace, DiagramPanel } from "../patchPanelDiagram";
import { collectDiagramSignals } from "../patchPanelDiagram";

/**
 * On-screen SVG rendering of the graphical patch plan (patch-panel front view).
 * The PDF export in `patchPanelDiagramPdf.ts` mirrors this layout with jsPDF
 * primitives — keep the two visually in sync when changing geometry.
 */

// ─── Geometry (px) ───
const PANEL_PAD = 16;
const TITLE_H = 30;
const CELL_W = 122;
const CELL_GAP = 10;
const FACE_H = 62;
const FACE_GAP = 6;
const PORT_NUM_H = 16; // space above the jack for the port number
const SINGLE_CELL_H = PORT_NUM_H + FACE_H;
const PASS_CELL_H = PORT_NUM_H + FACE_H * 2 + FACE_GAP;

const JACK_H = 26;
const MUTED = "#9ca3af";
const INK = "#1f2937";

function trunc(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/** One face (single, rear, or front) drawn inside a port cell. */
function FaceBlock({ face, x, y, w, sideLabel }: {
  face: DiagramFace;
  x: number;
  y: number;
  w: number;
  sideLabel?: string;
}) {
  const jackX = x + 4;
  const jackW = w - 8;
  const jackCx = jackX + jackW / 2;
  const jackCy = y + JACK_H / 2;
  const stroke = face.connected ? face.color : MUTED;
  const iconColor = face.connected ? INK : MUTED;
  const textColor = face.connected ? INK : MUTED;

  const line2 = [face.remotePort, face.cableId].filter(Boolean).join(" · ");

  return (
    <g>
      {/* Jack body */}
      <rect
        x={jackX}
        y={y}
        width={jackW}
        height={JACK_H}
        rx={4}
        fill={face.connected ? "#ffffff" : "#f8fafc"}
        stroke={stroke}
        strokeWidth={1.5}
        strokeDasharray={face.connected ? undefined : "3 2"}
      />
      {/* Signal color chip */}
      <rect x={jackX} y={y} width={5} height={JACK_H} rx={2} fill={face.color} opacity={face.connected ? 1 : 0.4} />
      {/* Connector icon */}
      <ConnectorIcon x={jackCx} y={jackCy} connectorType={face.connectorType} scale={0.95} color={iconColor} detail={1} />
      {/* Side label (R/F) for passthrough */}
      {sideLabel && (
        <text x={jackX + 9} y={y + JACK_H - 4} fontSize={7} fontWeight={700} fill={textColor} fontFamily="sans-serif">
          {sideLabel}
        </text>
      )}
      {/* Gender badge */}
      {face.gender && face.gender !== "—" && (
        <text x={jackX + jackW - 4} y={y + JACK_H - 4} fontSize={8} fontWeight={700} textAnchor="end" fill={textColor} fontFamily="sans-serif">
          {face.gender}
        </text>
      )}
      {/* Remote device */}
      <text x={x + w / 2} y={y + JACK_H + 12} fontSize={8} textAnchor="middle" fill={textColor} fontFamily="sans-serif">
        {face.connected ? trunc(face.remoteDevice || "—", 18) : "frei"}
      </text>
      {/* Remote port · cable id */}
      {face.connected && line2 && (
        <text x={x + w / 2} y={y + JACK_H + 22} fontSize={7} textAnchor="middle" fill={MUTED} fontFamily="sans-serif">
          {trunc(line2, 22)}
        </text>
      )}
    </g>
  );
}

function PanelSvg({ panel }: { panel: DiagramPanel }) {
  const cellH = panel.hasPassthrough ? PASS_CELL_H : SINGLE_CELL_H;
  const width = PANEL_PAD * 2 + panel.columns * CELL_W + (panel.columns - 1) * CELL_GAP;
  const gridTop = PANEL_PAD + TITLE_H;
  const height = gridTop + panel.rows * cellH + (panel.rows - 1) * CELL_GAP + PANEL_PAD;
  const pct = panel.totalCount > 0 ? Math.round((panel.connectedCount / panel.totalCount) * 100) : 0;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      style={{ background: "#ffffff", border: "1px solid var(--color-border)", borderRadius: 8 }}
    >
      {/* Title */}
      <text x={PANEL_PAD} y={PANEL_PAD + 12} fontSize={13} fontWeight={700} fill="#0f172a" fontFamily="sans-serif">
        {panel.panel}
      </text>
      <text x={PANEL_PAD} y={PANEL_PAD + 25} fontSize={9} fill="#64748b" fontFamily="sans-serif">
        {panel.panelRoom}
        {"   ·   "}
        {panel.connectedCount}/{panel.totalCount} belegt ({pct}%)
      </text>

      {panel.ports.map((port, i) => {
        const col = i % panel.columns;
        const rowIdx = Math.floor(i / panel.columns);
        const cx = PANEL_PAD + col * (CELL_W + CELL_GAP);
        const cy = gridTop + rowIdx * (cellH + CELL_GAP);
        const numTop = cy + 11;
        return (
          <g key={port.portId}>
            {/* Port number */}
            <text x={cx + CELL_W / 2} y={numTop} fontSize={9} fontWeight={600} textAnchor="middle" fill="#334155" fontFamily="sans-serif">
              {trunc(port.position, 14)}
            </text>
            {port.passthrough ? (
              <>
                <FaceBlock face={port.rear!} x={cx} y={cy + PORT_NUM_H} w={CELL_W} sideLabel="R" />
                <FaceBlock face={port.front!} x={cx} y={cy + PORT_NUM_H + FACE_H + FACE_GAP} w={CELL_W} sideLabel="F" />
              </>
            ) : (
              <FaceBlock face={port.face} x={cx} y={cy + PORT_NUM_H} w={CELL_W} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function PatchPanelDiagramComponent({ panels }: { panels: DiagramPanel[] }) {
  if (panels.length === 0) {
    return (
      <div className="text-sm text-[var(--color-text-muted)] text-center py-8">
        No patch panels in this schematic.
      </div>
    );
  }

  const signals = collectDiagramSignals(panels);

  return (
    <div className="flex flex-col gap-4">
      {/* Legend */}
      {signals.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {signals.map((s) => (
            <div key={s.signalType} className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: s.color }} />
              {SIGNAL_LABELS[s.signalType] ?? s.signalType}
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-4 items-start">
        {panels.map((p) => (
          <PanelSvg key={p.panelId} panel={p} />
        ))}
      </div>
    </div>
  );
}

const PatchPanelDiagram = memo(PatchPanelDiagramComponent);
export default PatchPanelDiagram;
