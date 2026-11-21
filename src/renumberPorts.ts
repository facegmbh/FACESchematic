/**
 * FACE: renumber the ports of a switch (or any device with a row of like ports) in the order the
 * connected devices stand on the sheet, top to bottom — so the lines run side by side into the
 * switch instead of crossing on the way (Jean-Luc, 21.11.: "Switch-Ports dürfen neu belegt werden").
 *
 * Only like ports are swapped: same signal type and direction and the same name without its number
 * ("Port 3", "SFP Port 27"). A port standing alone (management, console, USB) is never touched, nor
 * is a connection the user laid by hand — its port is skipped.
 */
import type { ConnectionEdge, DeviceData, Port, SchematicNode } from "./types";
import { layoutSize } from "./layoutCheck";
import type { PortSideChange } from "./portSides";

const SIDE = /^(.*)-(in|out)$/;

function groupKey(p: Port): string {
  const stem = p.label.replace(/\s*\d+\s*$/, "").trim();
  return `${p.signalType}|${p.direction}|${stem}`;
}

function absolute(n: SchematicNode, byId: Map<string, SchematicNode>): { x: number; y: number } {
  let { x, y } = n.position;
  let parent = n.parentId ? byId.get(n.parentId) : undefined;
  while (parent) {
    x += parent.position.x;
    y += parent.position.y;
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return { x, y };
}

export function renumberPorts(nodes: SchematicNode[], edges: ConnectionEdge[], deviceId: string): PortSideChange[] {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const device = byId.get(deviceId);
  if (device?.type !== "device") return [];
  const ports = (device.data as DeviceData).ports ?? [];
  const portById = new Map(ports.map((p) => [p.id, p] as const));

  // Every connection at this device: which end it is, which port, which side.
  const ends = edges.flatMap((e) => {
    const atSource = e.source === deviceId;
    const atTarget = e.target === deviceId;
    if (!atSource && !atTarget) return [];
    const handle = (atSource ? e.sourceHandle : e.targetHandle) ?? "";
    const m = SIDE.exec(handle);
    const portId = m ? m[1] : handle;
    const port = portById.get(portId);
    if (!port) return [];
    const other = byId.get(atSource ? e.target : e.source);
    const own = (e.data?.manualWaypoints?.length ?? 0) > 0 && !e.data?.autoRouteWaypoints;
    return [{ e, atSource, port, suffix: m ? `-${m[2]}` : "", other, own }];
  });

  // In which order the lines arrive at the switch, per side. A line from a device beside the switch
  // comes in level; one from above comes down a channel next to it. Seen from the switch's upper
  // corner on that side, sweeping from straight above, over the side, to below: the line arriving
  // first takes the top port. So of two devices above, the one nearer the switch (inner track) ends
  // first and the lines nest instead of crossing; devices beside it follow top to bottom.
  const swPos = absolute(device, byId);
  const swSize = layoutSize(device);
  const arrival = (n: SchematicNode | undefined): number => {
    if (!n) return Infinity;
    const p = absolute(n, byId);
    const s = layoutSize(n);
    const cx = p.x + s.width / 2;
    const cy = p.y + s.height / 2;
    // Right only when wholly right of the switch; beside-left and overlapping (above/below) use the
    // left side, as choose_port_sides does.
    const left = p.x < swPos.x + swSize.width;
    const cornerX = left ? swPos.x : swPos.x + swSize.width;
    const out = left ? cornerX - cx : cx - cornerX; // how far out to the side
    return Math.atan2(cy - swPos.y, Math.max(out, 0));
  };

  const changes = new Map<string, PortSideChange>();
  const groups = new Map<string, Port[]>();
  for (const p of ports) groups.set(groupKey(p), [...(groups.get(groupKey(p)) ?? []), p]);
  for (const [key, groupPorts] of groups) {
    if (groupPorts.length < 2) continue; // a port standing alone stays
    const inGroup = ends.filter((x) => groupKey(x.port) === key);
    const movable = inGroup.filter((x) => !x.own && x.other?.type === "device");
    if (movable.length === 0) continue;
    const blocked = new Set(inGroup.filter((x) => !movable.includes(x)).map((x) => x.port.id));
    const slots = groupPorts.filter((p) => !blocked.has(p.id)); // in the device's own order, top to bottom
    const sorted = [...movable].sort((a, b) => arrival(a.other) - arrival(b.other) || a.e.id.localeCompare(b.e.id));
    sorted.forEach((x, i) => {
      const slot = slots[i];
      if (!slot || slot.id === x.port.id) return;
      const handle = `${slot.id}${x.suffix}`;
      changes.set(x.e.id, {
        id: x.e.id,
        sourceHandle: x.atSource ? handle : x.e.sourceHandle!,
        targetHandle: x.atSource ? x.e.targetHandle! : handle,
      });
    });
  }
  return [...changes.values()];
}
