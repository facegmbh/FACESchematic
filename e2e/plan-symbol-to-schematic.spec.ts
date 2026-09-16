import { test, expect } from "@playwright/test";

/**
 * The way back from the drawing to the schematic.
 *
 * Planning runs both ways round: sometimes the schematic exists and its devices get placed
 * on the plan, just as often somebody walks the building, drops cameras where they have to
 * hang, and only then works out what they are plugged into. The second way was a dead end —
 * the symbols stood on the sheet and nothing offered to make them real.
 */
test.slow();

test("a symbol drawn on a plan is offered in the library and becomes a device when dragged in", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30_000 });

  // A plan with one symbol of a group bound to a model, and no device behind it.
  const ids = await page.evaluate(async () => {
    const { useSchematicStore } = await import("/src/store.ts");
    const { getBundledTemplates } = await import("/src/templateApi.ts");
    const template = getBundledTemplates().find((t) => t.id)!;
    const st = useSchematicStore.getState();
    const pageId = st.addFloorplanPage("EG");
    const groupId = st.addFloorplanGroup(pageId, {
      label: "Kameras", color: "#e11d1d", shape: "camera", templateId: template.id,
    });
    const symbolId = st.addFloorplanSymbol(pageId, { groupId, positionMm: { x: 120, y: 120 }, label: "K1" });
    // A second group without a model: nothing could be created from it, so it is not offered.
    const looseGroup = st.addFloorplanGroup(pageId, { label: "Handskizze", color: "#1d4ed8", shape: "circle" });
    st.addFloorplanSymbol(pageId, { groupId: looseGroup, positionMm: { x: 140, y: 120 }, label: "X1" });
    return { pageId, symbolId, devices: st.nodes.filter((n) => n.type === "device").length };
  });

  // Adding a plan switches to it; the device library lives on the schematic.
  await page.getByRole("button", { name: "Schematic", exact: true }).first().click();

  // It is on the schematic's library, under its plan.
  const entry = page.locator('[draggable=true]', { hasText: "K1" }).filter({ hasText: "Kameras" }).first();
  await expect(entry).toBeVisible();
  await expect(page.getByText(/On a plan, not in the schematic \(1\)/)).toBeVisible();

  // Drag it onto the canvas: dragover has to be accepted, then the drop carries the id.
  const canvas = page.locator(".react-flow__pane").first();
  const box = (await canvas.boundingBox())!;
  const payload = await entry.evaluate((el) => {
    const dt = new DataTransfer();
    el.dispatchEvent(new DragEvent("dragstart", { dataTransfer: dt, bubbles: true }));
    return dt.getData("application/x-floorplan-symbol");
  });
  expect(payload).not.toBe("");

  const accepted = await canvas.evaluate((el, arg) => {
    const dt = new DataTransfer();
    dt.setData("application/x-floorplan-symbol", arg.payload);
    const over = new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true, clientX: arg.x, clientY: arg.y });
    el.dispatchEvent(over);
    if (!over.defaultPrevented) return false;
    el.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true, clientX: arg.x, clientY: arg.y }));
    return true;
  }, { payload, x: box.x + box.width / 2, y: box.y + box.height / 2 });
  expect(accepted).toBe(true);

  // The device exists and the symbol points at it.
  await expect.poll(async () => page.evaluate(async ({ pageId, symbolId }) => {
    const { useSchematicStore } = await import("/src/store.ts");
    const st = useSchematicStore.getState();
    const p = st.pages.find((pp) => pp.id === pageId) as { symbols: { id: string; deviceNodeId?: string }[] };
    const symbol = p.symbols.find((sym) => sym.id === symbolId);
    const linked = symbol?.deviceNodeId;
    return {
      devices: st.nodes.filter((n) => n.type === "device").length,
      linkedToARealDevice: Boolean(linked && st.nodes.some((n) => n.id === linked)),
    };
  }, ids)).toEqual({ devices: ids.devices + 1, linkedToARealDevice: true });

  // And it is gone from the list — it is in the schematic now.
  await expect(page.getByText(/On a plan, not in the schematic/)).toHaveCount(0);

  expect(errors).toEqual([]);
});
