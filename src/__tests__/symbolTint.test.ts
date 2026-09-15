/**
 * Recolouring a BHE symbol. The white knockouts are the point of these tests: they are
 * discs that blank out what lies under the symbol, and a naive "swap every colour" fills
 * them in, which turns a readable symbol into a blob on a hatched wall.
 */
import { describe, it, expect } from "vitest";
import { tintSvgText } from "../symbolTint";

/** Shortened to the shapes poppler actually writes. */
const SVG = `<svg viewBox="0 0 10 10">
<path stroke="rgb(0%, 0%, 0%)" fill="none" d="M 0 0 L 10 10"/>
<circle fill="rgb(100%, 100%, 100%)" stroke="rgb(100%, 100%, 100%)" cx="5" cy="5" r="2"/>
<path fill="rgb(0%, 0%, 0%)" d="M 1 1 L 2 2"/>
</svg>`;

describe("tinting", () => {
  it("swaps the black ink and leaves the white knockouts alone", () => {
    const out = tintSvgText(SVG, "#e11d1d");
    expect(out).not.toContain("rgb(0%, 0%, 0%)");
    expect(out.match(/#e11d1d/g)).toHaveLength(2); // one stroke, one fill
    expect(out).toContain('fill="rgb(100%, 100%, 100%)"');
    expect(out).toContain('fill="none"');
  });

  it("covers the other spellings of black", () => {
    expect(tintSvgText('<path stroke="#000000" fill="#000"/>', "#1d4ed8"))
      .toBe('<path stroke="#1d4ed8" fill="#1d4ed8"/>');
    expect(tintSvgText('<path stroke="rgb(0,0,0)"/>', "#1d4ed8")).toBe('<path stroke="#1d4ed8"/>');
  });

  it("does not touch a near-black that the drawing meant as grey", () => {
    const grey = '<path stroke="rgb(20%, 20%, 20%)"/>';
    expect(tintSvgText(grey, "#e11d1d")).toBe(grey);
  });
});
