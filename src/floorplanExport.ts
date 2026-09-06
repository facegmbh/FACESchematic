import { useSchematicStore, loadSpecLookup } from "./store";

/**
 * Run the floorplan PDF export from current store state.
 * Shared by the floorplan toolbar's Export PDF button and File → Export so both
 * behave identically.
 */
export async function runFloorplanExport(): Promise<void> {
  const { exportFloorplanPdf } = await import("./floorplanPdf");
  const state = useSchematicStore.getState();
  const planPages = state.pages.filter((p) => p.type === "floorplan");
  if (planPages.length === 0) {
    alert("No floorplans to export. Add a floorplan page via the page tabs first.");
    return;
  }
  await exportFloorplanPdf({
    pages: state.pages,
    nodes: state.nodes,
    edges: state.edges,
    loadSpecLookup: loadSpecLookup(state),
    // The heatmap needs to resolve each access point's radio, and to honour a measured
    // wall calibration rather than silently printing the defaults.
    customTemplates: state.customTemplates,
    wallMaterials: state.wallMaterials,
    schematicName: state.schematicName,
    titleBlock: state.titleBlock,
    companyProfile: state.companyProfile,
  });
}
