import { describe, it, expect } from "vitest";
import { mergeCustomTemplates, templateMergeKey } from "../templateExport";
import type { DeviceTemplate, Port } from "../types";

function tpl(id: string, label: string, ports: Partial<Port>[] = []): DeviceTemplate {
  return {
    id,
    label,
    deviceType: "power-distribution",
    ports: ports.map((p, i) => ({
      id: p.id ?? `port-${i + 1}`,
      label: p.label ?? `Port ${i + 1}`,
      signalType: p.signalType ?? "power",
      direction: p.direction ?? "output",
      connectorType: p.connectorType,
    })),
  } as DeviceTemplate;
}

describe("mergeCustomTemplates — re-importing an edited export", () => {
  it("overwrites a template with the same id instead of skipping it", () => {
    const existing = [tpl("ups-3000", "DIGITUS OnLine USV 3000VA", [{ label: "Schuko Out 1", connectorType: "edison" }])];
    const incoming = [tpl("ups-3000", "DIGITUS OnLine USV 3000VA", [{ label: "Schuko Out 1", connectorType: "cee-7-7" }])];

    const res = mergeCustomTemplates(existing, incoming);

    expect(res.updated).toBe(1);
    expect(res.added).toBe(0);
    expect(res.merged).toHaveLength(1);
    expect(res.merged[0].ports[0].connectorType).toBe("cee-7-7");
  });

  it("keeps the existing position when overwriting, and appends genuinely new templates", () => {
    const existing = [tpl("a", "A"), tpl("b", "B"), tpl("c", "C")];
    const incoming = [tpl("b", "B v2"), tpl("d", "D")];

    const res = mergeCustomTemplates(existing, incoming);

    expect(res.merged.map((t) => t.label)).toEqual(["A", "B v2", "C", "D"]);
    expect(res).toMatchObject({ added: 1, updated: 1, addedKeys: ["d"] });
  });

  it("reports nothing when the import is empty", () => {
    const existing = [tpl("a", "A")];
    const res = mergeCustomTemplates(existing, []);
    expect(res).toMatchObject({ added: 0, updated: 0, addedKeys: [] });
    expect(res.merged).toEqual(existing);
  });

  it("counts an unchanged re-import as updated — it rewrites the same values", () => {
    const existing = [tpl("a", "A")];
    const res = mergeCustomTemplates(existing, [tpl("a", "A")]);
    expect(res).toMatchObject({ added: 0, updated: 1 });
  });

  it("lets the last occurrence win when one import repeats a key", () => {
    const res = mergeCustomTemplates([], [tpl("a", "first"), tpl("a", "second")]);
    expect(res.merged).toHaveLength(1);
    expect(res.merged[0].label).toBe("second");
    expect(res).toMatchObject({ added: 1, updated: 0 });
  });

  it("does not duplicate a key that is added and then re-imported", () => {
    const first = mergeCustomTemplates([], [tpl("a", "A")]);
    const second = mergeCustomTemplates(first.merged, [tpl("a", "A edited")]);

    expect(second.merged).toHaveLength(1);
    expect(second.merged[0].label).toBe("A edited");
    expect(second.addedKeys).toEqual([]);
  });

  it("falls back to deviceType as key when a template has no id", () => {
    const noId = { label: "Ad-hoc", deviceType: "power-distribution", ports: [] } as DeviceTemplate;
    expect(templateMergeKey(noId)).toBe("power-distribution");
  });
});
