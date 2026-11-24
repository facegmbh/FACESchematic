import { create } from "zustand";

/**
 * Which half of the floorplan's side panel is showing.
 *
 *  - "options": what the sheet looks like — symbol groups, numbering, legend, drawing block.
 *  - "planning": what the installation does — coverage areas, Wi-Fi, projectors and
 *    displays with their viewing distances, brightness and contrast.
 *
 * A small store of its own, because the sheet has to be able to turn the panel: clicking
 * a projector's picture or a camera's area is a question about planning, and the answer
 * should be on screen without hunting for the right tab.
 */
export type FloorplanPanelTab = "options" | "planning";

export const useFloorplanPanelTab = create<{ tab: FloorplanPanelTab; setTab: (tab: FloorplanPanelTab) => void }>((set) => ({
  tab: "options",
  setTab: (tab) => set({ tab }),
}));
