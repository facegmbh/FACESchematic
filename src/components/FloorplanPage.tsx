import { useState } from "react";
import { useSchematicStore } from "../store";
import FloorplanToolbar from "./FloorplanToolbar";
import FloorplanSidebar from "./FloorplanSidebar";
import FloorplanOptionsPanel from "./FloorplanOptionsPanel";
import FloorplanRenderer from "./FloorplanRenderer";
import type { FloorplanPage as FloorplanPageType } from "../types";

/** Active tool on a floorplan page. `place` drops symbols of the active group on click,
 *  `note` drops a free text note, `erase` drags out a white cover over part of the
 *  underlay, `calibrate` collects two reference points to scale the underlay. */
export type FloorplanTool = "select" | "place" | "note" | "erase" | "calibrate";

export default function FloorplanPage() {
  const activePage = useSchematicStore((s) => s.activePage);
  const pages = useSchematicStore((s) => s.pages);

  const [tool, setTool] = useState<FloorplanTool>("select");
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  // Amplifier line new symbols are numbered on (loudspeaker plans): "4" → 4.1, 4.2 …
  const [activeLine, setActiveLine] = useState("");

  const page = pages.find((p) => p.id === activePage);
  if (!page || page.type !== "floorplan") return null;
  const fp = page as FloorplanPageType;

  // The stored id can go stale (group deleted, page switched) — fall back to the first
  // group so placing never lands in a group that no longer exists.
  const effectiveGroupId = fp.groups.some((g) => g.id === activeGroupId)
    ? activeGroupId
    : fp.groups[0]?.id ?? null;

  return (
    <div className="flex flex-1 overflow-hidden flex-col">
      <FloorplanToolbar page={fp} tool={tool} onToolChange={setTool} />
      <div className="flex flex-1 overflow-hidden">
        <FloorplanSidebar
          page={fp}
          activeGroupId={effectiveGroupId}
          onActiveGroupChange={setActiveGroupId}
          activeLine={activeLine}
          onActiveLineChange={setActiveLine}
        />
        <FloorplanRenderer
          page={fp}
          tool={tool}
          onToolChange={setTool}
          activeGroupId={effectiveGroupId}
          onActiveGroupChange={setActiveGroupId}
          activeLine={activeLine}
        />
        <FloorplanOptionsPanel page={fp} activeLine={activeLine} onActiveLineChange={setActiveLine} />
      </div>
    </div>
  );
}
