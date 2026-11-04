import { describe, expect, it } from "vitest";
import { templates as FACE_LIBRARY } from "../devices/face-library";

// Laut Voice-Acoustic haben VADAS-12K4D und -8K4D je 4× speakON NL4, eine
// Buchse pro Kanal. Ein kombinierter "CH 1/2"-Port liess nur einen Lautsprecher zu.
describe("VADAS-Endstufen", () => {
  for (const model of ["VADAS-12K4D", "VADAS-8K4D"]) {
    it(`${model} hat vier einzelne Speakon-Ausgaenge`, () => {
      const tpl = FACE_LIBRARY.find((t) => t.shortName === model);
      expect(tpl).toBeDefined();
      const outs = tpl!.ports.filter((p) => p.signalType === "speaker-level" && p.direction === "output");
      expect(outs.map((p) => p.label)).toEqual(["Out CH 1", "Out CH 2", "Out CH 3", "Out CH 4"]);
      expect(outs.every((p) => p.connectorType === "speakon")).toBe(true);
      expect(new Set(tpl!.ports.map((p) => p.id)).size).toBe(tpl!.ports.length);
    });
  }
});
