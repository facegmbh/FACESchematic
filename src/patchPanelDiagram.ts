import type {
  SchematicNode,
  ConnectionEdge,
  DeviceData,
  ConnectorType,
  SignalType,
} from "./types";
import { DEFAULT_SIGNAL_COLORS } from "./signalColors";
import { effectiveSignalType } from "./connectorTypes";
import {
  computePatchPanelSchedule,
  type PatchPanelScheduleRow,
} from "./patchPanelSchedule";
import type { CableScheduleDistanceContext } from "./cableSchedule";
import { transformLabelNow } from "./labelCaseUtils";
import { getRoomLabel } from "./packList";

/**
 * Graphical patch-panel front view ("patch plan").
 *
 * This module is the geometry/data layer for the diagram report. It reuses
 * `computePatchPanelSchedule` for the resolved remote-device / cable-ID text
 * (so the diagram and the table always agree) and walks the panel's ports
 * directly for the enum-level fields — `connectorType` and `signalType` — that
 * the tabular schedule discards but the drawing needs (connector icon + color).
 */

const EMPTY = "—";

/** One face of a port. A single-face port uses `face`; passthrough uses `rear`+`front`. */
export interface DiagramFace {
  connectorType?: ConnectorType;
  connector: string;
  signalType: SignalType | "";
  /** Resolved signal color as a hex string (never a CSS var — usable in PDF/SVG). */
  color: string;
  /** "M" | "F" | "—" */
  gender: string;
  connected: boolean;
  remoteDevice: string;
  remotePort: string;
  remoteRoom: string;
  cableId: string;
}

export interface DiagramPort {
  portId: string;
  /** Port label, e.g. "Port 12". */
  position: string;
  passthrough: boolean;
  /** Front-facing face used for single-face ports (mirrors `rear` for passthrough). */
  face: DiagramFace;
  rear?: DiagramFace;
  front?: DiagramFace;
}

export interface DiagramPanel {
  panelId: string;
  panel: string;
  panelRoom: string;
  ports: DiagramPort[];
  /** Grid columns / rows the ports are laid out in. */
  columns: number;
  rows: number;
  connectedCount: number;
  totalCount: number;
  hasPassthrough: boolean;
}

export interface PatchPanelDiagramOptions {
  /** Maximum ports per row before wrapping to a second row. Default 16. */
  maxColumns?: number;
}

function faceColor(sig: SignalType): string {
  return DEFAULT_SIGNAL_COLORS[sig] ?? DEFAULT_SIGNAL_COLORS.custom;
}

function clean(v: string | undefined): string {
  return v && v !== EMPTY ? v : "";
}

/** Build a per-panel front-view model for every patch panel in the schematic. */
export function computePatchPanelDiagram(
  nodes: SchematicNode[],
  edges: ConnectionEdge[],
  namingScheme: "sequential" | "type-prefix" = "sequential",
  distanceContext?: CableScheduleDistanceContext,
  options?: PatchPanelDiagramOptions,
): DiagramPanel[] {
  const scheduleRows = computePatchPanelSchedule(nodes, edges, namingScheme, distanceContext);
  const rowById = new Map<string, PatchPanelScheduleRow>(scheduleRows.map((r) => [r.rowId, r]));

  const maxColumns = Math.max(1, options?.maxColumns ?? 16);
  const panels: DiagramPanel[] = [];

  for (const node of nodes) {
    if (node.type !== "device") continue;
    const data = node.data as DeviceData;
    const isPanel =
      data.deviceType === "patch-panel" ||
      data.ports.some((p) => p.direction === "passthrough");
    if (!isPanel) continue;

    const hidden = new Set(data.hiddenPorts ?? []);
    const ports: DiagramPort[] = [];

    data.ports.forEach((port, idx) => {
      if (hidden.has(port.id)) return;
      const rowId = `${node.id}:${port.id}`;
      const row = rowById.get(rowId);
      const position = transformLabelNow(port.label || `Port ${idx + 1}`);

      if (port.direction === "passthrough") {
        const rearSig = effectiveSignalType(port, node.id, edges, "rear");
        const frontSig = effectiveSignalType(port, node.id, edges, "front");
        const rear: DiagramFace = {
          connectorType: port.rearConnectorType ?? port.connectorType,
          connector: clean(row?.rearConnector),
          signalType: rearSig,
          color: faceColor(rearSig),
          gender: row?.rearGender ?? EMPTY,
          connected: !!clean(row?.rearRemoteDevice) || !!clean(row?.rearCableId),
          remoteDevice: clean(row?.rearRemoteDevice),
          remotePort: clean(row?.rearRemotePort),
          remoteRoom: clean(row?.rearRemoteRoom),
          cableId: row?.rearCableId ?? "",
        };
        const front: DiagramFace = {
          connectorType: port.frontConnectorType ?? port.connectorType,
          connector: clean(row?.frontConnector),
          signalType: frontSig,
          color: faceColor(frontSig),
          gender: row?.frontGender ?? EMPTY,
          connected: !!clean(row?.frontRemoteDevice) || !!clean(row?.frontCableId),
          remoteDevice: clean(row?.frontRemoteDevice),
          remotePort: clean(row?.frontRemotePort),
          remoteRoom: clean(row?.frontRemoteRoom),
          cableId: row?.frontCableId ?? "",
        };
        ports.push({ portId: port.id, position, passthrough: true, face: rear, rear, front });
        return;
      }

      const sig = effectiveSignalType(port, node.id, edges);
      const face: DiagramFace = {
        connectorType: port.connectorType,
        connector: clean(row?.connector),
        signalType: sig,
        color: faceColor(sig),
        gender: row?.gender ?? EMPTY,
        connected: !!(row && row.edgeId),
        remoteDevice: clean(row?.remoteDevice),
        remotePort: clean(row?.remotePort),
        remoteRoom: clean(row?.remoteRoom),
        cableId: row?.cableId ?? "",
      };
      ports.push({ portId: port.id, position, passthrough: false, face });
    });

    if (ports.length === 0) continue;

    const total = ports.length;
    const connected = ports.filter((p) =>
      p.passthrough ? p.rear!.connected || p.front!.connected : p.face.connected,
    ).length;
    // Balance the grid: split into the fewest rows that keep each row ≤ maxColumns.
    const rowsN = Math.max(1, Math.ceil(total / maxColumns));
    const columns = Math.ceil(total / rowsN);

    panels.push({
      panelId: node.id,
      panel: transformLabelNow(data.label || "Unnamed Panel"),
      panelRoom: getRoomLabel(nodes, node.parentId),
      ports,
      columns,
      rows: rowsN,
      connectedCount: connected,
      totalCount: total,
      hasPassthrough: ports.some((p) => p.passthrough),
    });
  }

  panels.sort((a, b) => a.panel.localeCompare(b.panel) || a.panelId.localeCompare(b.panelId));
  return panels;
}

/** Distinct signal types present across all panels, for a diagram legend. */
export function collectDiagramSignals(panels: DiagramPanel[]): { signalType: SignalType; color: string }[] {
  const seen = new Map<SignalType, string>();
  const add = (f: DiagramFace) => {
    if (f.signalType && !seen.has(f.signalType)) seen.set(f.signalType, f.color);
  };
  for (const panel of panels) {
    for (const p of panel.ports) {
      if (p.passthrough) {
        add(p.rear!);
        add(p.front!);
      } else {
        add(p.face);
      }
    }
  }
  return Array.from(seen.entries()).map(([signalType, color]) => ({ signalType, color }));
}
