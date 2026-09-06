import { memo } from "react";
import { SIGNAL_LABELS } from "../types";
import { ConnectorIcon, getConnectorSpec } from "./connectorIcons";
import type { RackPlanDevice, RackPlanRack } from "../rackPlan";
import { collectRackPlanSignals } from "../rackPlan";
import { useT } from "../i18n";

/**
 * On-screen cabinet / network rack plan. Each rack is drawn as a stack of
 * realistic 19" device fronts in rack-unit order; devices with jacks (patch
 * panels, switches) show their ports in a single row with a vertical
 * destination + cable-ID label under each connected port.
 *
 * The PDF export in `rackPlanPdf.ts` mirrors this layout — keep the two in
 * sync when changing geometry.
 */

// ─── Geometry (px) ───
const GUTTER = 34; // left lane for the U position
const EAR_W = 11; // rack-ear width
const JACK_W = 34;
const NUM_H = 11; // port-number strip at the top of the faceplate
const HOUSING_H = 26; // jack cutout height
const CHIP_H = 3; // signal-color label strip under each jack
const FACE_PAD = 8;
const LABEL_LANE = 122; // vertical label lane under a faceplate with connections
const ROW_GAP = 7;
const FACE_BG = "#111827";
const EAR_BG = "#374151";
const HOUSING_BG = "#0b1220";
const HOUSING_STROKE = "#334155";
const EMPTY_METAL = "#64748b";

function trunc(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function faceHeight(dev: RackPlanDevice): number {
  if (dev.ports.length > 0) return Math.max(NUM_H + HOUSING_H + CHIP_H + 6, dev.heightU * 22);
  return Math.max(24, dev.heightU * 22);
}
function rowHeight(dev: RackPlanDevice): number {
  const hasLabels = dev.ports.some((p) => p.connected);
  return faceHeight(dev) + (hasLabels ? LABEL_LANE : 0);
}
function uLabel(dev: RackPlanDevice): string {
  const top = dev.uPosition + dev.heightU - 1;
  return dev.heightU > 1 ? `${dev.uPosition}–${top}` : `${dev.uPosition}`;
}

function DeviceRow({ dev, y, faceW }: { dev: RackPlanDevice; y: number; faceW: number }) {
  const fh = faceHeight(dev);
  const x0 = GUTTER;
  const portsX = x0 + EAR_W + FACE_PAD;
  const labelTop = y + fh + 4;

  return (
    <g>
      {/* U position */}
      <text x={GUTTER - 6} y={y + fh / 2} textAnchor="end" dominantBaseline="central" fontSize={9} fill="#64748b" fontFamily="sans-serif">
        {uLabel(dev)}
      </text>

      {/* Faceplate */}
      <rect x={x0} y={y} width={faceW} height={fh} rx={3} fill={FACE_BG} stroke="#0f172a" strokeWidth={1} />
      {/* Rack ears with screw holes */}
      {[x0, x0 + faceW - EAR_W].map((ex, i) => (
        <g key={i}>
          <rect x={ex} y={y} width={EAR_W} height={fh} rx={2} fill={EAR_BG} />
          <circle cx={ex + EAR_W / 2} cy={y + 5} r={1.5} fill="#111827" />
          <circle cx={ex + EAR_W / 2} cy={y + fh - 5} r={1.5} fill="#111827" />
        </g>
      ))}
      {/* Accent stripe in the device color */}
      <rect x={x0 + EAR_W} y={y + 2} width={3} height={fh - 4} fill={dev.color} />

      {dev.ports.length === 0 ? (
        <text x={x0 + faceW / 2} y={y + fh / 2} textAnchor="middle" dominantBaseline="central" fontSize={10} fill="#e5e7eb" fontFamily="sans-serif">
          {trunc(dev.label, Math.floor(faceW / 7))}
        </text>
      ) : (
        <>
          {/* Device label above the ports */}
          <text x={portsX} y={y - 3} fontSize={9} fontWeight={600} fill="#334155" fontFamily="sans-serif">
            {trunc(dev.label, 40)}
            <tspan fill="#94a3b8" fontWeight={400}>
              {"   "}
              {dev.connectedCount}/{dev.ports.length}
            </tspan>
          </text>
          {dev.ports.map((p, i) => {
            const jx = portsX + i * JACK_W;
            const jcx = jx + JACK_W / 2;
            const housingX = jx + 2;
            const housingW = JACK_W - 4;
            const housingY = y + NUM_H;
            const housingCy = housingY + HOUSING_H / 2;
            // Fit the real connector icon inside the jack cutout, preserving aspect.
            const spec = getConnectorSpec(p.connectorType);
            const scale = Math.min((housingW - 6) / spec.widthMm, (HOUSING_H - 7) / spec.heightMm);
            const iconColor = p.connected ? "#e5e7eb" : EMPTY_METAL;
            return (
              <g key={p.portId}>
                {/* Port number printed on the faceplate */}
                <text x={jcx} y={y + NUM_H / 2 + 1} textAnchor="middle" dominantBaseline="central" fontSize={7} fontWeight={600} fill="#cbd5e1" fontFamily="sans-serif">
                  {trunc(p.position, 4)}
                </text>
                {/* Jack cutout (recessed port opening) */}
                <rect x={housingX} y={housingY} width={housingW} height={HOUSING_H} rx={2} fill={HOUSING_BG} stroke={HOUSING_STROKE} strokeWidth={0.75} />
                {/* Real connector icon */}
                <ConnectorIcon x={jcx} y={housingCy} connectorType={p.connectorType} scale={scale} color={iconColor} detail={2} />
                {/* Signal-color label strip under the jack */}
                <rect
                  x={housingX}
                  y={housingY + HOUSING_H + 1}
                  width={housingW}
                  height={CHIP_H}
                  rx={1}
                  fill={p.connected ? p.color : "#334155"}
                  opacity={p.connected ? 1 : 0.5}
                />
                {/* Vertical destination + cable-ID label */}
                {p.connected && (
                  <text
                    x={jcx}
                    y={labelTop}
                    fontSize={8}
                    fill="#334155"
                    fontFamily="sans-serif"
                    transform={`rotate(90 ${jcx} ${labelTop})`}
                  >
                    {trunc(
                      [p.cableId, [p.remoteRoom, p.remoteDevice].filter(Boolean).join(" · "), p.remotePort]
                        .filter(Boolean)
                        .join("  "),
                      Math.floor(LABEL_LANE / 4.6),
                    )}
                  </text>
                )}
              </g>
            );
          })}
        </>
      )}
    </g>
  );
}

function RackSvg({ rack }: { rack: RackPlanRack }) {
  const t = useT();
  const maxPorts = Math.max(8, ...rack.devices.map((d) => d.ports.length));
  const faceW = EAR_W * 2 + FACE_PAD * 2 + maxPorts * JACK_W;
  const width = GUTTER + faceW + 16;

  // Stack rows top-down.
  const TITLE_H = 34;
  const rows: { dev: RackPlanDevice; y: number }[] = [];
  let cursor = TITLE_H;
  for (const dev of rack.devices) {
    // Reserve headroom above ports for the device label (only when it has ports).
    const y = cursor + (dev.ports.length > 0 ? 12 : 4);
    rows.push({ dev, y });
    cursor = y + rowHeight(dev) + ROW_GAP;
  }
  const height = cursor + 6;

  const usedU = rack.devices.reduce((s, d) => s + d.heightU, 0);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      style={{ background: "#ffffff", border: "1px solid var(--color-border)", borderRadius: 8 }}
    >
      <text x={GUTTER} y={16} fontSize={13} fontWeight={700} fill="#0f172a" fontFamily="sans-serif">
        {rack.label}
      </text>
      <text x={GUTTER} y={28} fontSize={9} fill="#64748b" fontFamily="sans-serif">
        {[rack.room, t("{n} U", { n: rack.heightU }), t("{n} U used", { n: usedU })].filter(Boolean).join("   ·   ")}
      </text>
      {rows.map(({ dev, y }) => (
        <DeviceRow key={dev.nodeId} dev={dev} y={y} faceW={faceW} />
      ))}
    </svg>
  );
}

function RackPlanComponent({ racks }: { racks: RackPlanRack[] }) {
  const t = useT();
  if (racks.length === 0) {
    return (
      <div className="text-sm text-[var(--color-text-muted)] text-center py-8 leading-relaxed">
        {t("No rack elevation in this schematic.")}
        <br />
        {t("Add a rack in the rack editor and place devices in it to see the rack plan.")}
      </div>
    );
  }

  const signals = collectRackPlanSignals(racks);

  return (
    <div className="flex flex-col gap-4">
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
      <div className="flex flex-wrap gap-6 items-start">
        {racks.map((r) => (
          <RackSvg key={r.rackId} rack={r} />
        ))}
      </div>
    </div>
  );
}

const RackPlan = memo(RackPlanComponent);
export default RackPlan;
